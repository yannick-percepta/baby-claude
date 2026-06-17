"""
Reusable event emitter for the Onboarding swarm (Card C — Hire-to-Onboard).

This is the bridge that turns the managed-agents SDK event stream into a small,
stable, JSON-serialisable schema that both the CLI runner (run_onboarding.py)
and the web visualisation (serve.py) consume.

Normalised event schema (one dict per yield / one JSON line in the recording):

    {"t": <float seconds since run start>,
     "type": "start|spawn|running|delegate|reply|message|tool|idle|error",
     "agent": "<agent name>",          # omitted for start/idle/error
     "text": "<streamed text>",        # message only
     "tool": "<tool name>",            # tool only
     "session_id": "<id>"}             # start / idle only

The mapping from raw SDK event types is the single source of truth for the
event -> animation table in the web client.

Usage:
    from swarm_events import stream_onboarding_events, load_profile
    client = Anthropic()
    for ev in stream_onboarding_events(client, coordinator_id, environment_id,
                                       load_profile()):
        ...  # ev is a normalised dict
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Iterator, Optional

from anthropic import Anthropic


PROFILE_PATH = Path("synthetic-data/new-hire-profile.md")
OUTPUT_DIR = Path("outputs")
EVENTS_PATH = OUTPUT_DIR / "onboarding-events.jsonl"

# Coordinator's display name — used when the SDK doesn't attach an agent name
# to a coordinator-level message.
COORDINATOR_NAME = "Onboarding Lead"


def load_profile(path: Path = PROFILE_PATH) -> str:
    if not path.exists():
        raise SystemExit(f"Missing {path}")
    return path.read_text()


def build_user_message(profile: str) -> str:
    """The standard kickoff message that asks the coordinator to fan out."""
    return (
        "A new hire is starting soon. Please run the standard onboarding process:\n"
        "1. Read the new-hire profile yourself.\n"
        "2. Delegate to all four specialists in parallel:\n"
        "   - Recruiter: Confirm offer terms and references status\n"
        "   - IT Provisioning: Generate laptop + accounts checklist\n"
        "   - Buddy Match: Select and brief the buddy\n"
        "   - Welcome Packet: Create personalized welcome materials\n"
        "3. Synthesise their replies into a coherent day-1 readiness pack.\n"
        "4. Produce the final pack as a Word document using the docx skill.\n\n"
        "Move fast — the start date is real. We want them to have a great "
        "first day.\n\n"
        f"{profile}"
    )


def normalize(event, t0: float) -> Optional[dict]:
    """Map one raw SDK event to the normalised schema, or None to skip it."""
    t = event.type
    elapsed = round(time.monotonic() - t0, 3)

    if t == "session.thread_created":
        return {"t": elapsed, "type": "spawn",
                "agent": getattr(event, "agent_name", "?")}
    if t == "session.thread_status_running":
        return {"t": elapsed, "type": "running",
                "agent": getattr(event, "agent_name", "?")}
    if t == "agent.thread_message_sent":
        return {"t": elapsed, "type": "delegate",
                "agent": getattr(event, "to_agent_name", "?")}
    if t == "agent.thread_message_received":
        return {"t": elapsed, "type": "reply",
                "agent": getattr(event, "from_agent_name", "?")}
    if t == "agent.message":
        text = "".join(
            getattr(b, "text", "")
            for b in getattr(event, "content", [])
            if getattr(b, "type", None) == "text"
        )
        if not text:
            return None
        return {"t": elapsed, "type": "message",
                "agent": getattr(event, "agent_name", None) or COORDINATOR_NAME,
                "text": text}
    if t == "agent.tool_use":
        return {"t": elapsed, "type": "tool",
                "agent": getattr(event, "agent_name", None) or COORDINATOR_NAME,
                "tool": getattr(event, "name", "?")}
    if t == "session.status_idle":
        return {"t": elapsed, "type": "idle"}
    return None


class _Recorder:
    """Appends normalised events to a JSONL file, truncating on open."""

    def __init__(self, path: Optional[Path]):
        self.path = path
        if path is not None:
            path.parent.mkdir(parents=True, exist_ok=True)
            self._fh = path.open("w")
        else:
            self._fh = None

    def write(self, ev: dict) -> None:
        if self._fh is not None:
            self._fh.write(json.dumps(ev) + "\n")
            self._fh.flush()

    def close(self) -> None:
        if self._fh is not None:
            self._fh.close()


def stream_onboarding_events(
    client: Anthropic,
    coordinator_id: str,
    environment_id: str,
    profile: str,
    *,
    record_path: Optional[Path] = EVENTS_PATH,
    title: str = "Onboarding — New Hire",
) -> Iterator[dict]:
    """Create a session, kick off the swarm, and yield normalised events.

    The first event is always {"type": "start", "session_id": ...} and the
    final event is {"type": "idle", "session_id": ...}. Every yielded event is
    also appended to ``record_path`` (set to None to disable recording) so a
    live run doubles as a deterministic replay recording.
    """
    recorder = _Recorder(record_path)
    t0 = time.monotonic()

    session = client.beta.sessions.create(
        agent=coordinator_id,
        environment_id=environment_id,
        title=title,
    )
    Path(".last_onboarding_session_id").write_text(session.id)

    start_ev = {"t": 0.0, "type": "start", "session_id": session.id}
    recorder.write(start_ev)
    yield start_ev

    user_message = build_user_message(profile)

    try:
        with client.beta.sessions.events.stream(session.id) as stream:
            client.beta.sessions.events.send(
                session.id,
                events=[{
                    "type": "user.message",
                    "content": [{"type": "text", "text": user_message}],
                }],
            )
            for event in stream:
                ev = normalize(event, t0)
                if ev is None:
                    continue
                if ev["type"] == "idle":
                    ev["session_id"] = session.id
                recorder.write(ev)
                yield ev
                if ev["type"] == "idle":
                    break
    except Exception as exc:  # surface failures to the client instead of hanging
        err = {"t": round(time.monotonic() - t0, 3), "type": "error",
               "text": f"{type(exc).__name__}: {exc}"}
        recorder.write(err)
        yield err
        raise
    finally:
        recorder.close()

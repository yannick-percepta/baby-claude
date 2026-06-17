"""
Run the Onboarding swarm against the new-hire profile.

Loads the new-hire-profile.md and supporting files, creates a session with
the Onboarding Lead coordinator, streams events as the swarm processes the
hire in parallel, and produces the day-1 readiness pack as a Word document.

The event loop is shared with the web visualisation via swarm_events.py; this
runner prints the human-readable CLI view and every run also records a
deterministic event log to outputs/onboarding-events.jsonl (used by the
three.js replay mode in serve.py).

Saves the transcript and all deliverables to outputs/.

Usage:
    python run_onboarding.py
"""

import os
import sys
from pathlib import Path

from anthropic import Anthropic

from swarm_events import (
    EVENTS_PATH,
    OUTPUT_DIR,
    load_profile,
    stream_onboarding_events,
)

# Force UTF-8 output encoding on Windows so the event stream prints cleanly.
if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def main() -> None:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise SystemExit("Set ANTHROPIC_API_KEY before running.")

    if not Path(".onboarding_coordinator_id").exists():
        raise SystemExit(
            "Missing .onboarding_coordinator_id. Run "
            "create_onboarding_coordinator.py first."
        )

    if not Path(".environment_id").exists():
        raise SystemExit(
            "Missing .environment_id. Run setup_environment.py first."
        )

    coordinator_id = Path(".onboarding_coordinator_id").read_text().strip()
    environment_id = Path(".environment_id").read_text().strip()

    client = Anthropic()

    print("Loading new-hire profile...")
    profile = load_profile()
    print(f"  Loaded {len(profile)} chars")

    print(f"\nStarting session against coordinator {coordinator_id}...")

    # Stream the events — watch for parallel thread spawns.
    print("\n=== EVENT STREAM (this is the demo) ===\n")
    final_text_parts: list[str] = []
    session_id: str | None = None

    for ev in stream_onboarding_events(
        client, coordinator_id, environment_id, profile,
    ):
        t = ev["type"]
        if t == "start":
            session_id = ev["session_id"]
        elif t == "spawn":
            print(f"  [thread spawned]   {ev['agent']}", flush=True)
        elif t == "running":
            print(f"  [thread running]   {ev['agent']}", flush=True)
        elif t == "reply":
            print(f"  [reply]            {ev['agent']}", flush=True)
        elif t == "delegate":
            print(f"  [delegate]         {ev['agent']}", flush=True)
        elif t == "message":
            final_text_parts.append(ev["text"])
            print(ev["text"], end="", flush=True)
        elif t == "tool":
            print(f"\n  [tool: {ev['tool']}]", flush=True)
        elif t == "idle":
            session_id = ev.get("session_id", session_id)
            print("\n\n[swarm finished]")
        elif t == "error":
            print(f"\n  [error] {ev['text']}", flush=True)

    print(f"\nEvent log recorded to {EVENTS_PATH}")

    OUTPUT_DIR.mkdir(exist_ok=True)
    transcript_path = OUTPUT_DIR / "onboarding-transcript.txt"
    transcript_path.write_text("".join(final_text_parts))
    print(f"Coordinator transcript saved to {transcript_path}")

    if session_id is None:
        print("\nNo session id — skipping deliverable download.")
        return

    # Pull every file the agents produced in the container
    print("\nDownloading deliverables from the session container...")
    files = client.beta.files.list(
        scope_id=session_id,
        betas=["managed-agents-2026-04-01"],
    )
    file_count = 0
    for f in files.data:
        out_path = OUTPUT_DIR / f.filename
        print(f"  {f.filename}  ->  {out_path}")
        content = client.beta.files.download(f.id)
        content.write_to_file(str(out_path))
        file_count += 1

    if file_count == 0:
        print("  (no files found — agents may have produced text-only output)")
    else:
        print(f"\nDownloaded {file_count} file(s) to {OUTPUT_DIR}/")

    print(f"\nView the full session (including all sub-agent threads) at:")
    print(f"  https://platform.claude.com/sessions/{session_id}")


if __name__ == "__main__":
    main()

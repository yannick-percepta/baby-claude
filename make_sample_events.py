"""
Generate a synthetic outputs/onboarding-events.jsonl that mirrors a real swarm
run, for demoing / developing the Reef visualisation offline (no API key). A
real `python run_onboarding.py` overwrites this file with genuine events.

Usage:
    python make_sample_events.py
"""

import json
from pathlib import Path

from swarm_events import EVENTS_PATH

SPECIALISTS = ["Recruiter", "IT Provisioning", "Buddy Match", "Welcome Packet"]


def build() -> list[dict]:
    ev: list[dict] = []
    ev.append({"t": 0.0, "type": "start", "session_id": "sample-session"})
    ev.append({"t": 0.5, "type": "message", "agent": "Onboarding Lead",
               "text": "Reading the new-hire profile for Markus Vogel…"})
    # spawn + running + delegate, staggered
    for i, name in enumerate(SPECIALISTS):
        ev.append({"t": 1.0 + i * 0.2, "type": "spawn", "agent": name})
    for i, name in enumerate(SPECIALISTS):
        ev.append({"t": 1.9 + i * 0.2, "type": "running", "agent": name})
    for i, name in enumerate(SPECIALISTS):
        ev.append({"t": 2.6 + i * 0.2, "type": "delegate", "agent": name})

    ev.append({"t": 3.4, "type": "message", "agent": "Onboarding Lead",
               "text": "Four specialists working in parallel."})
    # tool uses
    ev.append({"t": 3.8, "type": "tool", "agent": "Recruiter", "tool": "web_search"})
    ev.append({"t": 4.2, "type": "tool", "agent": "IT Provisioning", "tool": "bash"})
    ev.append({"t": 4.6, "type": "tool", "agent": "Buddy Match", "tool": "read_file"})
    ev.append({"t": 5.1, "type": "tool", "agent": "Welcome Packet", "tool": "read_file"})
    ev.append({"t": 6.0, "type": "tool", "agent": "IT Provisioning", "tool": "str_replace"})
    ev.append({"t": 7.0, "type": "tool", "agent": "Buddy Match", "tool": "bash"})

    # replies come back over time; buddy last so the minigame plays out
    ev.append({"t": 8.2, "type": "reply", "agent": "Recruiter"})
    ev.append({"t": 9.0, "type": "reply", "agent": "IT Provisioning"})
    ev.append({"t": 10.0, "type": "reply", "agent": "Welcome Packet"})
    ev.append({"t": 12.5, "type": "reply", "agent": "Buddy Match"})

    ev.append({"t": 13.2, "type": "message", "agent": "Onboarding Lead",
               "text": "Synthesising the day-1 readiness pack…"})
    ev.append({"t": 14.0, "type": "tool", "agent": "Onboarding Lead", "tool": "docx"})
    ev.append({"t": 16.0, "type": "idle", "session_id": "sample-session"})
    return ev


def main() -> None:
    EVENTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with EVENTS_PATH.open("w") as fh:
        for e in build():
            fh.write(json.dumps(e) + "\n")
    print(f"Wrote {EVENTS_PATH}")


if __name__ == "__main__":
    main()

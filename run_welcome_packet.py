"""
Run the Welcome Packet specialist standalone against the synthetic new hire.

No coordinator — this opens a session directly against the specialist so you can
demo the personalised welcome content on its own. Inlines the new-hire profile,
company brief, and team directory into the user message (simpler than the Files
API for demo-scale content), streams the reply, and saves it to
outputs/welcome-packet.md.

Usage:
    python run_welcome_packet.py
"""

import json
import os
from pathlib import Path

from anthropic import Anthropic


PROFILE_PATH = Path("synthetic-data/onboarding/new-hire-profile.md")
SUPPORTING_FILES = [
    Path("synthetic-data/onboarding/company-brief.md"),
    Path("synthetic-data/onboarding/team-directory.json"),
]
OUTPUT_DIR = Path("outputs")


def load_inputs_as_context() -> str:
    blocks = []
    for path in [PROFILE_PATH, *SUPPORTING_FILES]:
        if not path.exists():
            print(f"  WARNING: {path} missing — skipping")
            continue
        print(f"  including {path.name}")
        blocks.append(f"=====  DOCUMENT: {path.name}  =====\n{path.read_text()}")
    return "\n\n".join(blocks)


def main() -> None:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise SystemExit("Set ANTHROPIC_API_KEY before running.")

    ids_path = Path(".onboarding_specialist_ids.json")
    if not ids_path.exists() or not Path(".environment_id").exists():
        raise SystemExit(
            "Missing .onboarding_specialist_ids.json or .environment_id. Run "
            "create_welcome_packet.py first (and ensure .environment_id exists)."
        )

    specialist_ids = json.loads(ids_path.read_text())
    specialist_id = specialist_ids["welcome_packet"]
    environment_id = Path(".environment_id").read_text().strip()

    client = Anthropic()

    print("Loading new-hire profile + supporting docs...")
    context = load_inputs_as_context()

    print(f"\nStarting session against Welcome Packet specialist {specialist_id}...")
    session = client.beta.sessions.create(
        agent=specialist_id,
        environment_id=environment_id,
        title="Welcome Packet — Maya Okafor",
    )
    Path(".last_session_id").write_text(session.id)

    user_message = (
        "A new hire is starting soon. Using your welcome-packet skill, write the "
        "personalised welcome section of their day-1 readiness pack.\n\n"
        "Personalise it to this specific hire — reflect their level and working "
        "arrangement, work in at least one of their stated interests, introduce "
        "the real people from the team directory by name, and localise to their "
        "start date and timezone. Return clean markdown only, no preamble.\n\n"
        f"{context}"
    )

    print("\n=== WELCOME CONTENT ===\n")
    final_text_parts: list[str] = []

    with client.beta.sessions.events.stream(session.id) as stream:
        client.beta.sessions.events.send(
            session.id,
            events=[
                {
                    "type": "user.message",
                    "content": [{"type": "text", "text": user_message}],
                }
            ],
        )
        for event in stream:
            t = event.type
            if t == "agent.message":
                for block in event.content:
                    if getattr(block, "type", None) == "text":
                        final_text_parts.append(block.text)
                        print(block.text, end="", flush=True)
            elif t == "agent.tool_use":
                print(f"\n  [tool: {getattr(event, 'name', '?')}]", flush=True)
            elif t == "session.status_idle":
                print("\n\n[done]")
                break

    OUTPUT_DIR.mkdir(exist_ok=True)
    out_path = OUTPUT_DIR / "welcome-packet.md"
    out_path.write_text("".join(final_text_parts))
    print(f"\nWelcome content saved to {out_path}")

    print(f"\nView the full session at:")
    print(f"  https://platform.claude.com/sessions/{session.id}")


if __name__ == "__main__":
    main()

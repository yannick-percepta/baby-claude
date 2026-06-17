"""
Robust onboarding runner: creates session, sends task, polls for completion,
downloads files. Avoids streaming timeout issues.
"""
import os
import sys
import time
from pathlib import Path

from anthropic import Anthropic

# Force UTF-8 output encoding
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

PROFILE_PATH = Path("synthetic-data/new-hire-profile.md")
OUTPUT_DIR = Path("outputs")
POLL_INTERVAL = 5  # seconds


def load_profile() -> str:
    if not PROFILE_PATH.exists():
        raise SystemExit(f"Missing {PROFILE_PATH}")
    return PROFILE_PATH.read_text()


def main() -> None:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise SystemExit("Set ANTHROPIC_API_KEY before running.")

    if not Path(".onboarding_coordinator_id").exists():
        raise SystemExit("Missing .onboarding_coordinator_id")

    if not Path(".environment_id").exists():
        raise SystemExit("Missing .environment_id")

    coordinator_id = Path(".onboarding_coordinator_id").read_text().strip()
    environment_id = Path(".environment_id").read_text().strip()

    client = Anthropic()

    print("Loading new-hire profile...")
    profile = load_profile()

    print(f"\nStarting session against coordinator {coordinator_id}...")
    session = client.beta.sessions.create(
        agent=coordinator_id,
        environment_id=environment_id,
        title="Onboarding — New Hire (Robust)",
    )
    session_id = session.id
    print(f"Session: {session_id}")
    Path(".last_onboarding_session_id").write_text(session_id)

    user_message = (
        "A new hire is starting soon. Please run the standard onboarding process:\n"
        "1. Read the new-hire profile.\n"
        "2. Delegate to all four specialists in parallel:\n"
        "   - Recruiter: Confirm offer terms and references status\n"
        "   - IT Provisioning: Generate laptop + accounts checklist\n"
        "   - Buddy Match: Select and brief the buddy\n"
        "   - Welcome Packet: Create personalized welcome materials\n"
        "3. Synthesise their replies into a day-1 readiness pack.\n"
        "4. Produce the final pack as a Word document.\n\n"
        "The start date is real. Move fast.\n\n"
        f"{profile}"
    )

    print("\nSending task...")
    client.beta.sessions.events.send(
        session_id,
        events=[
            {
                "type": "user.message",
                "content": [{"type": "text", "text": user_message}],
            }
        ],
    )

    print("Polling for completion...")
    start_time = time.time()
    max_wait = 600  # 10 minutes

    while True:
        elapsed = time.time() - start_time
        if elapsed > max_wait:
            print(f"\nTimeout after {max_wait}s")
            break

        session = client.beta.sessions.retrieve(session_id)
        status = session.status
        print(f"  [{int(elapsed)}s] status: {status}")

        if status == "idle":
            print("\nSession complete!")
            break

        time.sleep(POLL_INTERVAL)

    print("\nDownloading files from session...")
    OUTPUT_DIR.mkdir(exist_ok=True)
    files = client.beta.files.list(scope_id=session_id, betas=["managed-agents-2026-04-01"])
    file_count = 0
    for f in files.data:
        out_path = OUTPUT_DIR / f.filename
        print(f"  {f.filename}")
        content = client.beta.files.download(f.id)
        content.write_to_file(str(out_path))
        file_count += 1

    print(f"\nDownloaded {file_count} file(s) to {OUTPUT_DIR}/")
    if file_count == 0:
        print("  → No deliverables generated. Check session logs.")

    print(f"\nSession: https://platform.claude.com/sessions/{session_id}")


if __name__ == "__main__":
    main()

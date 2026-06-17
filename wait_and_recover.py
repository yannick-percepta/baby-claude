"""
Wait for a session to complete and recover all files.
"""
import os
import sys
import time
from pathlib import Path

from anthropic import Anthropic

BETA = "managed-agents-2026-04-01"
OUTPUT_DIR = Path("outputs")


def main() -> None:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise SystemExit("Set ANTHROPIC_API_KEY before running.")

    session_id_file = Path(".last_onboarding_session_id")
    if not session_id_file.exists():
        raise SystemExit(f"Missing {session_id_file}")

    session_id = session_id_file.read_text().strip()
    print(f"Monitoring session {session_id}...")

    client = Anthropic()
    OUTPUT_DIR.mkdir(exist_ok=True)

    # Poll for completion
    print("Waiting for session to complete...")
    for i in range(36):  # Wait up to 3 minutes
        try:
            session = client.beta.sessions.retrieve(session_id)
            print(f"  [{(i+1)*5}s] status: {session.status}")
            if session.status == "idle":
                print("✓ Session complete")
                break
        except Exception as e:
            print(f"  [{(i+1)*5}s] check failed: {e}")
        time.sleep(5)

    print("\nDownloading files...")
    files = client.beta.files.list(scope_id=session_id, betas=[BETA])
    file_count = 0
    for f in files.data:
        out_path = OUTPUT_DIR / f.filename
        print(f"  {f.filename}")
        try:
            content = client.beta.files.download(f.id)
            content.write_to_file(str(out_path))
            file_count += 1
        except Exception as e:
            print(f"    ERROR: {e}")

    print(f"\nRecovered {file_count} file(s)")
    if file_count > 0:
        print(f"Files saved to {OUTPUT_DIR}/")
        for f in OUTPUT_DIR.iterdir():
            if f.is_file():
                print(f"  ✓ {f.name}")
    else:
        print("No files found. Check session logs:")
        print(f"  https://platform.claude.com/sessions/{session_id}")


if __name__ == "__main__":
    main()

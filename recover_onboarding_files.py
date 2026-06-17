"""
Recover and download any files from a session that crashed mid-execution.
"""
import os
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
    print(f"Recovering files from session {session_id}...")

    client = Anthropic()
    OUTPUT_DIR.mkdir(exist_ok=True)

    files = client.beta.files.list(scope_id=session_id, betas=[BETA])
    file_count = 0
    for f in files.data:
        out_path = OUTPUT_DIR / f.filename
        print(f"  Downloading {f.filename}...")
        try:
            content = client.beta.files.download(f.id)
            content.write_to_file(str(out_path))
            file_count += 1
            print(f"    -> {out_path}")
        except Exception as e:
            print(f"    ERROR: {e}")

    if file_count == 0:
        print("  (no files found in session)")
    else:
        print(f"\nRecovered {file_count} file(s) to {OUTPUT_DIR}/")


if __name__ == "__main__":
    main()

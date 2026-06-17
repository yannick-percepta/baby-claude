"""
Create the Welcome Packet specialist for the Hire-to-Onboard scenario (Card C),
upload its skill, and attach it — all in one self-contained step.

This is deliberately isolated from the Deal Desk scripts: it does NOT touch
create_specialists.py, upload_skills.py, or .specialist_ids.json. It writes the
resulting agent id to its own file, .onboarding_specialist_ids.json, so the two
scenarios can coexist.

Usage:
    export ANTHROPIC_API_KEY="sk-ant-..."
    python create_welcome_packet.py
"""

import json
import os
from pathlib import Path

from anthropic import Anthropic
from anthropic.lib import files_from_dir


# The single specialist we build here. Same shape as create_specialists.py's
# SPECIALISTS entries, so this is trivial to fold into a full Card C roster later.
SPECIALISTS = [
    {
        "key": "welcome_packet",
        "name": "Welcome Packet Specialist",
        "model": "claude-sonnet-4-6",  # creative writing — same tier as Deal Desk's writers
        "skill_dir": "welcome-packet",
        "system": (
            "You are the Welcome Packet Specialist on a Hire-to-Onboard team. "
            "Your job is to write the personalised welcome section of a new "
            "hire's day-1 readiness pack — the warm, human part that makes "
            "someone feel they made the right choice on day one.\n\n"
            "Inputs you'll receive:\n"
            "- new-hire-profile.md (who is joining: role, level, team, manager, "
            "start date, working arrangement, interests, logistics)\n"
            "- company-brief.md (mission, values, the team's charter, the "
            "first-week template, key links, Slack channels, perks, glossary)\n"
            "- team-directory.json (the manager and the teammates/partners you "
            "can warmly introduce by name)\n"
            "- the welcome-packet skill (your authoritative voice + structure + "
            "personalisation rules)\n\n"
            "Your output: the personalised welcome section as clean markdown, "
            "following the structure and personalisation rules in your skill. "
            "Personalise it hard — reflect the hire's level, working arrangement, "
            "and at least one stated interest, name real people from the "
            "directory, and localise to their start date and timezone. Never "
            "invent facts that aren't in the inputs. Return markdown only, with "
            "no preamble or meta-commentary."
        ),
    },
]


def main() -> None:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise SystemExit("Set ANTHROPIC_API_KEY before running.")

    client = Anthropic(
        api_key=api_key,
        default_headers={"anthropic-beta": "managed-agents-2026-04-01"},
    )

    # List existing custom skills so we can detect and reuse any prior uploads.
    # Skills API enforces unique display_title, so retrying with the same title
    # would otherwise fail. Idempotent retry is essential for dev loops.
    print("Checking for existing skills...")
    existing_by_title: dict[str, str] = {}
    for page in client.beta.skills.list(source="custom"):
        existing_by_title[page.display_title] = page.id

    specialist_ids: dict[str, str] = {}

    for spec in SPECIALISTS:
        # 1. Create the specialist agent
        agent = client.beta.agents.create(
            name=spec["name"],
            model=spec["model"],
            system=spec["system"],
            tools=[{"type": "agent_toolset_20260401"}],
            metadata={
                "hackathon": "partner-basecamp-2026",
                "track": "specialist-swarm",
                "scenario": "card-c-hire-to-onboard",
                "role": spec["key"],
            },
        )
        specialist_ids[spec["key"]] = agent.id
        print(f"  Created {spec['name']:32s} -> {agent.id}")

        # 2. Upload its skill (or reuse if one already exists with this title)
        skill_dir = Path("skills") / spec["skill_dir"]
        if not (skill_dir / "SKILL.md").exists():
            print(f"  WARNING: {skill_dir}/SKILL.md missing — skill not attached")
            continue

        display_title = spec["skill_dir"].replace("-", " ").title()
        if display_title in existing_by_title:
            skill_id = existing_by_title[display_title]
            print(f"  Reusing existing skill: {spec['skill_dir']} ({skill_id})")
        else:
            print(f"  Uploading skill: {spec['skill_dir']}...")
            skill = client.beta.skills.create(
                display_title=display_title,
                files=files_from_dir(str(skill_dir)),
            )
            skill_id = skill.id
            print(f"    -> {skill_id}")

        # 3. Attach the skill to the specialist
        current = client.beta.agents.retrieve(agent.id)
        new_skills = list(current.skills or []) + [
            {"type": "custom", "skill_id": skill_id, "version": "latest"}
        ]
        client.beta.agents.update(
            agent.id,
            version=current.version,
            skills=new_skills,
        )
        print(f"  Attached skill `{spec['skill_dir']}` ✓")

    Path(".onboarding_specialist_ids.json").write_text(
        json.dumps(specialist_ids, indent=2)
    )
    print(
        f"\nSaved {len(specialist_ids)} specialist id(s) to "
        ".onboarding_specialist_ids.json"
    )
    print("Next: python run_welcome_packet.py")


if __name__ == "__main__":
    main()

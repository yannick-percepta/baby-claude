"""
Create all four onboarding specialist sub-agents (Scenario Card C — Hire-to-Onboard).

Builds four specialists that the Onboarding Lead coordinator can fan work out to:
- Recruiter              — confirms offer terms, captures references status
- IT Provisioning       — generates the laptop + accounts checklist
- Onboarding Buddy Match — selects and briefs the buddy
- Welcome Packet        — generates personalized welcome content

Each specialist gets:
- A narrow system prompt scoped to its lane
- The agent toolset (file ops, web search, web fetch, bash)
- Associated skills (where applicable)

Saves the resulting agent IDs to .onboarding_specialist_ids.json so the
coordinator script can reference them.

Usage:
    export ANTHROPIC_API_KEY="sk-ant-..."
    python create_onboarding_specialists.py
"""

import json
import os
from pathlib import Path

from anthropic import Anthropic
from anthropic.lib import files_from_dir


SPECIALISTS = [
    {
        "key": "recruiter",
        "name": "Recruiter",
        "model": "claude-sonnet-4-6",
        "skill_dir": None,
        "system": (
            "You are the Recruiter in a Hire-to-Onboard team. Your job is to "
            "confirm the new hire's offer terms and capture the status of their "
            "references so the rest of onboarding can proceed with confidence.\n\n"
            "Inputs you'll receive:\n"
            "- The new-hire-profile.md (name, role, team, level, start date, "
            "offer details)\n\n"
            "Your output: a concise offer-and-references confirmation covering:\n"
            "1. Offer terms confirmed — title, level, team, start date, base "
            "compensation, and any signing/equity components present in the "
            "profile (flag anything missing or inconsistent)\n"
            "2. References status — for each named reference: relationship, "
            "contact status (requested / received / outstanding), and any red "
            "flags. If references aren't in the profile, say so explicitly and "
            "mark them as outstanding.\n"
            "3. Go / no-go for onboarding — a clear readiness call with the "
            "blocking items, if any.\n\n"
            "Be precise. Never invent compensation numbers or reference details "
            "that aren't in the profile — flag gaps instead of filling them."
        ),
    },
    {
        "key": "it_provisioning",
        "name": "IT Provisioning",
        "model": "claude-haiku-4-5-20251001",
        "skill_dir": None,
        "system": (
            "You are the IT Provisioning specialist in a Hire-to-Onboard team. "
            "Your job is to generate the day-1 hardware and accounts checklist "
            "for a new hire.\n\n"
            "Inputs you'll receive:\n"
            "- The new-hire-profile.md (role, team, level, start date, location, "
            "remote/onsite)\n\n"
            "Your output: a provisioning checklist tailored to the role:\n"
            "1. Hardware — laptop spec appropriate to the role (e.g. engineering "
            "vs. sales vs. design), peripherals, and shipping/pickup based on "
            "location and remote/onsite status\n"
            "2. Accounts & access — email/SSO, core company apps, and the "
            "role-specific tools and access groups this person needs on day 1\n"
            "3. Security setup — MFA, device enrolment/MDM, VPN\n"
            "4. Timeline — what must be ready before the start date vs. day-1 "
            "tasks, anchored to the start date in the profile\n\n"
            "Present it as a clear, actionable checklist with owners where "
            "relevant. Tailor hardware and access to the specific role — don't "
            "hand out a generic list."
        ),
    },
    {
        "key": "buddy_match",
        "name": "Onboarding Buddy Match",
        "model": "claude-sonnet-4-6",
        "skill_dir": "buddy-match-playbook",
        "system": (
            "You are the Onboarding Buddy Match specialist in a Hire-to-Onboard swarm. "
            "Your job is to pick the single best onboarding buddy for a new hire from a "
            "candidate roster.\n\n"
            "Inputs you'll receive:\n"
            "- new-hire-profile.md (the new hire: team, seniority level, start date, "
            "location/timezone, languages, interests)\n"
            "- buddy-roster.json (candidate buddies with team, seniority_level, tenure, "
            "capacity, leave status, timezone, languages, interests, prior rating)\n"
            "- The buddy-match-playbook skill — your authoritative matching method.\n\n"
            "Method: ALWAYS follow the buddy-match-playbook skill. Apply its hard "
            "eligibility filters first, then weight TEAM and SENIORITY as the primary "
            "signals, and only use timezone / language / interests / rating as tiebreakers. "
            "Return exactly the output format the skill specifies: one recommended buddy "
            "with rationale, one backup, the excluded candidates with reasons, and any flag. "
            "Be decisive — recommend one buddy, not a shortlist."
        ),
    },
    {
        "key": "welcome_packet",
        "name": "Welcome Packet Specialist",
        "model": "claude-sonnet-4-6",
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

    # Cache existing skills to avoid re-uploading
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
                "scenario": "hire-to-onboard",
                "role": spec["key"],
            },
        )
        specialist_ids[spec["key"]] = agent.id
        print(f"  Created {spec['name']:32s} -> {agent.id}")

        # 2. Upload and attach skill if specified
        if spec["skill_dir"]:
            skill_dir = Path("skills") / spec["skill_dir"]
            if not (skill_dir / "SKILL.md").exists():
                print(f"    WARNING: {skill_dir}/SKILL.md missing — skill not attached")
                continue

            display_title = spec["skill_dir"].replace("-", " ").title()
            if display_title in existing_by_title:
                skill_id = existing_by_title[display_title]
                print(f"    Reusing skill: {spec['skill_dir']} ({skill_id})")
            else:
                print(f"    Uploading skill: {spec['skill_dir']}...")
                skill = client.beta.skills.create(
                    display_title=display_title,
                    files=files_from_dir(str(skill_dir)),
                )
                skill_id = skill.id
                existing_by_title[display_title] = skill_id
                print(f"      -> {skill_id}")

            # 3. Attach skill to specialist
            current = client.beta.agents.retrieve(agent.id)
            new_skills = list(current.skills or []) + [
                {"type": "custom", "skill_id": skill_id, "version": "latest"}
            ]
            client.beta.agents.update(
                agent.id,
                version=current.version,
                skills=new_skills,
            )
            print(f"    Attached skill [OK]")

    Path(".onboarding_specialist_ids.json").write_text(
        json.dumps(specialist_ids, indent=2)
    )
    print(
        f"\nSaved {len(specialist_ids)} specialist IDs to "
        ".onboarding_specialist_ids.json"
    )
    print("Next: python create_onboarding_coordinator.py")


if __name__ == "__main__":
    main()

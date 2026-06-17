# Onboarding Coordinator Setup

This is the **Coordinator (Onboarding Lead)** implementation for Card C: Hire-to-Onboard Orchestrator.

## Architecture

- **Coordinator:** `create_onboarding_coordinator.py` — creates the Onboarding Lead agent
- **Run Script:** `run_onboarding.py` — orchestrates the onboarding swarm
- **Input:** `synthetic-data/new-hire-profile.md` — new hire profile
- **Output:** `outputs/day-1-readiness.docx` — day-1 readiness pack (Word doc)

## Setup Steps

### 1. Set up the environment (one time)
```bash
python setup_environment.py
```
This creates a cloud environment where the swarm runs. The ID is saved to `.environment_id`.

### 2. Wait for all specialist agents to be created
Your team members are creating the four specialist agents:
- Recruiter
- IT Provisioning
- Onboarding Buddy Match
- Welcome Packet

Once all specialists are created, their agent IDs will be saved to `.onboarding_specialist_ids.json` 
by `create_onboarding_specialists.py`.

### 3. Create the Onboarding Lead coordinator
```bash
python create_onboarding_coordinator.py
```
This creates the coordinator agent and saves its ID to `.onboarding_coordinator_id`.
It automatically reads the specialist agent IDs from `.onboarding_specialist_ids.json`.

### 4. Run the onboarding swarm
```bash
python run_onboarding.py
```

This will:
- Load the new-hire profile from `synthetic-data/new-hire-profile.md`
- Create a session with the Onboarding Lead coordinator
- Delegate work to all four specialists in parallel
- Stream the execution events to show the parallel work
- Download the final Word document and transcript to `outputs/`

## What the Coordinator Does

1. **Reads** the new-hire profile (name, start date, team, seniority, etc.)
2. **Delegates in parallel** to four specialists:
   - **Recruiter** — confirms offer terms and references status
   - **IT Provisioning** — generates laptop + accounts checklist
   - **Onboarding Buddy Match** — picks a buddy based on team/seniority
   - **Welcome Packet** — generates personalized welcome content
3. **Synthesises** all outputs into a day-1 readiness pack
4. **Produces** the final deliverable as a Word document

## Input Format

See `synthetic-data/new-hire-profile.md` for the expected format. Key fields:
- Name, start date, position, team, manager
- Experience level and seniority
- Department and location
- Special notes (relocation, preferences, etc.)

## Output

The coordinator produces a Word document containing:
- Executive summary (new hire overview, key dates/people)
- Recruiter's sign-off (offer confirmed, references captured)
- IT readiness (laptop config, account setup, access provisioning)
- Buddy assignment (name, intro, first-week plan)
- Welcome materials (team intro, org overview, logistics)
- Any risks and mitigation plans

## Testing

Once all specialists are created and `.onboarding_specialist_ids.json` is populated:

```bash
python setup_environment.py    # One time only
python create_onboarding_coordinator.py
python run_onboarding.py
```

Check `outputs/` for the final Word document and transcript.

## Coordinator Recreation

If you need to recreate the coordinator with updated specialist IDs:
```bash
python create_onboarding_coordinator.py
```
It will read the latest specialist IDs from `.onboarding_specialist_ids.json`.

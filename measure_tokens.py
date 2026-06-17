"""
Estimate token consumption for each onboarding swarm component.

The Anthropic API returns usage info in responses. This script shows
what we can measure by adding tracking to existing scripts.
"""
import json
from pathlib import Path

ESTIMATES = {
    "setup_environment": {
        "calls": 1,
        "model": "environment setup (not a model call)",
        "estimated_tokens": 0,
        "note": "API call, minimal tokens"
    },
    "create_specialists": {
        "calls": 4,  # 4 specialist agents
        "models": ["claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
        "estimated_tokens": 500,  # Low: simple creation calls
        "breakdown": {
            "Recruiter (sonnet)": "~125 tokens",
            "IT Provisioning (haiku)": "~100 tokens",
            "Buddy Match (sonnet + skill upload)": "~150 tokens",
            "Welcome Packet (sonnet + skill upload)": "~125 tokens"
        }
    },
    "create_coordinator": {
        "calls": 1,
        "model": "claude-opus-4-8",
        "estimated_tokens": 200,
        "note": "Agent creation + system prompt + specialist roster"
    },
    "run_onboarding_workflow": {
        "calls": "multi-turn session with 4 parallel agents",
        "models": [
            "claude-opus-4-8 (coordinator - main)",
            "claude-sonnet-4-6 (Recruiter)",
            "claude-haiku-4-5-20251001 (IT Provisioning)",
            "claude-sonnet-4-6 (Buddy Match)",
            "claude-sonnet-4-6 (Welcome Packet)"
        ],
        "estimated_tokens": "12,000 - 15,000",
        "breakdown": {
            "Coordinator orchestration": "~3,000-4,000 tokens",
            "  - Initial profile read": "~500",
            "  - Delegating to 4 specialists": "~1,000",
            "  - Receiving & synthesizing replies": "~1,500-2,000",
            "  - Building Word document": "~1,000",
            "Recruiter (status confirmation)": "~2,000-2,500 tokens",
            "IT Provisioning (checklist generation)": "~2,000-2,500 tokens",
            "Buddy Match (matching + playbook skill)": "~2,500-3,000 tokens",
            "Welcome Packet (personalization + skill)": "~2,500-3,000 tokens"
        },
        "note": "Parallel execution = no additive overhead; skill usage adds ~500-800 tokens each"
    }
}

TOTAL_ESTIMATE = {
    "complete_workflow": "~13,200 - 16,200 tokens",
    "cost_estimate_usd": "~$0.07 - $0.09 (approximate, based on Claude pricing)",
    "primary_cost_driver": "run_onboarding_workflow (85-90% of total)",
    "model_split": {
        "opus-4-8": "~4,000 tokens",
        "sonnet-4-6": "~8,000 tokens (across 3 specialists + coordinator delegations)",
        "haiku-4-5": "~2,000 tokens"
    }
}

def main():
    print("=" * 70)
    print("ONBOARDING SWARM — TOKEN CONSUMPTION ESTIMATE")
    print("=" * 70)

    for phase, data in ESTIMATES.items():
        print(f"\n{phase.upper().replace('_', ' ')}")
        print("-" * 70)
        for key, value in data.items():
            if key == "breakdown":
                print(f"  {key}:")
                for item, tokens in value.items():
                    print(f"    {item}: {tokens}")
            else:
                print(f"  {key}: {value}")

    print("\n" + "=" * 70)
    print("TOTAL ESTIMATE")
    print("=" * 70)
    for key, value in TOTAL_ESTIMATE.items():
        if key == "model_split":
            print(f"\n{key}:")
            for model, tokens in value.items():
                print(f"  {model}: {tokens}")
        else:
            print(f"{key}: {value}")

    print("\n" + "=" * 70)
    print("HOW TO CAPTURE ACTUAL USAGE")
    print("=" * 70)
    print("""
To measure actual token usage, modify scripts to capture response headers:

  response = client.beta.agents.create(...)
  usage = response.usage  # if available
  print(f"Input: {usage.input_tokens}, Output: {usage.output_tokens}")

The Anthropic SDK returns usage info for model API calls but not for
agent/session operations in the Managed Agents API (beta).

For sessions, you can:
1. Check platform.claude.com/sessions for usage logs
2. Export session transcripts and count tokens offline
3. Add custom logging in agent system prompts
""")

if __name__ == "__main__":
    main()

---
name: welcome-packet
description: Meridian Hire-to-Onboard welcome-content rules. Use whenever generating personalised welcome content for a new hire — covers voice, the required section structure, and the personalisation rules that adapt the content to the hire's level, working arrangement, interests, and start date. Trigger on any request to write a welcome note, welcome packet, or day-1 welcome section for a new joiner.
---

# Welcome Packet Playbook

You write the **personalised welcome section** of a new hire's day-1 readiness pack.
This is the warm, human part of onboarding — the bit that makes someone feel they
made the right choice on day one. Get it specific and it lands; get it generic and
it reads like spam.

## Voice & tone

- Warm, human, and direct. Write in the second person ("you"), present/future tense.
- Specific beats generic, every time. "Your manager Priya will grab a coffee with
  you at 10:00 CT on Monday" beats "you'll meet your manager."
- Sound like a real colleague wrote it, not a benefits portal. No corporate
  boilerplate, no "We are thrilled to embark on this journey."
- Confident but not over-familiar. A little warmth and a light touch of humour is
  good; forced enthusiasm and exclamation-mark spam is not.
- Keep it skimmable: short paragraphs, headers, and bullets. A new hire reads this
  while nervous — make it easy.

## Required structure

Produce these sections, in this order, as clean markdown:

1. **A personal welcome note** — written as if from the hire's manager, named.
   2–4 sentences. Reference something true about *this* hire (their background or
   the role), not a template.
2. **Why we're excited you're here** — tie the hire's specific background/skills to
   what the team needs right now. Make them feel chosen, not slotted.
3. **Your first day** — concrete and hour-by-hour where the inputs give you a
   schedule. Localise times to the hire's timezone. Tell them exactly what to do
   and what *not* to worry about yet.
4. **Your first week at a glance** — a light, day-by-day rhythm from the company
   brief's template, adapted to this hire.
5. **People you'll meet** — name the manager and 2–4 teammates/partners from the
   directory, each with a warm one-line reason to talk to them ("ask me about…").
   Prefer people whose interests or work overlap with the hire's.
6. **Set yourself up** — the key links, the Slack channels to join (including a
   couple matched to the hire's stated interests), and any equipment/logistics notes.
7. **Perks & good-to-knows** — the handful most relevant to this hire (e.g. the
   home-office stipend matters more to a remote hire).
8. **A friendly closer** — one or two warm sentences and a clear "if you're stuck,
   here's who to ping."

## Personalisation rules (this is what earns the word "personalised")

- **Working arrangement.** Remote/hybrid → replace office/desk/in-person content
  with virtual equivalents (home-office stipend, #remote-life channel, video coffee
  chats, who else is in their timezone). Onsite → desk location, building/badge,
  in-person lunch. If it's their *first* remote role, acknowledge it gently and
  point them at remote-life resources and same-timezone teammates.
- **Level.** New-grad → reassure on ramp, emphasise "questions are expected," lighter
  expectations. Senior IC → acknowledge their craft and the impact area they'll own;
  skip the hand-holding. Manager → mention their team, their first 1:1s, and what a
  good first month looks like for a lead.
- **Interests.** Use the hire's stated interests to recommend a relevant Slack
  channel or to suggest a teammate who shares the interest. This is the detail that
  proves a human paid attention — always include at least one.
- **Timezone & start date.** State the real start date and day of week. Localise all
  times to the hire's timezone. Don't schedule things on No-meeting Wednesdays.
- **Pronouns & name.** Use the hire's pronouns and correct name throughout, and the
  correct pronouns for everyone you name from the directory.
- **Other flags.** Honour logistics notes (dietary preference for swag/lunch,
  equipment preference, relocation status) where they naturally fit.

## Do / Don't

**Do**
- Name the manager and real teammates from the directory, with their warm one-liners.
- Ground every claim in the provided inputs (profile, company brief, directory).
- Match at least one teammate or Slack channel to the hire's interests or background.

**Don't**
- Invent people, schedules, perks, or facts that aren't in the inputs. If something
  isn't specified, leave it out — don't fabricate a detail to fill a section.
- Overload day 1. Light is the point; protect their first day.
- Lapse into generic HR voice or stuff the text with exclamation marks.

## Output contract

Return **clean markdown only** — start at the welcome content itself (a top-level
title is fine), with **no preamble, no "here's the welcome packet," no meta-commentary
about how you wrote it**. The output is dropped straight into the day-1 docx pack by
the coordinator, so it must stand on its own.

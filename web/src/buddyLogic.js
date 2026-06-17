// Deterministic re-implementation of skills/buddy-match-playbook for the
// minigame: hard filters -> primary scoring (team + seniority) -> tiebreakers.
// Drives the fish animation so the highlight always reads cleanly, even when a
// live run's free-text reply can't be parsed. Mirrors the planted roster.

// The new hire in buddy-roster.json's scenario (Markus Vogel): Senior (IC3),
// Data Platform Engineering, CET, starts 2026-07-06.
const HIRE = {
  team: 'Data Platform Engineering',
  level: 'IC3',
  timezone: 'CET',
  languages: ['German', 'English'],
  interests: ['rock climbing', 'distributed systems', 'board games'],
  start: '2026-07-06',
}

const ADJACENT_ENG = ['Analytics Engineering', 'Infrastructure SRE']

export function evaluateRoster(rosterJson) {
  const ladder = rosterJson.seniority_ladder || []
  const hireIdx = ladder.indexOf(HIRE.level)
  const startDate = new Date(HIRE.start)
  const twoWeeks = new Date(startDate.getTime() + 14 * 864e5)

  const results = rosterJson.candidates.map((c) => {
    const verdict = classify(c, ladder, hireIdx, twoWeeks)
    return { name: c.name, ...verdict, candidate: c }
  })

  // Score the eligible ones, then normalise to 0..1 for glow.
  const eligible = results.filter((r) => r.status === 'eligible')
  let max = 0
  for (const r of eligible) { r.score = rawScore(r.candidate); max = Math.max(max, r.score) }
  for (const r of eligible) r.norm = max ? r.score / max : 0

  const winner = eligible.slice().sort((a, b) => b.score - a.score)[0]
  if (winner) winner.winner = true

  return { results, eligible, winner }
}

function classify(c, ladder, hireIdx, twoWeeks) {
  // hard filters first
  if (c.active_buddy_count >= c.max_buddy_capacity) {
    return { status: 'excluded', reason: 'at capacity' }
  }
  if (c.on_leave_until && new Date(c.on_leave_until) > new Date('2026-07-06')) {
    return { status: 'excluded', reason: 'on leave' }
  }
  const idx = ladder.indexOf(c.seniority_level)
  if (idx >= 0 && hireIdx >= 0 && idx < hireIdx) {
    return { status: 'excluded', reason: 'below seniority floor' }
  }
  // manager of the hire -> flag, don't recommend
  if ((c.seniority_level === 'M1' || c.seniority_level === 'M2')
      && c.team === HIRE.team) {
    return { status: 'flagged', reason: 'is the manager' }
  }
  return { status: 'eligible', reason: '' }
}

function rawScore(c) {
  let s = 0
  // primary: team
  if (c.team === HIRE.team) s += 5
  else if (ADJACENT_ENG.includes(c.team)) s += 3
  else s += 1.5
  // primary: seniority fit (>= hire is good, more senior slightly better)
  if (['IC4', 'IC5'].includes(c.seniority_level)) s += 1.5
  else s += 1
  // tiebreakers
  if ((c.timezone || '').includes('CET')) s += 0.6
  if ((c.languages || []).some((l) => HIRE.languages.includes(l))) s += 0.3
  const shared = (c.interests || []).filter((i) =>
    HIRE.interests.some((h) => i.includes('climb') && h.includes('climb')))
  if (shared.length) s += 0.3
  if (typeof c.prior_buddy_rating === 'number') s += (c.prior_buddy_rating - 4) * 0.2
  s -= c.active_buddy_count * 0.1
  return s
}

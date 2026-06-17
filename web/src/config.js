// Central config: the four specialists, their reef stations, colours, and the
// canonical agent-name aliases the swarm emits. Everything downstream keys off
// SPECIALISTS, so renaming a station or tweaking a colour happens here.

import * as THREE from 'three'

// Agent names as they arrive from the swarm (see swarm_events.py). We match
// loosely (lower-cased substring) because the coordinator phrasing varies.
export const SPECIALISTS = [
  {
    key: 'recruiter',
    label: 'Recruiter',
    aliases: ['recruiter'],
    color: 0xffd166, // warm gold
    station: new THREE.Vector3(-26, 4, -10),
    icon: '📋',
    blurb: 'Confirming offer terms & references',
  },
  {
    key: 'it',
    label: 'IT Provisioning',
    aliases: ['it provisioning', 'it_provisioning', 'provisioning', 'it '],
    color: 0x4cc9f0, // cyan
    station: new THREE.Vector3(-9, -2, -22),
    icon: '💻',
    blurb: 'Spec’ing laptop & accounts',
  },
  {
    key: 'buddy',
    label: 'Buddy Match',
    aliases: ['buddy match', 'buddy_match', 'onboarding buddy', 'buddy'],
    color: 0xf72585, // magenta
    station: new THREE.Vector3(9, 3, -22),
    icon: '🤝',
    blurb: 'Choosing the perfect buddy',
  },
  {
    key: 'welcome',
    label: 'Welcome Packet',
    aliases: ['welcome packet', 'welcome_packet', 'welcome'],
    color: 0x80ed99, // green
    station: new THREE.Vector3(26, 5, -10),
    icon: '🎁',
    blurb: 'Writing the welcome packet',
  },
]

export const COORDINATOR = {
  key: 'coordinator',
  label: 'Onboarding Lead',
  aliases: ['onboarding lead', 'coordinator', 'lead'],
  color: 0xff8fab,
  home: new THREE.Vector3(0, 6, 6),
}

// Resolve an arbitrary agent name string to a specialist key (or 'coordinator').
export function resolveAgentKey(name) {
  if (!name) return null
  const n = String(name).toLowerCase()
  for (const s of SPECIALISTS) {
    if (s.aliases.some((a) => n.includes(a))) return s.key
  }
  if (COORDINATOR.aliases.some((a) => n.includes(a))) return 'coordinator'
  return null
}

export function specialistByKey(key) {
  return SPECIALISTS.find((s) => s.key === key) || null
}

// Where the new-hire sea lion waits, and where it celebrates.
export const SEA_LION_ENTRY = new THREE.Vector3(-40, -4, 10)
export const SEA_LION_STAGE = new THREE.Vector3(0, -3, 14)

// The day-1 readiness "treasure chest" (assembled deliverable) sits below mama.
export const CHEST_POS = new THREE.Vector3(0, -8, 4)

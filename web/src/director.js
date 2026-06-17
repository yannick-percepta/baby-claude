// The Director maps the normalised swarm event stream onto actor behaviour,
// camera cuts, the buddy-match minigame, and the final chest payoff. It is the
// single place that turns "what the agents are doing" into "what you see".

import * as THREE from 'three'
import {
  SPECIALISTS, COORDINATOR, resolveAgentKey, specialistByKey, SEA_LION_STAGE,
} from './config.js'

export class Director {
  constructor({ scene, mama, babies, seaLion, chest, camera, hud }) {
    this.scene = scene
    this.mama = mama
    this.babies = babies // {key: Shark}
    this.seaLion = seaLion
    this.chest = chest
    this.camera = camera
    this.hud = hud

    this.pulses = []
    this.bursts = []

    // buddy minigame state
    this.roster = null // {fishes:[], evalResult, group}
    this.mini = { active: false, t: 0, phase: 0, resolved: false }
  }

  setRoster(roster) { this.roster = roster }

  reset(instant = false) {
    this.hud.reset()
    this.chest.reset()
    this.mama.say('')
    this.mama.setState('idle')
    for (const key in this.babies) {
      const b = this.babies[key]
      b.showScroll(false)
      b.say('')
      b.setState('idle')
      if (instant) b.group.position.copy(b.home)
    }
    // sea lion enters from the side toward the stage
    this.seaLion.group.position.copy(this.seaLion.home)
    this.seaLion.setLabel('🦭 New hire')
    this.seaLion.goTo(SEA_LION_STAGE)
    this._resetMini()
    this.pulses.forEach((p) => this.scene.remove(p.mesh))
    this.pulses = []
    this.camera.wideShot()
  }

  handle(ev) {
    const instant = !!ev.instant
    switch (ev.type) {
      case 'start':
      case 'reset':
        this.reset(instant); break

      case 'spawn': {
        const key = resolveAgentKey(ev.agent)
        if (key && this.babies[key]) {
          this.hud.setStatus(key, '')
          this.hud.chips[key]?.querySelector('.state') &&
            (this.hud.chips[key].querySelector('.state').textContent = 'spawned')
          // little wake-up dart
          this.babies[key].setState('idle')
        }
        break
      }

      case 'running': {
        const key = resolveAgentKey(ev.agent)
        const s = specialistByKey(key)
        if (s && this.babies[key]) {
          this.babies[key].goTo(s.station, 'swimming')
          this.babies[key].say(`${s.icon} ${s.blurb}`)
          this.hud.setStatus(key, 'running')
          this.hud.setActive(key)
          if (!instant) this.camera.focusOn(s.station)
          if (instant) this.babies[key].group.position.copy(s.station)
          if (key === 'buddy') this._startMini(instant)
        }
        break
      }

      case 'delegate': {
        const key = resolveAgentKey(ev.agent)
        const s = specialistByKey(key)
        if (s && this.babies[key]) {
          this.hud.setActive(key)
          if (!instant) {
            this._spawnPulse(this.mama.group.position, this.babies[key].group.position, s.color)
            this.camera.focusOn(s.station)
          }
          if (key === 'buddy') this._startMini(instant)
        }
        break
      }

      case 'tool': {
        const key = resolveAgentKey(ev.agent)
        const s = specialistByKey(key)
        if (s && this.babies[key]) {
          this.babies[key].say(`${s.icon} ${ev.tool}`)
          if (!instant) this._spawnBurst(this.babies[key].group.position, s.color)
        } else {
          this.mama.say(`🛠 ${ev.tool}`)
        }
        break
      }

      case 'message':
        if (ev.text) this.mama.say(clip(ev.text, 64))
        break

      case 'reply': {
        const key = resolveAgentKey(ev.agent)
        const s = specialistByKey(key)
        if (s && this.babies[key]) {
          const b = this.babies[key]
          b.showScroll(true)
          // return to a spot beside mama
          const spot = this.mama.group.position.clone()
            .add(new THREE.Vector3((Math.random() - 0.5) * 10, -3 - Math.random() * 3, 4))
          b.goTo(spot, 'returning')
          b.say('')
          this.hud.setStatus(key, 'done')
          if (key === 'buddy') this._resolveMini(instant)
        }
        break
      }

      case 'idle':
        this.hud.setActive(null)
        this.mama.say('Day-1 pack ready! 🎉')
        this.chest.assemble()
        this.seaLion.setLabel('🦭 Onboarded! 🎉')
        this.seaLion.celebrate()
        if (!instant) this.camera.focusOn(this.chest.group.position, 30, 10)
        break

      case 'error':
        this.hud.setStatusText(ev.text)
        this.mama.say('⚠ ' + clip(ev.text, 50))
        break
    }
    this.hud.pushLog(ev)
  }

  // ---- buddy-match minigame -------------------------------------------- //
  _resetMini() {
    this.mini = { active: false, t: 0, phase: 0, resolved: false }
    if (this.roster) {
      for (const f of this.roster.fishes) {
        f.state = 'pool'; f.opacity = 1; f.mat.opacity = 1
        f.mat.emissiveIntensity = 0.15; f.glow.intensity = 0
        f.group.position.copy(f.home)
        f.setReason('', '')
      }
      this.roster.group.visible = false
    }
  }

  _startMini(instant) {
    if (!this.roster || this.mini.active) return
    this.mini.active = true
    this.mini.t = 0
    this.mini.phase = 0
    this.roster.group.visible = true
    if (instant) this._resolveMini(true)
  }

  _resolveMini(instant) {
    if (!this.roster) return
    const { results, winner } = this.roster.evalResult
    const byName = Object.fromEntries(this.roster.fishes.map((f) => [f.name, f]))
    for (const r of results) {
      const fish = byName[r.name]
      if (!fish) continue
      if (r.status === 'excluded') fish.exclude(r.reason)
      else if (r.status === 'flagged') fish.flag(r.reason)
      else fish.setScore(r.norm || 0)
    }
    if (winner && byName[winner.name]) {
      byName[winner.name].win()
      byName[winner.name].pairWith(
        this.seaLion.group.position.clone().add(new THREE.Vector3(3, 2, 0)),
      )
    }
    this.mini.resolved = true
    this.mini.active = false
  }

  _spawnPulse(from, to, color) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 12, 12),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }),
    )
    mesh.position.copy(from)
    const light = new THREE.PointLight(color, 2, 14)
    mesh.add(light)
    this.scene.add(mesh)
    this.pulses.push({ mesh, from: from.clone(), to: to.clone(), t: 0 })
  }

  _spawnBurst(pos, color) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.5, 24),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
      }),
    )
    ring.position.copy(pos)
    ring.lookAt(this.camera.camera.position)
    this.scene.add(ring)
    this.bursts.push({ mesh: ring, t: 0 })
  }

  update(dt, elapsed) {
    // pulses travel mama -> baby
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i]
      p.t += dt * 1.8
      p.mesh.position.lerpVectors(p.from, p.to, Math.min(1, p.t))
      if (p.t >= 1) { this.scene.remove(p.mesh); this.pulses.splice(i, 1) }
    }
    // tool bursts expand + fade
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i]
      b.t += dt * 2.5
      b.mesh.scale.setScalar(1 + b.t * 6)
      b.mesh.material.opacity = Math.max(0, 0.9 - b.t)
      if (b.t >= 1) { this.scene.remove(b.mesh); this.bursts.splice(i, 1) }
    }
    // minigame scripted timeline (when running live/replay at speed)
    if (this.mini.active && this.roster) {
      this.mini.t += dt
      if (this.mini.phase === 0 && this.mini.t > 1.2) {
        this.mini.phase = 1
        const { results } = this.roster.evalResult
        const byName = Object.fromEntries(this.roster.fishes.map((f) => [f.name, f]))
        for (const r of results) {
          const f = byName[r.name]; if (!f) continue
          if (r.status === 'excluded') f.exclude(r.reason)
          else if (r.status === 'flagged') f.flag(r.reason)
        }
      } else if (this.mini.phase === 1 && this.mini.t > 3.0) {
        this.mini.phase = 2
        const { results } = this.roster.evalResult
        const byName = Object.fromEntries(this.roster.fishes.map((f) => [f.name, f]))
        for (const r of results) {
          if (r.status === 'eligible') byName[r.name]?.setScore(r.norm || 0)
        }
      } else if (this.mini.phase === 2 && this.mini.t > 4.6) {
        this.mini.phase = 3
        this._resolveMini(false)
      }
    }
  }
}

function clip(s, n) {
  s = (s || '').replace(/\s+/g, ' ').trim()
  return s.length > n ? s.slice(0, n) + '…' : s
}

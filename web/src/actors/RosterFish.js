// The buddy-match minigame cast: one little fish per candidate in
// buddy-roster.json. The director animates the playbook on them — hard filters
// fade/flag the ineligible, scoring brightens the survivors, and the winner
// gets spotlit and paired with the sea lion.

import * as THREE from 'three'
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

export class RosterFish {
  constructor({ name, color = 0x9fd3ff, home = new THREE.Vector3() }) {
    this.name = name
    this.group = new THREE.Group()
    this.group.position.copy(home)
    this.home = home.clone()
    this.target = home.clone()
    this.state = 'pool' // pool | excluded | flagged | scored | winner | paired
    this.phase = Math.random() * Math.PI * 2
    this.opacity = 1
    this.score = 0

    const mat = new THREE.MeshStandardMaterial({
      color, roughness: 0.5, transparent: true, opacity: 1,
      emissive: color, emissiveIntensity: 0.15,
    })
    this.mat = mat
    const bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 12), mat)
    bodyMesh.scale.set(1.6, 1, 0.7)
    this.group.add(bodyMesh)
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 8), mat)
    tail.rotation.z = Math.PI / 2
    tail.position.x = -1.1
    tail.scale.set(1, 0.5, 1.4)
    this.tail = tail
    this.group.add(tail)

    this.glow = new THREE.PointLight(color, 0, 10)
    this.group.add(this.glow)

    const el = document.createElement('div')
    el.className = 'label3d fish'
    el.textContent = name
    this.labelEl = el
    this.label = new CSS2DObject(el)
    this.label.position.set(0, 1.2, 0)
    this.group.add(this.label)
  }

  setReason(text, cls) {
    this.labelEl.textContent = text ? `${this.name} — ${text}` : this.name
    this.labelEl.className = `label3d fish ${cls || ''}`
  }

  exclude(reason) {
    this.state = 'excluded'
    this.setReason(reason, 'excluded')
    // drift outward and away
    const dir = new THREE.Vector3().copy(this.home).setY(this.home.y).normalize()
    this.target = this.home.clone().addScaledVector(dir.lengthSq() ? dir : new THREE.Vector3(1, 0, 0), 18)
    this.target.y += 8
  }

  flag(reason) {
    this.state = 'flagged'
    this.setReason(reason, 'flag')
    this.target = this.home.clone().add(new THREE.Vector3(0, 6, 6))
  }

  setScore(score) {
    if (this.state === 'excluded' || this.state === 'flagged') return
    this.state = 'scored'
    this.score = score
    this.mat.emissiveIntensity = 0.15 + score * 0.9
    this.glow.intensity = score * 1.6
  }

  win() {
    this.state = 'winner'
    this.setReason('★ buddy', 'winner')
    this.mat.emissiveIntensity = 1.2
    this.glow.intensity = 2.6
  }

  pairWith(targetVec) { this.state = 'paired'; this.target = targetVec }

  update(dt, elapsed) {
    // tail wiggle
    this.tail.rotation.y = Math.sin(elapsed * 8 + this.phase) * 0.5

    let dest
    if (this.state === 'pool' || this.state === 'scored' || this.state === 'winner') {
      const bob = Math.sin(elapsed * 1.5 + this.phase) * 0.4
      dest = new THREE.Vector3(this.home.x, this.home.y + bob, this.home.z)
    } else {
      dest = this.target
    }

    const to = new THREE.Vector3().subVectors(dest, this.group.position)
    const dist = to.length()
    if (dist > 0.05) {
      const speed = this.state === 'excluded' ? 9 : 6
      this.group.position.addScaledVector(to.normalize(), Math.min(dist, speed * dt))
      this.group.rotation.y = Math.atan2(-to.z, to.x)
    }

    // fade out the excluded
    const targetOpacity = this.state === 'excluded' ? 0.0 : (this.state === 'flagged' ? 0.5 : 1)
    this.opacity += (targetOpacity - this.opacity) * Math.min(1, dt * 2)
    this.mat.opacity = this.opacity
    this.label.visible = this.opacity > 0.08
  }
}

// Lay candidates out in a ring around the buddy station.
export function layoutRing(center, count, radius = 9) {
  const out = []
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    out.push(new THREE.Vector3(
      center.x + Math.cos(a) * radius,
      center.y + Math.sin(a * 1.3) * 2.5,
      center.z + Math.sin(a) * radius,
    ))
  }
  return out
}

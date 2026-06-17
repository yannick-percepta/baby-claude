// The assembled day-1 readiness pack, visualised as a treasure chest that
// springs open with a burst of light when the swarm goes idle.

import * as THREE from 'three'
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

export class Chest {
  constructor({ home = new THREE.Vector3() } = {}) {
    this.group = new THREE.Group()
    this.group.position.copy(home)
    this.t = 0
    this.assembling = false

    const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.7 })
    const gold = new THREE.MeshStandardMaterial({
      color: 0xffd166, metalness: 0.7, roughness: 0.3,
      emissive: 0xffd166, emissiveIntensity: 0.3,
    })

    const base = new THREE.Mesh(new THREE.BoxGeometry(5, 2.6, 3.2), wood)
    this.group.add(base)
    for (const x of [-2.5, 2.5]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.7, 3.3), gold)
      band.position.x = x
      this.group.add(band)
    }

    this.lid = new THREE.Group()
    const lidMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 5, 16, 1, false, 0, Math.PI),
      wood,
    )
    lidMesh.rotation.z = Math.PI / 2
    lidMesh.position.y = 0.2
    this.lid.add(lidMesh)
    this.lid.position.y = 1.3
    this.group.add(this.lid)

    this.glow = new THREE.PointLight(0xffe9a8, 0, 40)
    this.glow.position.y = 1.5
    this.group.add(this.glow)

    const el = document.createElement('div')
    el.className = 'label3d winner'
    el.textContent = '📄 Day-1 readiness pack'
    el.style.opacity = '0'
    this.labelEl = el
    this.label = new CSS2DObject(el)
    this.label.position.set(0, 4.5, 0)
    this.group.add(this.label)

    this.group.scale.setScalar(0.01)
    this.group.visible = false
  }

  assemble() { this.assembling = true; this.t = 0; this.group.visible = true }

  reset() {
    this.assembling = false
    this.t = 0
    this.group.scale.setScalar(0.01)
    this.group.visible = false
    this.lid.rotation.z = 0
    this.glow.intensity = 0
    this.labelEl.style.opacity = '0'
  }

  update(dt, elapsed) {
    if (!this.assembling) return
    this.t += dt
    const s = Math.min(1, this.t * 1.6)
    const ease = 1 - Math.pow(1 - s, 3)
    this.group.scale.setScalar(0.01 + ease * 1.4)
    if (this.t > 0.6) this.lid.rotation.z = Math.min(1.1, (this.t - 0.6) * 1.6)
    this.glow.intensity = Math.min(2.4, this.t) + Math.sin(elapsed * 4) * 0.3
    this.labelEl.style.opacity = String(Math.min(1, Math.max(0, this.t - 0.8)))
    this.group.rotation.y = Math.sin(elapsed * 0.5) * 0.15
  }
}

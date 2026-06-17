// The new hire. Until a real sea-lion model is dropped into
// web/public/models/, this is a friendly low-poly stand-in built from
// primitives. Swap the body group for a GLTF load when the asset lands.

import * as THREE from 'three'
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

export class SeaLion {
  constructor({ home = new THREE.Vector3(), color = 0x8d6e63 } = {}) {
    this.group = new THREE.Group()
    this.group.position.copy(home)
    this.home = home.clone()
    this.target = home.clone()
    this.state = 'idle'
    this.celebrateT = 0
    this.phase = Math.random() * Math.PI

    const body = new THREE.Group()
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 })
    const belly = new THREE.MeshStandardMaterial({ color: 0xd7ccc8, roughness: 0.6 })

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(1.4, 3.4, 8, 16), mat)
    torso.rotation.z = Math.PI / 2
    body.add(torso)

    const bellyMesh = new THREE.Mesh(new THREE.CapsuleGeometry(1.25, 3.0, 8, 16), belly)
    bellyMesh.rotation.z = Math.PI / 2
    bellyMesh.position.y = -0.4
    body.add(bellyMesh)

    // head + snout
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.15, 16, 16), mat)
    head.position.set(2.7, 0.9, 0)
    body.add(head)
    const snout = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 0.8, 6, 12), mat)
    snout.rotation.z = Math.PI / 2
    snout.position.set(3.7, 0.7, 0)
    body.add(snout)
    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x222222 }),
    )
    nose.position.set(4.25, 0.7, 0)
    body.add(nose)

    // eyes
    for (const z of [-0.45, 0.45]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x111111 }),
      )
      eye.position.set(3.25, 1.15, z)
      body.add(eye)
    }

    // fore flippers
    for (const z of [-1, 1]) {
      const flip = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.28, 1.7, 6, 10),
        mat,
      )
      flip.position.set(1.0, -0.9, z * 1.1)
      flip.rotation.x = z * 0.5
      flip.rotation.z = -0.6
      body.add(flip)
      if (z === -1) this.flipperL = flip; else this.flipperR = flip
    }

    // tail flippers
    const tail = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.8, 8), mat)
    tail.rotation.z = -Math.PI / 2
    tail.position.set(-2.6, 0, 0)
    tail.scale.set(1, 0.4, 1.6)
    body.add(tail)

    this.body = body
    this.group.add(body)

    const el = document.createElement('div')
    el.className = 'label3d'
    el.textContent = '🦭 New hire'
    this.label = new CSS2DObject(el)
    this.label.position.set(0, 2.6, 0)
    this.group.add(this.label)
  }

  goTo(vec) { this.target.copy(vec); this.state = 'swimming' }

  celebrate() { this.state = 'celebrate'; this.celebrateT = 0 }

  setLabel(text) { this.label.element.textContent = text }

  update(dt, elapsed) {
    const bob = Math.sin(elapsed * 1.0 + this.phase) * 0.3
    // flipper paddle
    const paddle = Math.sin(elapsed * 4) * 0.3
    if (this.flipperL) this.flipperL.rotation.x = 0.5 + paddle
    if (this.flipperR) this.flipperR.rotation.x = -0.5 - paddle

    if (this.state === 'celebrate') {
      this.celebrateT += dt
      this.body.rotation.x += dt * 7 // barrel roll
      this.group.position.y = this.home.y + Math.abs(Math.sin(this.celebrateT * 4)) * 2
      if (this.celebrateT > 2.2) { this.state = 'idle'; this.body.rotation.x = 0 }
      return
    }

    const dest = this.state === 'swimming' ? this.target
      : new THREE.Vector3(this.home.x, this.home.y + bob, this.home.z)
    const to = new THREE.Vector3().subVectors(dest, this.group.position)
    const dist = to.length()
    if (dist > 0.1) {
      const step = Math.min(dist, 12 * dt)
      this.group.position.addScaledVector(to.normalize(), step)
      // face travel / face the reef
      const lookX = this.state === 'swimming' ? to.x : 1
      this.group.rotation.y = Math.atan2(-(this.state === 'swimming' ? to.z : 0), Math.abs(lookX) + 0.001)
    } else if (this.state === 'swimming') {
      this.home.copy(this.target)
      this.state = 'idle'
    }
  }
}

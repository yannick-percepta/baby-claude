// Camera director: a slow cinematic auto-orbit wide shot that cuts in to focus
// on whichever specialist is active (on delegate/running), then eases back out.

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export class CameraRig {
  constructor(camera, dom) {
    this.camera = camera
    this.controls = new OrbitControls(camera, dom)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.06
    this.controls.minDistance = 14
    this.controls.maxDistance = 120
    this.controls.maxPolarAngle = Math.PI * 0.62
    this.controls.target.set(0, 0, -6)

    this.desiredTarget = new THREE.Vector3(0, 0, -6)
    this.desiredPos = new THREE.Vector3(0, 8, 62)
    this.wide = true
    this.focusTimer = 0
    this.orbitAngle = 0
    this.userInteracting = false
    this.controls.addEventListener('start', () => { this.userInteracting = true })
    this.controls.addEventListener('end', () => {
      this.userInteracting = false; this.focusTimer = 4
    })
  }

  focusOn(vec, dist = 26, height = 8) {
    this.wide = false
    this.focusTimer = 5
    this.desiredTarget.copy(vec)
    // place camera in front-ish of the point, biased toward current side
    const dir = new THREE.Vector3(
      Math.sign(vec.x || 1) * 0.6, 0.35, 1,
    ).normalize()
    this.desiredPos.copy(vec).addScaledVector(dir, dist)
    this.desiredPos.y = vec.y + height
  }

  wideShot() {
    this.wide = true
    this.desiredTarget.set(0, 0, -6)
  }

  update(dt) {
    if (this.focusTimer > 0) {
      this.focusTimer -= dt
      if (this.focusTimer <= 0) this.wideShot()
    }

    if (this.wide) {
      this.orbitAngle += dt * 0.06
      const r = 64
      this.desiredPos.set(
        Math.sin(this.orbitAngle) * r, 12 + Math.sin(this.orbitAngle * 0.5) * 4,
        Math.cos(this.orbitAngle) * r + 4,
      )
    }

    if (!this.userInteracting) {
      this.camera.position.lerp(this.desiredPos, Math.min(1, dt * 1.4))
      this.controls.target.lerp(this.desiredTarget, Math.min(1, dt * 2))
    }
    this.controls.update()
  }
}

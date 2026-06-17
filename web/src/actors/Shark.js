// A Shark actor — used for both the mama (coordinator) and the four baby
// Claudes (specialists). Wraps a normalised model instance in an outer group so
// we can position/orient the whole creature regardless of the model's own
// forward axis, and runs a small swim state machine driven by swarm events.

import * as THREE from 'three'
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { makeSharkInstance, findClip } from './models.js'

// The megalodon model's nose points along +Z; three's lookAt aims -Z at the
// target, so we yaw the inner model 180° to make the nose lead. Tunable.
const MODEL_FACE_YAW = Math.PI

export class Shark {
  constructor(gltf, {
    length = 8, color = 0xffffff, tint = 0.0, home = new THREE.Vector3(),
    isMama = false, swimSpeed = 9,
  } = {}) {
    const { model, mixer, clips } = makeSharkInstance(gltf, length)
    this.isMama = isMama
    this.swimSpeed = swimSpeed

    // inner pivot applies the model-forward correction
    this.pivot = new THREE.Group()
    model.rotation.y = MODEL_FACE_YAW
    this.pivot.add(model)

    this.group = new THREE.Group()
    this.group.add(this.pivot)
    this.group.position.copy(home)

    // tint the material (babies get coloured emissive so they read as "Claude")
    if (tint > 0) {
      model.traverse((o) => {
        if (o.isMesh && o.material) {
          o.material = o.material.clone()
          o.material.emissive = new THREE.Color(color)
          o.material.emissiveIntensity = tint
        }
      })
    }

    // animation
    this.mixer = mixer
    this.swim = mixer.clipAction(findClip(clips, 'Swim'))
    this.swim.play()
    this.swim.timeScale = 1
    const bite = findClip(clips, 'Bite')
    this.bite = bite ? mixer.clipAction(bite) : null

    // movement state
    this.home = home.clone()
    this.target = home.clone()
    this.workCenter = home.clone() // where 'working' hovers (set on arrival)
    this.velocity = new THREE.Vector3()
    this.state = 'idle'
    this.color = color
    this.length = length
    this.phase = Math.random() * Math.PI * 2 // desync the idle bob

    // a glowing "scroll" the baby carries home on reply
    this.scroll = makeScroll(color)
    this.scroll.visible = false
    this.group.add(this.scroll)

    // thought bubble (CSS2D)
    this.bubbleEl = document.createElement('div')
    this.bubbleEl.className = 'label3d thought'
    this.bubble = new CSS2DObject(this.bubbleEl)
    this.bubble.position.set(0, length * 0.6 + 1.5, 0)
    this.bubble.visible = false
    this.group.add(this.bubble)
  }

  say(text) {
    if (!text) { this.bubble.visible = false; return }
    this.bubbleEl.textContent = text
    this.bubble.visible = true
  }

  goTo(vec, state = 'swimming') {
    this.target.copy(vec)
    this.state = state
  }

  setState(state) { this.state = state }

  showScroll(v) { this.scroll.visible = v }

  update(dt, elapsed) {
    this.mixer.update(dt)

    // gentle idle bob + sway
    const bob = Math.sin(elapsed * 1.2 + this.phase) * 0.25

    if (this.state === 'working') {
      // hover near the station with a little circling
      const r = this.length * 0.3
      const cx = this.workCenter.x + Math.cos(elapsed * 0.8 + this.phase) * r
      const cz = this.workCenter.z + Math.sin(elapsed * 0.8 + this.phase) * r
      this._steerTo(new THREE.Vector3(cx, this.workCenter.y + bob, cz), dt, this.swimSpeed * 0.5)
      this.swim.timeScale = 1.5
    } else if (this.state === 'idle' || this.state === 'docked') {
      this._steerTo(
        new THREE.Vector3(this.home.x, this.home.y + bob, this.home.z), dt, this.swimSpeed * 0.4,
      )
      this.swim.timeScale = this.isMama ? 0.7 : 0.9
    } else {
      // swimming / returning toward target
      const arrived = this._steerTo(this.target, dt, this.swimSpeed)
      this.swim.timeScale = 2.0
      if (arrived) {
        if (this.state === 'swimming') { this.workCenter.copy(this.target); this.state = 'working' }
        else if (this.state === 'returning') this.state = 'docked'
      }
    }
  }

  // Move toward `dest`, orient nose along velocity. Returns true when close.
  _steerTo(dest, dt, speed) {
    const to = new THREE.Vector3().subVectors(dest, this.group.position)
    const dist = to.length()
    if (dist < 0.05) return true
    const step = Math.min(dist, speed * dt)
    to.normalize()
    this.group.position.addScaledVector(to, step)

    // smooth orientation toward travel direction
    if (dist > 0.4) {
      const look = new THREE.Vector3().copy(this.group.position).add(to)
      const m = new THREE.Matrix4().lookAt(this.group.position, look, new THREE.Vector3(0, 1, 0))
      const q = new THREE.Quaternion().setFromRotationMatrix(m)
      this.group.quaternion.slerp(q, Math.min(1, dt * 3))
    }
    return dist < speed * dt * 1.5
  }
}

function makeScroll(color) {
  const g = new THREE.Group()
  const paper = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 2.2, 12),
    new THREE.MeshStandardMaterial({
      color: 0xfff7e0, emissive: color, emissiveIntensity: 0.6, roughness: 0.4,
    }),
  )
  paper.rotation.z = Math.PI / 2
  g.add(paper)
  const glow = new THREE.PointLight(color, 1.4, 14)
  g.add(glow)
  g.position.set(0, -1.5, 2.5)
  return g
}

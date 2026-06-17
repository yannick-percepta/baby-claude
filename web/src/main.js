// Bootstrap: build the reef, load the shark, stamp out mama + four baby
// Claudes, the sea-lion new hire, the buddy-roster fish, and the chest; then
// feed the whole thing a normalised swarm event stream (live or replay) through
// the Director. Transport + mode controls live here too.

import * as THREE from 'three'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

import { createReef } from './scene/reef.js'
import { CameraRig } from './scene/camera.js'
import { loadSharkAsset } from './actors/models.js'
import { Shark } from './actors/Shark.js'
import { SeaLion } from './actors/SeaLion.js'
import { Chest } from './actors/Chest.js'
import { RosterFish, layoutRing } from './actors/RosterFish.js'
import { Director } from './director.js'
import { Hud } from './hud.js'
import { evaluateRoster } from './buddyLogic.js'
import { WebSocketSource, ReplaySource, fetchLatestEvents } from './EventSource.js'
import {
  SPECIALISTS, COORDINATOR, SEA_LION_ENTRY, CHEST_POS, specialistByKey,
} from './config.js'

const canvas = document.getElementById('scene')
const { renderer, scene, camera, update: updateReef } = createReef(canvas)

// CSS2D overlay for labels / thought bubbles
const labelRenderer = new CSS2DRenderer()
labelRenderer.setSize(window.innerWidth, window.innerHeight)
labelRenderer.domElement.style.position = 'absolute'
labelRenderer.domElement.style.top = '0'
labelRenderer.domElement.style.pointerEvents = 'none'
document.getElementById('app').appendChild(labelRenderer.domElement)

const rig = new CameraRig(camera, labelRenderer.domElement)
const hud = new Hud()

let director = null
let source = null
let mode = 'replay'

async function boot() {
  // --- load the shark + build the cast --------------------------------- //
  let gltf = null
  try {
    gltf = await loadSharkAsset('/models/shark.gltf')
  } catch (e) {
    console.error('Shark model failed to load:', e)
    hud.setStatusText('Shark model failed to load — using placeholders.')
  }

  const mama = makeShark(gltf, {
    length: 18, color: 0xff8fab, tint: 0, home: COORDINATOR.home, isMama: true,
  })
  scene.add(mama.group)
  const mamaLabel = labelFor('🦈 Mama Claude — Onboarding Lead')
  mamaLabel.position.set(0, 11, 0)
  mama.group.add(mamaLabel)

  const babies = {}
  SPECIALISTS.forEach((s, i) => {
    const home = COORDINATOR.home.clone().add(
      new THREE.Vector3((i - 1.5) * 6, -3 - (i % 2) * 2, -2),
    )
    const b = makeShark(gltf, { length: 7, color: s.color, tint: 0.28, home })
    const lbl = labelFor(`${s.icon} ${s.label}`)
    lbl.position.set(0, 5, 0)
    b.group.add(lbl)
    scene.add(b.group)
    babies[s.key] = b
  })

  // sea lion (new hire)
  const seaLion = new SeaLion({ home: SEA_LION_ENTRY })
  scene.add(seaLion.group)

  // chest
  const chest = new Chest({ home: CHEST_POS })
  scene.add(chest.group)

  // --- buddy roster fish ----------------------------------------------- //
  const roster = await buildRoster()
  if (roster) scene.add(roster.group)

  director = new Director({ scene, mama, babies, seaLion, chest, camera: rig, hud })
  if (roster) director.setRoster(roster)

  // collect updatables
  const actors = [mama, ...Object.values(babies), seaLion, chest]
  if (roster) actors.push(...roster.fishes)

  hideLoader()
  wireControls()
  startSource()

  // --- render loop ----------------------------------------------------- //
  const clock = new THREE.Clock()
  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05)
    const elapsed = clock.elapsedTime
    updateReef(dt, elapsed)
    for (const a of actors) a.update(dt, elapsed)
    director.update(dt, elapsed)
    rig.update(dt)
    renderer.render(scene, camera)
    labelRenderer.render(scene, camera)
    requestAnimationFrame(tick)
  }
  tick()
}

function makeShark(gltf, opts) {
  if (gltf) return new Shark(gltf, opts)
  // placeholder if the model didn't load
  const group = new THREE.Group()
  group.position.copy(opts.home)
  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(opts.length * 0.18, opts.length, 8),
    new THREE.MeshStandardMaterial({ color: opts.color, emissive: opts.color, emissiveIntensity: 0.4 }),
  )
  mesh.rotation.x = Math.PI / 2
  group.add(mesh)
  // minimal Shark-compatible shim
  const shim = {
    group, home: opts.home.clone(), target: opts.home.clone(), workCenter: opts.home.clone(),
    state: 'idle', isMama: !!opts.isMama, length: opts.length,
    say() {}, goTo(v, st) { this.target.copy(v); this.state = st || 'swimming' },
    setState(s) { this.state = s }, showScroll() {},
    update(dt) {
      const dest = this.state === 'idle' || this.state === 'docked' ? this.home : this.target
      const to = new THREE.Vector3().subVectors(dest, this.group.position)
      if (to.length() > 0.1) this.group.position.addScaledVector(to.normalize(), Math.min(to.length(), 9 * dt))
    },
  }
  return shim
}

async function buildRoster() {
  try {
    const res = await fetch('/api/roster')
    const data = await res.json()
    if (!data.roster || !data.roster.candidates) return null
    const evalResult = evaluateRoster(data.roster)
    const station = specialistByKey('buddy').station
    const positions = layoutRing(station, data.roster.candidates.length, 10)
    const group = new THREE.Group()
    group.visible = false
    const fishes = data.roster.candidates.map((c, i) => {
      const f = new RosterFish({
        name: c.name.split(' ')[0], // first name keeps labels short
        color: 0x9fd3ff, home: positions[i],
      })
      // map full-name eval results onto first-name fish
      f.fullName = c.name
      group.add(f.group)
      return f
    })
    // re-key evalResult by first name so the director matches fish
    const byFirst = {}
    for (const r of evalResult.results) byFirst[r.name.split(' ')[0]] = r
    const results = fishes.map((f) => ({ ...byFirst[f.name], name: f.name }))
    const winnerFirst = evalResult.winner ? evalResult.winner.name.split(' ')[0] : null
    return {
      group, fishes,
      evalResult: { results, winner: winnerFirst ? { name: winnerFirst } : null },
    }
  } catch (e) {
    console.warn('roster unavailable:', e)
    return null
  }
}

// ---- event source + transport ------------------------------------------ //

function startSource() {
  if (source) source.stop()
  director.reset()
  if (mode === 'live') {
    hud.setStatusText('Live: connecting to swarm…')
    source = new WebSocketSource()
  } else {
    source = new ReplaySource(window.__events || [])
    hud.setStatusText(window.__events?.length
      ? `Replay: ${window.__events.length} recorded events`
      : 'Replay: no recording yet — run python run_onboarding.py')
  }
  source.onEvent = (ev) => director.handle(ev)
  source.onState = (s) => updateTransport(s)
  source.start()
}

function updateTransport(s) {
  const seek = document.getElementById('seek')
  const clock = document.getElementById('clock')
  if (s.duration > 0) seek.value = String(Math.round((s.t / s.duration) * 1000))
  clock.textContent = s.t.toFixed(1) + 's'
  document.getElementById('play').textContent = s.playing ? '⏸' : '▶'
}

function wireControls() {
  const playBtn = document.getElementById('play')
  const restartBtn = document.getElementById('restart')
  const seek = document.getElementById('seek')
  const speed = document.getElementById('speed')
  const replayBtn = document.getElementById('mode-replay')
  const liveBtn = document.getElementById('mode-live')

  playBtn.onclick = () => source && source.setPlaying(
    document.getElementById('play').textContent !== '⏸',
  )
  restartBtn.onclick = () => { director.reset(); source && source.restart && source.restart() }
  speed.onchange = () => source && source.setSpeed(parseFloat(speed.value))
  seek.oninput = () => {
    if (source && source.seek && source.duration) {
      source.seek((parseInt(seek.value) / 1000) * source.duration)
    }
  }
  const setMode = (m) => {
    mode = m
    replayBtn.classList.toggle('active', m === 'replay')
    liveBtn.classList.toggle('active', m === 'live')
    document.querySelector('.transport').style.opacity = m === 'live' ? 0.4 : 1
    startSource()
  }
  replayBtn.onclick = () => setMode('replay')
  liveBtn.onclick = () => setMode('live')

  // honour ?mode=live
  const urlMode = new URLSearchParams(location.search).get('mode')
  if (urlMode === 'live') setMode('live')
}

function labelFor(text, cls = '') {
  const el = document.createElement('div')
  el.className = 'label3d ' + cls
  el.textContent = text
  return new CSS2DObject(el)
}

function hideLoader() {
  const l = document.getElementById('loader')
  if (l) l.classList.add('hidden')
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  labelRenderer.setSize(window.innerWidth, window.innerHeight)
})

fetchLatestEvents().then((events) => {
  window.__events = events
  boot()
})

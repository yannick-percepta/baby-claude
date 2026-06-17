// The underwater stage: gradient water, fog for depth, animated caustic light,
// a sandy seabed, drifting bubble/plankton particles, and god-rays. Returns the
// pieces main.js wires together plus an update(dt, elapsed) for ambient motion.

import * as THREE from 'three'

export function createReef(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.35

  const scene = new THREE.Scene()
  // bright, sunny, shallow-reef turquoise — playful "Baby Shark" water
  scene.background = new THREE.Color(0x4fc4e6)
  scene.fog = new THREE.FogExp2(0x6fd4ef, 0.0055)

  const camera = new THREE.PerspectiveCamera(
    55, window.innerWidth / window.innerHeight, 0.1, 600,
  )
  camera.position.set(0, 6, 62)

  // --- Lighting ---------------------------------------------------------- //
  // Bright, cheerful, sunlit shallow water — texture reads, mood stays fun.
  const ambient = new THREE.AmbientLight(0xf3fbff, 1.35)
  scene.add(ambient)

  // a warm sunny hemisphere: sky light above, sandy bounce below
  const hemi = new THREE.HemisphereLight(0xbdf0ff, 0xfff0c4, 0.8)
  scene.add(hemi)

  const sun = new THREE.DirectionalLight(0xfff6e0, 2.2)
  sun.position.set(12, 40, 18)
  scene.add(sun)

  // A moving caustic light that sweeps the floor — fakes refracted sunlight.
  const caustic = new THREE.PointLight(0xfdffff, 1.1, 200, 1.4)
  caustic.position.set(0, 30, 10)
  scene.add(caustic)

  // playful candy-coloured fill from the sides
  const rimA = new THREE.PointLight(0xffb3d9, 0.35, 260)
  rimA.position.set(-50, 12, -30)
  scene.add(rimA)
  const rimB = new THREE.PointLight(0x9affd6, 0.32, 260)
  rimB.position.set(50, 8, -30)
  scene.add(rimB)

  // --- Seabed ------------------------------------------------------------ //
  const floorGeo = new THREE.PlaneGeometry(400, 400, 80, 80)
  // gentle dunes
  const pos = floorGeo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i)
    pos.setZ(i, Math.sin(x * 0.05) * 1.6 + Math.cos(y * 0.06) * 1.4)
  }
  floorGeo.computeVertexNormals()
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xf2e2b0, roughness: 1, metalness: 0, // bright sandy seabed
  })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -16
  scene.add(floor)

  // Caustic projection on the floor (animated additive texture).
  const causticTex = makeCausticTexture()
  const causticMat = new THREE.MeshBasicMaterial({
    map: causticTex, transparent: true, opacity: 0.18,
    blending: THREE.AdditiveBlending, depthWrite: false,
  })
  const causticPlane = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), causticMat)
  causticPlane.rotation.x = -Math.PI / 2
  causticPlane.position.y = -15.6
  scene.add(causticPlane)

  // --- Coral "stations" backdrop ---------------------------------------- //
  scene.add(makeCoralField())

  // --- God rays (additive cones from the surface) ------------------------ //
  const rays = makeGodRays()
  scene.add(rays)

  // --- Particles (bubbles / plankton drifting up) ------------------------ //
  const particles = makeParticles()
  scene.add(particles.points)

  // --- Surface shimmer overhead ------------------------------------------ //
  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshBasicMaterial({
      color: 0x9fe6ff, transparent: true, opacity: 0.08,
      side: THREE.DoubleSide, depthWrite: false,
    }),
  )
  surface.rotation.x = -Math.PI / 2
  surface.position.y = 46
  scene.add(surface)

  function update(dt, elapsed) {
    causticTex.offset.x = (elapsed * 0.012) % 1
    causticTex.offset.y = (elapsed * 0.008) % 1
    causticMat.opacity = 0.14 + Math.sin(elapsed * 0.6) * 0.05
    caustic.position.x = Math.sin(elapsed * 0.25) * 24
    caustic.position.z = 10 + Math.cos(elapsed * 0.2) * 14
    particles.update(dt)
    rays.children.forEach((c, i) => {
      c.material.opacity = 0.05 + Math.abs(Math.sin(elapsed * 0.3 + i)) * 0.05
    })
  }

  return { renderer, scene, camera, update, sun, caustic }
}

// ---- helpers ------------------------------------------------------------ //

function makeCausticTexture() {
  const s = 256
  const cvs = document.createElement('canvas')
  cvs.width = cvs.height = s
  const ctx = cvs.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, s, s)
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * s, y = Math.random() * s
    const r = 18 + Math.random() * 40
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(190,240,255,0.55)')
    g.addColorStop(1, 'rgba(190,240,255,0)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  }
  const tex = new THREE.CanvasTexture(cvs)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(6, 6)
  return tex
}

function makeCoralField() {
  const group = new THREE.Group()
  const colors = [0xff85b5, 0xffc94d, 0x5fe0ff, 0xc585ff, 0x7dffb0, 0xff9e6b]
  for (let i = 0; i < 32; i++) {
    const ang = (i / 32) * Math.PI * 2
    const rad = 56 + Math.random() * 44
    const h = 4 + Math.random() * 14
    const geo = new THREE.ConeGeometry(1.4 + Math.random() * 2.5, h, 6)
    const mat = new THREE.MeshStandardMaterial({
      color: colors[i % colors.length], roughness: 0.6,
      emissive: colors[i % colors.length], emissiveIntensity: 0.28,
    })
    const m = new THREE.Mesh(geo, mat)
    m.position.set(Math.cos(ang) * rad, -16 + h / 2, Math.sin(ang) * rad - 10)
    m.rotation.z = (Math.random() - 0.5) * 0.3
    group.add(m)
  }
  return group
}

function makeGodRays() {
  const group = new THREE.Group()
  for (let i = 0; i < 7; i++) {
    const geo = new THREE.ConeGeometry(10, 70, 16, 1, true)
    const mat = new THREE.MeshBasicMaterial({
      color: 0xaef0ff, transparent: true, opacity: 0.07,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
    })
    const cone = new THREE.Mesh(geo, mat)
    cone.position.set(-50 + i * 16 + Math.random() * 8, 26, -20 + Math.random() * 20)
    cone.rotation.z = (Math.random() - 0.5) * 0.2
    group.add(cone)
  }
  return group
}

function makeParticles() {
  const N = 700
  const geo = new THREE.BufferGeometry()
  const pos = new Float32Array(N * 3)
  const vel = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 180
    pos[i * 3 + 1] = (Math.random() - 0.5) * 70
    pos[i * 3 + 2] = (Math.random() - 0.5) * 120
    vel[i] = 1 + Math.random() * 3
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const mat = new THREE.PointsMaterial({
    color: 0xcdfaff, size: 0.5, transparent: true, opacity: 0.5,
    depthWrite: false, blending: THREE.AdditiveBlending,
  })
  const points = new THREE.Points(geo, mat)
  function update(dt) {
    const p = geo.attributes.position
    for (let i = 0; i < N; i++) {
      let y = p.getY(i) + vel[i] * dt
      if (y > 40) y = -34
      p.setY(i, y)
      p.setX(i, p.getX(i) + Math.sin((y + i) * 0.1) * 0.01)
    }
    p.needsUpdate = true
  }
  return { points, update }
}

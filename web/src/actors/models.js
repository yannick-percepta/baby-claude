// Loads the single shark glTF once (embedded geometry + texture + Swim/Bite
// animations) and stamps out independent, individually-animated instances via
// SkeletonUtils.clone (required for skinned meshes).

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'

let _gltf = null

export async function loadSharkAsset(url = '/models/shark.gltf') {
  if (_gltf) return _gltf
  const loader = new GLTFLoader()
  _gltf = await loader.loadAsync(url)
  return _gltf
}

// Returns { model, mixer, clips } where model is a fresh clone centred at its
// own origin and normalised so its longest dimension == `length`.
export function makeSharkInstance(gltf, length = 8) {
  const model = skeletonClone(gltf.scene)

  // Normalise scale + recentre on the model's bounding-box centre.
  const box = new THREE.Box3().setFromObject(model)
  const size = new THREE.Vector3()
  const center = new THREE.Vector3()
  box.getSize(size)
  box.getCenter(center)
  const maxDim = Math.max(size.x, size.y, size.z) || 1
  const s = length / maxDim
  model.scale.setScalar(s)
  model.position.sub(center.multiplyScalar(s))

  const mixer = new THREE.AnimationMixer(model)
  return { model, mixer, clips: gltf.animations, baseSize: size.clone() }
}

export function findClip(clips, name) {
  return clips.find((c) => c.name.toLowerCase().includes(name.toLowerCase())) || clips[0]
}

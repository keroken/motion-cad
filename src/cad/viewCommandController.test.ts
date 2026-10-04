import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { ViewCommandController } from './viewCommandController'

test('moving the left hand toward the device zooms toward the target', () => {
  const camera = new THREE.PerspectiveCamera()
  camera.position.set(0, 0, 10)
  const target = new THREE.Vector3()
  const controller = new ViewCommandController()
  controller.apply({ type: 'view-start', position: [0, 200, 0] }, camera, target)
  controller.apply({ type: 'view-change', position: [0, 200, -100] }, camera, target)
  assert.ok(camera.position.distanceTo(target) < 10)
})

test('moving the left hand sideways orbits without changing distance', () => {
  const camera = new THREE.PerspectiveCamera()
  camera.position.set(0, 0, 10)
  const target = new THREE.Vector3()
  const controller = new ViewCommandController()
  controller.apply({ type: 'view-start', position: [0, 200, 0] }, camera, target)
  controller.apply({ type: 'view-change', position: [100, 200, 0] }, camera, target)
  assert.ok(Math.abs(camera.position.distanceTo(target) - 10) < 1e-9)
  assert.notEqual(camera.position.x, 0)
})

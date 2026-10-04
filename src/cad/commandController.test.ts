import assert from 'node:assert/strict'
import test from 'node:test'
import { CadCommandController, INITIAL_CAD_STATE } from './commandController'
import type { Vec3 } from '../types'

const toTracking = ([x, y, z]: Vec3): Vec3 => [x * 80, y * 80 + 180, z * 80 - 40]

test('stretches the positive X face while anchoring the negative face', () => {
  const controller = new CadCommandController()
  const acquired = controller.apply({ type: 'flat-palm-start', handId: 1, position: toTracking([0.65, 0.4, 0]), normal: [-1, 0, 0] }, INITIAL_CAD_STATE)
  const resized = controller.apply({ type: 'flat-palm-move', handId: 1, position: toTracking([0.9, 0.4, 0]), normal: [-1, 0, 0] }, acquired)
  assert.deepEqual(resized.size, [1.55, 1.3, 1.3])
  assert.deepEqual(resized.position, [0.125, 0.4, 0])
})

test('stretches the negative Z face while anchoring the positive face', () => {
  const controller = new CadCommandController()
  const acquired = controller.apply({ type: 'flat-palm-start', handId: 2, position: toTracking([0, 0.4, -0.65]), normal: [0, 0, 1] }, INITIAL_CAD_STATE)
  const resized = controller.apply({ type: 'flat-palm-move', handId: 2, position: toTracking([0, 0.4, -0.95]), normal: [0, 0, 1] }, acquired)
  assert.ok(Math.abs(resized.size[2] - 1.6) < 1e-9)
  assert.ok(Math.abs(resized.position[2] + 0.15) < 1e-9)
})

test('clamps dimensions without moving the anchored face', () => {
  const controller = new CadCommandController()
  const acquired = controller.apply({ type: 'flat-palm-start', handId: 3, position: toTracking([0.65, 0.4, 0]), normal: [-1, 0, 0] }, INITIAL_CAD_STATE)
  const resized = controller.apply({ type: 'flat-palm-move', handId: 3, position: toTracking([-2, 0.4, 0]), normal: [-1, 0, 0] }, acquired)
  assert.equal(resized.size[0], 0.3)
  assert.equal(resized.position[0], -0.5)
})

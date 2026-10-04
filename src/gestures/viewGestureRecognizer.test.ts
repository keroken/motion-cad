import assert from 'node:assert/strict'
import test from 'node:test'
import { ViewGestureRecognizer } from './viewGestureRecognizer'
import type { TrackedHand, Vec3 } from '../types'

const hand = (id: number, type: 'left' | 'right', palm: Vec3, pinchStrength = 0.9): TrackedHand => ({
  id, type, palm, palmNormal: [0, -1, 0], pinchStrength, grabStrength: 0,
  joints: { wrist: [], thumb: [], index: [], middle: [], ring: [], pinky: [] },
})

test('only a left-hand pinch enters view mode', () => {
  const recognizer = new ViewGestureRecognizer()
  assert.deepEqual(recognizer.update([hand(2, 'right', [100, 200, 0])]), [])
  const events = recognizer.update([hand(1, 'left', [-100, 200, 0])])
  assert.deepEqual(events, [{ type: 'view-start', position: [-100, 200, 0] }])
})

test('releasing the left pinch exits view mode even with the right hand present', () => {
  const recognizer = new ViewGestureRecognizer()
  recognizer.update([hand(1, 'left', [-100, 200, 0]), hand(2, 'right', [100, 200, 0])])
  assert.deepEqual(recognizer.update([hand(1, 'left', [-100, 200, 0], 0.2), hand(2, 'right', [100, 200, 0])]), [{ type: 'view-end' }])
})

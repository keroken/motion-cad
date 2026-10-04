import assert from 'node:assert/strict'
import test from 'node:test'
import { GestureRecognizer } from './gestureRecognizer'
import type { TrackedHand, Vec3 } from '../types'

function handWithFingerGap(gap: number): TrackedHand {
  const chain = (tip: Vec3): Vec3[] => [[0, 0, 0], tip]
  return {
    id: 10,
    type: 'right',
    palm: [0, 180, 0],
    palmNormal: [0, -1, 0],
    pinchStrength: 0,
    grabStrength: 0.08,
    joints: {
      wrist: [[0, 140, 0], [0, 180, 0]],
      thumb: chain([-35, 190, 0]),
      index: chain([-1.5 * gap, 260, 0]),
      middle: chain([-0.5 * gap, 268, 0]),
      ring: chain([0.5 * gap, 264, 0]),
      pinky: chain([1.5 * gap, 252, 0]),
    },
  }
}

test('surface mode starts only when adjacent fingers are tightly together', () => {
  const recognizer = new GestureRecognizer()
  assert.equal(recognizer.update([handWithFingerGap(34)]).some((event) => event.type === 'flat-palm-start'), false)
  assert.equal(recognizer.update([handWithFingerGap(24)]).some((event) => event.type === 'flat-palm-start'), true)
})

test('surface mode releases immediately when fingers spread', () => {
  const recognizer = new GestureRecognizer()
  recognizer.update([handWithFingerGap(24)])
  const events = recognizer.update([handWithFingerGap(44)])
  assert.equal(events.some((event) => event.type === 'flat-palm-end'), true)
  assert.equal(events.some((event) => event.type === 'flat-palm-move'), false)
})

import type { TrackedHand, Vec3 } from '../types'

export type GestureEvent =
  | { type: 'pinch-start'; handId: number; position: Vec3 }
  | { type: 'pinch-move'; handId: number; position: Vec3 }
  | { type: 'pinch-end'; handId: number; position: Vec3 }
  | { type: 'flat-palm-start'; handId: number; position: Vec3; normal: Vec3 }
  | { type: 'flat-palm-move'; handId: number; position: Vec3; normal: Vec3 }
  | { type: 'flat-palm-end'; handId: number; position: Vec3; normal: Vec3 }

export class GestureRecognizer {
  private pinching = new Set<number>()
  private flatPalming = new Set<number>()
  private suppressed = new Set<number>()
  private readonly startThreshold = 0.78
  private readonly endThreshold = 0.58
  private readonly flatGrabStart = 0.16
  private readonly flatGrabEnd = 0.34
  private readonly fingersTogetherStartMm = 28
  private readonly fingersTogetherReleaseMm = 36

  private tipDistance(a: TrackedHand['joints']['index'], b: TrackedHand['joints']['index']): number {
    const first = a.at(-1)
    const second = b.at(-1)
    if (!first || !second) return Number.POSITIVE_INFINITY
    return Math.hypot(first[0] - second[0], first[1] - second[1], first[2] - second[2])
  }

  private fingersTogether(hand: TrackedHand, threshold: number): boolean {
    const { index, middle, ring, pinky } = hand.joints
    return this.tipDistance(index, middle) <= threshold
      && this.tipDistance(middle, ring) <= threshold
      && this.tipDistance(ring, pinky) <= threshold
  }

  suppressUntilNeutral(hands: TrackedHand[]) {
    this.pinching.clear()
    this.flatPalming.clear()
    for (const hand of hands) this.suppressed.add(hand.id)
  }

  update(hands: TrackedHand[]): GestureEvent[] {
    const events: GestureEvent[] = []
    const visible = new Set(hands.map((hand) => hand.id))
    for (const hand of hands) {
      if (this.suppressed.has(hand.id)) {
        const neutral = hand.pinchStrength <= this.endThreshold
          && !this.fingersTogether(hand, this.fingersTogetherReleaseMm)
        if (neutral) this.suppressed.delete(hand.id)
        else continue
      }
      const position = hand.joints.index.at(-1) ?? hand.palm
      const active = this.pinching.has(hand.id)
      if (!active && hand.pinchStrength >= this.startThreshold) {
        this.pinching.add(hand.id)
        events.push({ type: 'pinch-start', handId: hand.id, position })
      } else if (active && hand.pinchStrength <= this.endThreshold) {
        this.pinching.delete(hand.id)
        events.push({ type: 'pinch-end', handId: hand.id, position })
      } else if (active) events.push({ type: 'pinch-move', handId: hand.id, position })

      const palmActive = this.flatPalming.has(hand.id)
      const startsFlat = hand.grabStrength <= this.flatGrabStart
        && this.fingersTogether(hand, this.fingersTogetherStartMm)
      const staysFlat = hand.grabStrength <= this.flatGrabEnd
        && this.fingersTogether(hand, this.fingersTogetherReleaseMm)
      if (!palmActive && startsFlat) {
        this.flatPalming.add(hand.id)
        events.push({ type: 'flat-palm-start', handId: hand.id, position: hand.palm, normal: hand.palmNormal })
      } else if (palmActive && !staysFlat) {
        this.flatPalming.delete(hand.id)
        events.push({ type: 'flat-palm-end', handId: hand.id, position: hand.palm, normal: hand.palmNormal })
      } else if (palmActive) {
        events.push({ type: 'flat-palm-move', handId: hand.id, position: hand.palm, normal: hand.palmNormal })
      }
    }
    for (const id of this.pinching) if (!visible.has(id)) {
      this.pinching.delete(id)
      events.push({ type: 'pinch-end', handId: id, position: [0, 0, 0] })
    }
    for (const id of this.flatPalming) if (!visible.has(id)) {
      this.flatPalming.delete(id)
      events.push({ type: 'flat-palm-end', handId: id, position: [0, 0, 0], normal: [0, -1, 0] })
    }
    for (const id of this.suppressed) if (!visible.has(id)) this.suppressed.delete(id)
    return events
  }
}

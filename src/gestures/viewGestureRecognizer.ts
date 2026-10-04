import type { TrackedHand, Vec3 } from '../types'

export type ViewGestureEvent =
  | { type: 'view-start'; position: Vec3 }
  | { type: 'view-change'; position: Vec3 }
  | { type: 'view-end' }

export class ViewGestureRecognizer {
  private active = false
  private readonly startThreshold = 0.78
  private readonly endThreshold = 0.58

  update(hands: TrackedHand[]): ViewGestureEvent[] {
    const left = hands.find((hand) => hand.type === 'left')
    if (!left || left.pinchStrength <= this.endThreshold) {
      if (!this.active) return []
      this.active = false
      return [{ type: 'view-end' }]
    }
    if (!this.active && left.pinchStrength < this.startThreshold) return []
    const type: 'view-start' | 'view-change' = this.active ? 'view-change' : 'view-start'
    this.active = true
    return [{ type, position: left.palm }]
  }
}

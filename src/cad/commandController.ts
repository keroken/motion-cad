import * as THREE from 'three'
import type { GestureEvent } from '../gestures/gestureRecognizer'
import type { Vec3 } from '../types'

export type Axis = 0 | 1 | 2
export type ResizeHandle = { axis: Axis; sign: -1 | 1 }
export type CadOperation = 'idle' | 'move' | 'resize'
export type CadState = {
  selected: boolean
  position: Vec3
  size: Vec3
  activeHand: number | null
  operation: CadOperation
  activeHandle: ResizeHandle | null
}

export const INITIAL_CAD_STATE: CadState = {
  selected: false,
  position: [0, 0.4, 0],
  size: [1.3, 1.3, 1.3],
  activeHand: null,
  operation: 'idle',
  activeHandle: null,
}

export function trackingToWorld(position: Vec3): THREE.Vector3 {
  return new THREE.Vector3(position[0] / 80, (position[1] - 180) / 80, (position[2] + 40) / 80)
}

export class CadCommandController {
  private grabOffset = new THREE.Vector3()
  private dragStart = new THREE.Vector3()
  private startPosition = new THREE.Vector3()
  private startSize = new THREE.Vector3()
  private resizeHandle: ResizeHandle | null = null
  private readonly bodyPadding = 0.32
  private readonly planeAcquireDepth = 0.85
  private readonly planeEdgePadding = 0.5
  private readonly minimumSize = 0.3

  private planeFromPalm(hand: THREE.Vector3, normal: Vec3, state: CadState): ResizeHandle | null {
    const worldNormal = new THREE.Vector3(...normal).normalize()
    const components = [Math.abs(worldNormal.x), Math.abs(worldNormal.y), Math.abs(worldNormal.z)]
    const axis = components.indexOf(Math.max(...components)) as Axis
    const sign: -1 | 1 = hand.getComponent(axis) >= state.position[axis] ? 1 : -1
    const faceCoordinate = state.position[axis] + state.size[axis] * 0.5 * sign
    if (Math.abs(hand.getComponent(axis) - faceCoordinate) > this.planeAcquireDepth) return null
    for (const tangent of [0, 1, 2] as Axis[]) {
      if (tangent === axis) continue
      if (Math.abs(hand.getComponent(tangent) - state.position[tangent]) > state.size[tangent] * 0.5 + this.planeEdgePadding) return null
    }
    return { axis, sign }
  }

  private isNearBody(hand: THREE.Vector3, state: CadState): boolean {
    return state.position.every((center, axis) =>
      Math.abs(hand.getComponent(axis) - center) <= state.size[axis] * 0.5 + this.bodyPadding)
  }

  private beginResize(hand: THREE.Vector3, handle: ResizeHandle, event: GestureEvent, state: CadState): CadState {
    this.dragStart.copy(hand)
    this.startPosition.set(...state.position)
    this.startSize.set(...state.size)
    this.resizeHandle = handle
    return { ...state, selected: true, activeHand: event.handId, operation: 'resize', activeHandle: handle }
  }

  private resize(hand: THREE.Vector3, state: CadState): CadState {
    if (!this.resizeHandle) return state
    const { axis, sign } = this.resizeHandle
    const requestedDelta = hand.getComponent(axis) - this.dragStart.getComponent(axis)
    const requestedSize = this.startSize.getComponent(axis) + requestedDelta * sign
    const effectiveDelta = requestedSize < this.minimumSize
      ? (this.minimumSize - this.startSize.getComponent(axis)) / sign
      : requestedDelta
    const nextSize = this.startSize.clone()
    const nextPosition = this.startPosition.clone()
    nextSize.setComponent(axis, Math.max(this.minimumSize, requestedSize))
    nextPosition.setComponent(axis, this.startPosition.getComponent(axis) + effectiveDelta * 0.5)
    return { ...state, size: nextSize.toArray() as Vec3, position: nextPosition.toArray() as Vec3 }
  }

  apply(event: GestureEvent, state: CadState): CadState {
    const hand = trackingToWorld(event.position)
    if (event.type === 'flat-palm-start') {
      const plane = this.planeFromPalm(hand, event.normal, state)
      return plane ? this.beginResize(hand, plane, event, state) : state
    }
    if (event.type === 'pinch-start') {
      if (this.isNearBody(hand, state)) {
        this.resizeHandle = null
        this.grabOffset.set(...state.position).sub(hand)
        return {
          ...state,
          selected: true,
          activeHand: event.handId,
          operation: 'move',
          activeHandle: null,
        }
      }
    }
    if (event.type === 'flat-palm-move') {
      if (state.activeHand === null) {
        const plane = this.planeFromPalm(hand, event.normal, state)
        return plane ? this.beginResize(hand, plane, event, state) : state
      }
      if (state.activeHand === event.handId && state.operation === 'resize') return this.resize(hand, state)
    }
    if (event.type === 'pinch-move' && state.activeHand === event.handId) {
      if (state.operation === 'move') {
        hand.add(this.grabOffset)
        const floorHeight = -0.28 + state.size[1] * 0.5
        return { ...state, position: [hand.x, Math.max(floorHeight, hand.y), hand.z] }
      }
    }
    if ((event.type === 'pinch-end' || event.type === 'flat-palm-end') && state.activeHand === event.handId) {
      this.resizeHandle = null
      return { ...state, activeHand: null, operation: 'idle', activeHandle: null }
    }
    return state
  }
}

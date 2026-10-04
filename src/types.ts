export type Vec3 = [number, number, number]

export type JointName = 'wrist' | 'thumb' | 'index' | 'middle' | 'ring' | 'pinky'

export interface TrackedHand {
  id: number
  type: 'left' | 'right'
  palm: Vec3
  palmNormal: Vec3
  pinchStrength: number
  grabStrength: number
  joints: Record<JointName, Vec3[]>
}

export interface TrackingFrame {
  type: 'frame'
  id: number
  timestamp: number
  fps: number
  hands: TrackedHand[]
}

export interface BridgeStatus {
  type: 'status'
  bridge: 'connected' | 'disconnected'
  service: 'connected' | 'connecting' | 'disconnected' | 'error'
  message?: string
}

export type BridgeMessage = TrackingFrame | BridgeStatus

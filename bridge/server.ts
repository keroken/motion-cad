import { WebSocket, WebSocketServer } from 'ws'
import type { RawData } from 'ws'
import { spawn, type ChildProcess } from 'node:child_process'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const BRIDGE_PORT = Number(process.env.BRIDGE_PORT ?? 8081)
const LEAP_URL = process.env.LEAP_URL ?? 'ws://127.0.0.1:6437/v7.json'

type Vec3 = [number, number, number]
type LeapBone = { prevJoint?: Vec3; nextJoint?: Vec3 }
type LeapPointable = { handId: number; type: number; btipPosition?: Vec3; bones?: LeapBone[] }
type LeapHand = {
  id: number; type: 'left' | 'right'; palmPosition: Vec3
  palmNormal?: Vec3; pinchStrength?: number; grabStrength?: number; wrist?: Vec3
}
type LeapFrame = { id?: number; timestamp?: number; currentFrameRate?: number; hands?: LeapHand[]; pointables?: LeapPointable[] }

const clients = new Set<WebSocket>()
const server = new WebSocketServer({ port: BRIDGE_PORT })
let leap: WebSocket | undefined
let native: ChildProcess | undefined
let retryTimer: NodeJS.Timeout | undefined
let serviceState: 'connected' | 'connecting' | 'disconnected' | 'error' = 'disconnected'

function broadcast(payload: unknown) {
  const message = JSON.stringify(payload)
  for (const client of clients) if (client.readyState === WebSocket.OPEN) client.send(message)
}

function status(message?: string) {
  broadcast({ type: 'status', bridge: 'connected', service: serviceState, message })
}

function fingerJoints(pointable: LeapPointable): Vec3[] {
  const bones = pointable.bones ?? []
  if (!bones.length) return pointable.btipPosition ? [pointable.btipPosition] : []
  const first = bones[0]?.prevJoint
  return [...(first ? [first] : []), ...bones.flatMap((bone) => bone.nextJoint ? [bone.nextJoint] : [])]
}

function normalize(frame: LeapFrame) {
  const pointables = frame.pointables ?? []
  return {
    type: 'frame', id: frame.id ?? 0, timestamp: frame.timestamp ?? Date.now() * 1000,
    fps: frame.currentFrameRate ?? 0,
    hands: (frame.hands ?? []).map((hand) => {
      const fingers = pointables.filter((p) => p.handId === hand.id)
      const at = (type: number) => fingerJoints(fingers.find((p) => p.type === type) ?? { handId: hand.id, type })
      return {
        id: hand.id, type: hand.type, palm: hand.palmPosition,
        palmNormal: hand.palmNormal ?? [0, -1, 0],
        pinchStrength: hand.pinchStrength ?? 0, grabStrength: hand.grabStrength ?? 0,
        joints: {
          wrist: hand.wrist ? [hand.wrist, hand.palmPosition] : [hand.palmPosition],
          thumb: at(0), index: at(1), middle: at(2), ring: at(3), pinky: at(4),
        },
      }
    }),
  }
}

function connectToLegacyWebSocket() {
  clearTimeout(retryTimer)
  serviceState = 'connecting'
  status(`Connecting to ${LEAP_URL}`)
  leap = new WebSocket(LEAP_URL)
  leap.on('open', () => {
    serviceState = 'connected'
    leap?.send(JSON.stringify({ enableGestures: false }))
    status('Ultraleap tracking service connected')
  })
  leap.on('message', (data: RawData) => {
    try { broadcast(normalize(JSON.parse(data.toString()) as LeapFrame)) }
    catch (error) { console.warn('Ignored malformed tracking frame:', error) }
  })
  leap.on('error', (error) => {
    serviceState = 'error'
    status(`Tracking service error: ${error.message}`)
  })
  leap.on('close', () => {
    serviceState = 'disconnected'
    status('Tracking service unavailable; retrying')
    retryTimer = setTimeout(connectToLegacyWebSocket, 2000)
  })
}

function connectToNativeSdk() {
  const here = dirname(fileURLToPath(import.meta.url))
  const helper = process.env.LEAP_NATIVE_HELPER ?? resolve(here, 'bin/leap_bridge')
  serviceState = 'connecting'
  status('Starting LeapC native tracking adapter')
  const child = spawn(helper, [], { stdio: ['ignore', 'pipe', 'pipe'] })
  native = child
  const frames = createInterface({ input: child.stdout })
  frames.on('line', (line) => {
    try {
      const frame = JSON.parse(line) as Record<string, unknown>
      frame.timestamp = Date.now() * 1000
      if (serviceState !== 'connected') {
        serviceState = 'connected'
        status('Ultraleap device streaming through LeapC')
      }
      broadcast(frame)
    } catch (error) { console.warn('Ignored malformed native frame:', error) }
  })
  child.stderr.on('data', (chunk) => {
    const message = chunk.toString().trim()
    if (!message) return
    console.log(`[LeapC] ${message}`)
    if (message.includes('service connected') || message.includes('device connected')) {
      serviceState = 'connected'
      status(message)
    } else if (message.includes('lost') || message.includes('disconnected')) {
      serviceState = 'disconnected'
      status(message)
    }
  })
  child.on('error', (error) => {
    console.warn(`Native tracking adapter unavailable: ${error.message}; using WebSocket fallback`)
    connectToLegacyWebSocket()
  })
  child.on('exit', (code) => {
    if (code !== null && code !== 0) {
      serviceState = 'error'
      status(`Native adapter exited (${code}); retrying`)
      retryTimer = setTimeout(connectToNativeSdk, 2000)
    }
  })
}

server.on('connection', (socket) => {
  clients.add(socket)
  socket.send(JSON.stringify({ type: 'status', bridge: 'connected', service: serviceState }))
  socket.on('close', () => clients.delete(socket))
})

server.on('listening', () => console.log(`Motion CAD bridge listening on ws://127.0.0.1:${BRIDGE_PORT}`))
if (process.env.LEAP_SOURCE === 'websocket') connectToLegacyWebSocket()
else connectToNativeSdk()

function shutdown() {
  clearTimeout(retryTimer)
  native?.kill('SIGTERM')
  leap?.close()
  server.close()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

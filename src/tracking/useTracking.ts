import { useEffect, useRef, useState } from 'react'
import type { BridgeMessage, BridgeStatus, TrackingFrame } from '../types'

const INITIAL_STATUS: BridgeStatus = { type: 'status', bridge: 'disconnected', service: 'disconnected' }

const defaultBridgeUrl = `ws://${window.location.hostname || '127.0.0.1'}:8081`

export function useTracking(url = defaultBridgeUrl) {
  const [frame, setFrame] = useState<TrackingFrame | null>(null)
  const [status, setStatus] = useState<BridgeStatus>(INITIAL_STATUS)
  const [latency, setLatency] = useState(0)
  const reconnect = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    let closed = false
    let socket: WebSocket
    const connect = () => {
      setStatus((old) => ({ ...old, bridge: 'disconnected', message: 'Connecting to local bridge…' }))
      socket = new WebSocket(url)
      socket.onopen = () => setStatus((old) => ({ ...old, bridge: 'connected' }))
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data) as BridgeMessage
        if (message.type === 'status') setStatus(message)
        else {
          setFrame(message)
          setLatency(Math.max(0, Date.now() - message.timestamp / 1000))
        }
      }
      socket.onerror = () => setStatus({ ...INITIAL_STATUS, message: 'Local bridge is not running' })
      socket.onclose = () => {
        setStatus((old) => ({ ...old, bridge: 'disconnected' }))
        if (!closed) reconnect.current = setTimeout(connect, 1500)
      }
    }
    connect()
    return () => { closed = true; clearTimeout(reconnect.current); socket?.close() }
  }, [url])

  return { frame, status, latency }
}

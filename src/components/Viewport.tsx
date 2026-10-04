import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls as ThreeOrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { TrackingFrame, Vec3 } from '../types'
import { GestureRecognizer } from '../gestures/gestureRecognizer'
import { CadCommandController, INITIAL_CAD_STATE, trackingToWorld, type Axis, type CadState } from '../cad/commandController'
import { ViewGestureRecognizer } from '../gestures/viewGestureRecognizer'
import { ViewCommandController } from '../cad/viewCommandController'

function BoneLine({ points, color }: { points: Vec3[]; color: string }) {
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map((point) => trackingToWorld(point)))
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 })
    return new THREE.Line(geometry, material)
  }, [points, color])
  useEffect(() => () => {
    line.geometry.dispose()
    ;(line.material as THREE.Material).dispose()
  }, [line])
  return <primitive object={line} />
}

function Hand({ frame }: { frame: TrackingFrame | null }) {
  const hands = frame?.hands ?? []
  return <>{hands.map((hand) => {
    const color = hand.type === 'left' ? '#56c7ff' : '#f4b45f'
    return <group key={hand.id}>
      {Object.values(hand.joints).map((chain, i) => {
        const points = chain.map((point) => trackingToWorld(point).toArray() as Vec3)
        return points.length > 1 ? <BoneLine key={i} points={points} color={color} /> : null
      })}
      {Object.values(hand.joints).flat().map((point, i) => <mesh position={trackingToWorld(point)} key={i}>
        <sphereGeometry args={[0.045, 10, 10]} /><meshBasicMaterial color={color} />
      </mesh>)}
      <mesh position={trackingToWorld(hand.palm)}><sphereGeometry args={[0.11, 16, 16]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} /></mesh>
    </group>
  })}</>
}

const HANDLES: Array<{ axis: Axis; sign: -1 | 1; color: string }> = [
  { axis: 0, sign: -1, color: '#ef646b' }, { axis: 0, sign: 1, color: '#ef646b' },
  { axis: 1, sign: -1, color: '#67db96' }, { axis: 1, sign: 1, color: '#67db96' },
  { axis: 2, sign: -1, color: '#61adf0' }, { axis: 2, sign: 1, color: '#61adf0' },
]

function ResizePlanes({ cad }: { cad: CadState }) {
  return <group position={cad.position}>
    {HANDLES.map(({ axis, sign, color }) => {
      const position: Vec3 = [0, 0, 0]
      position[axis] = cad.size[axis] * 0.5 * sign
      const active = cad.activeHandle?.axis === axis && cad.activeHandle.sign === sign
      const scale: Vec3 = cad.size.map((value, dimension) => dimension === axis ? 0.035 : value * 0.62) as Vec3
      if (active) scale[axis] = 0.08
      return <mesh key={`${axis}:${sign}`} position={position} scale={scale}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={color} transparent opacity={active ? 0.85 : 0.22} emissive={color} emissiveIntensity={active ? 1.1 : 0.2} depthWrite={false} />
      </mesh>
    })}
  </group>
}

function Scene({ frame, onCadState }: { frame: TrackingFrame | null; onCadState: (state: CadState) => void }) {
  const [cad, setCad] = useState<CadState>(INITIAL_CAD_STATE)
  const recognizer = useMemo(() => new GestureRecognizer(), [])
  const viewRecognizer = useMemo(() => new ViewGestureRecognizer(), [])
  const commands = useMemo(() => new CadCommandController(), [])
  const viewCommands = useMemo(() => new ViewCommandController(), [])
  const box = useRef<THREE.Mesh>(null)
  const lastFrame = useRef<number>(-1)
  const { camera, gl } = useThree()
  const controls = useMemo(() => {
    const next = new ThreeOrbitControls(camera, gl.domElement)
    next.enableDamping = true
    next.dampingFactor = 0.08
    next.minDistance = 3
    next.maxDistance = 15
    next.target.set(0, 0.4, 0)
    return next
  }, [camera, gl])

  useEffect(() => onCadState(cad), [cad, onCadState])
  useEffect(() => () => controls.dispose(), [controls])
  useFrame(() => {
    controls.update()
    if (!frame || frame.id === lastFrame.current) return
    lastFrame.current = frame.id
    const viewEvents = viewRecognizer.update(frame.hands)
    for (const event of viewEvents) viewCommands.apply(event, camera, controls.target)
    const rightHands = frame.hands.filter((hand) => hand.type === 'right')
    const events = recognizer.update(rightHands)
    if (events.length) setCad((current) => events.reduce((next, event) => commands.apply(event, next), current))
  })

  return <>
    <color attach="background" args={['#080b0f']} />
    <fog attach="fog" args={['#080b0f', 9, 22]} />
    <ambientLight intensity={0.8} />
    <directionalLight position={[4, 8, 4]} intensity={3} color="#d8efff" />
    <pointLight position={[-4, 3, -2]} intensity={25} color="#1f7cff" />
    <gridHelper args={[18, 36, '#38546b', '#18232c']} position={[0, -0.28, 0]} />
    <mesh ref={box} position={cad.position} scale={cad.size}
      onClick={(event) => { event.stopPropagation(); setCad((value) => ({ ...value, selected: true })) }}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={cad.selected ? '#ff9f43' : '#6489a3'} roughness={0.28} metalness={0.55} emissive={cad.activeHand !== null ? '#7d3700' : '#000000'} />
    </mesh>
    {cad.selected && <lineSegments position={cad.position}>
      <edgesGeometry args={[new THREE.BoxGeometry(cad.size[0] + 0.1, cad.size[1] + 0.1, cad.size[2] + 0.1)]} /><lineBasicMaterial color="#ffcb85" />
    </lineSegments>}
    {cad.selected && <ResizePlanes cad={cad} />}
    <Hand frame={frame} />
    <mesh visible={false} onPointerMissed={() => setCad((value) => ({ ...value, selected: false }))} />
  </>
}

export function Viewport({ frame, onCadState }: { frame: TrackingFrame | null; onCadState: (state: CadState) => void }) {
  return <Canvas camera={{ position: [4.4, 3.3, 5.6], fov: 42 }} gl={{ antialias: true }} dpr={[1, 2]}>
    <Scene frame={frame} onCadState={onCadState} />
  </Canvas>
}

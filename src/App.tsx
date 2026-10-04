import { useCallback, useState } from 'react'
import { Viewport } from './components/Viewport'
import { useTracking } from './tracking/useTracking'
import { INITIAL_CAD_STATE, type CadState } from './cad/commandController'
import './styles.css'

function StatusDot({ ok }: { ok: boolean }) { return <span className={`status-dot ${ok ? 'ok' : ''}`} /> }

export default function App() {
  const { frame, status, latency } = useTracking()
  const [cad, setCad] = useState<CadState>(INITIAL_CAD_STATE)
  const updateCad = useCallback((state: CadState) => setCad(state), [])
  const bridgeOk = status.bridge === 'connected'
  const serviceOk = status.service === 'connected'
  const leftHand = frame?.hands.find((hand) => hand.type === 'left')
  const rightHand = frame?.hands.find((hand) => hand.type === 'right')
  const viewMode = (leftHand?.pinchStrength ?? 0) >= 0.58

  return <main>
    <header>
      <div className="brand"><span className="brand-mark">M</span><div><b>MOTION CAD</b><small>SPATIAL WORKSPACE / MVP 01</small></div></div>
      <div className="header-status"><span className={`mode-badge ${viewMode ? 'view' : ''}`}>{viewMode ? 'LEFT VIEW ACTIVE' : leftHand ? 'LEFT VIEW READY' : rightHand ? 'RIGHT OBJECT READY' : 'HANDS READY'}</span><StatusDot ok={serviceOk} />{serviceOk ? 'TRACKING LIVE' : 'TRACKING OFFLINE'}</div>
    </header>
    <section className="workspace">
      <aside className="left-panel panel">
        <p className="eyebrow">CONNECTION</p>
        <h2>Device diagnostics</h2>
        <div className="diag-row"><StatusDot ok={bridgeOk} /><span>Local bridge</span><b>{bridgeOk ? 'ONLINE' : 'OFFLINE'}</b></div>
        <div className="diag-row"><StatusDot ok={serviceOk} /><span>Ultraleap service</span><b>{status.service.toUpperCase()}</b></div>
        <div className="metrics">
          <div><span>HANDS</span><strong>{frame?.hands.length ?? 0}</strong></div>
          <div><span>FPS</span><strong>{Math.round(frame?.fps ?? 0)}</strong></div>
          <div><span>LATENCY</span><strong>{Math.round(latency)}<small>ms</small></strong></div>
        </div>
        <div className={`notice ${serviceOk ? 'success' : ''}`}>
          <span>{serviceOk ? '✓' : '!'}</span>
          <p><b>{serviceOk ? 'Sensor ready' : 'Waiting for sensor'}</b>{status.message ?? (serviceOk ? 'Place both hands above the controller.' : 'Start the bridge and confirm Tracking Service is running.')}</p>
        </div>
        <p className="eyebrow interaction-title">INTERACTION</p>
        <div className="instruction"><span>R1</span><p><b>Right pinch</b>Move the selected box</p></div>
        <div className="instruction"><span>R2</span><p><b>Right flat palm</b>Push or pull a face to resize</p></div>
        <div className="instruction"><span>L1</span><p><b>Left pinch + move</b>Orbit horizontally or vertically</p></div>
        <div className="instruction"><span>L2</span><p><b>Left pinch + depth</b>Move forward or back to zoom</p></div>
      </aside>
      <div className="viewport">
        <Viewport frame={frame} onCadState={updateCad} />
        <div className="view-label"><span>●</span> PERSPECTIVE</div>
        <div className="axis"><i className="x">X</i><i className="y">Y</i><i className="z">Z</i></div>
        {viewMode && <div className="view-mode-hud"><b>LEFT-HAND VIEW CONTROL</b><span>MOVE X / Y TO ORBIT</span><span>MOVE FORWARD / BACK TO ZOOM</span></div>}
        {!serviceOk && <div className="empty-state"><div className="hand-icon">⌁</div><b>Waiting for hands</b><span>Your CAD model is still mouse-selectable.<br />Orbit with drag · Zoom with scroll</span></div>}
      </div>
      <aside className="right-panel panel">
        <p className="eyebrow">INSPECTOR</p>
        <div className="object-title"><span className="cube-icon">◇</span><div><h2>Box 01</h2><small>{cad.selected ? 'SELECTED' : 'SCENE OBJECT'}</small></div></div>
        <p className="section-label">TRANSFORM / POSITION</p>
        {(['X', 'Y', 'Z'] as const).map((axis, i) => <div className="coordinate" key={axis}><label>{axis}</label><span>{cad.position[i].toFixed(2)}</span><em>m</em></div>)}
        <p className="section-label">DIMENSIONS</p>
        {(['W', 'H', 'D'] as const).map((axis, i) => <div className="coordinate" key={axis}><label>{axis}</label><span>{cad.size[i].toFixed(2)}</span><em>m</em></div>)}
        <p className="section-label">GESTURE STATE</p>
        <div className="gesture-state"><span className={viewMode || cad.activeHand !== null ? 'active' : ''}>{viewMode ? 'VIEW CONTROL' : cad.operation === 'resize' ? `RESIZE ${['X', 'Y', 'Z'][cad.activeHandle?.axis ?? 0]}${cad.activeHandle?.sign === -1 ? '−' : '+'}` : cad.operation === 'move' ? 'MOVING' : 'IDLE'}</span><small>{viewMode ? 'LEFT HAND' : cad.activeHand !== null ? 'RIGHT HAND' : 'NO ACTIVE COMMAND'}</small></div>
        <div className="architecture"><p className="section-label">INPUT PIPELINE</p><div>TRACKING <i>→</i> GESTURE <i>→</i> COMMAND</div><small>Decoupled event pipeline</small></div>
      </aside>
    </section>
    <footer><span>Motion CAD <b>v0.1.0</b></span><span>LOCAL SESSION · DATA STAYS ON DEVICE</span></footer>
  </main>
}

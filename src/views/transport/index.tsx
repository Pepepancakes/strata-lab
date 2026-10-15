import { store, useAppState } from '../../app/store'
import type { ViewDefinition } from '../types'

function TransportView() {
  const s = useAppState()
  const n = s.info?.nSteps ?? 0
  const dis = !s.info || !!s.busy
  const age = s.view ? s.view.ageMa : null
  return (
    <div className="transport">
      <div className="row">
        <button disabled={dis} onClick={() => (s.playing ? store.pause() : store.play())} aria-label={s.playing ? 'Pause' : 'Play'}>{s.playing ? '\u275a\u275a Pause' : '\u25b6 Play'}</button>
        <button disabled={dis} onClick={() => store.goto(s.step - 1)} aria-label="Step back">{'\u23ee'} Back</button>
        <button disabled={dis} onClick={() => store.goto(s.step + 1)} aria-label="Step forward">Forward {'\u23ed'}</button>
        <button disabled={dis} onClick={() => store.goto(0)} aria-label="Go to the start">Start</button>
        <button disabled={dis} onClick={() => store.goto(n)} aria-label="Go to the present">Present</button>
        <label className="sub">
          frames per second
          <select value={s.fps} onChange={(e) => store.setFps(Number(e.target.value))} aria-label="Frames per second">
            {[2, 5, 10, 20, 30].map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <label className="sub">
          steps per frame
          <select value={s.stepsPerFrame} onChange={(e) => store.setStepsPerFrame(Number(e.target.value))} aria-label="Steps per frame">
            {[1, 2, 5, 10, 20].map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
      </div>
      <input
        type="range" min={0} max={n} value={s.step} disabled={dis} aria-label="Time"
        style={{ width: '100%' }}
        onChange={(e) => store.goto(Number(e.target.value))}
      />
      <div className="muted" data-testid="time-readout">
        step {s.step} of {n}{age !== null ? ` \u2014 ${age.toFixed(3)} Ma (million years ago)` : ''}
      </div>
    </div>
  )
}

const def: ViewDefinition = { id: 'transport', title: 'Time', region: 'section', order: 1, component: TransportView }
export default def

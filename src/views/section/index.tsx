import { useEffect, useRef, useState } from 'react'
import { store, useAppState } from '../../app/store'
import type { ViewDefinition } from '../types'
import { columnAtFraction, drawSection } from './draw'
import { legendFor, MODES, ramp, viewHasMode } from './colors'

const hex = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`

function Legend({ mode, startAgeMa }: { mode: (typeof MODES)[number]['id']; startAgeMa: number }) {
  const leg = legendFor(mode, startAgeMa)
  const stops = Array.from({ length: 6 }, (_, i) => hex(ramp(mode, i / 5)))
  return (
    <div className="legend" aria-label="Colour legend">
      <span>{leg.low}</span>
      <span className="ramp" style={{ background: `linear-gradient(90deg, ${stops.join(',')})` }} />
      <span>{leg.high}</span>
      <span className="muted">{leg.note}</span>
    </div>
  )
}

function SectionView() {
  const s = useAppState()
  const ref = useRef<HTMLCanvasElement>(null)
  const [widthTick, setWidthTick] = useState(0)

  useEffect(() => {
    const cv = ref.current
    if (!cv || !s.view || !s.extent || !viewHasMode(s.view, s.mode)) return
    const t0 = performance.now()
    drawSection(cv, s.view, { mode: s.mode, wellCol: s.wellCol, extent: s.extent, runLengthMa: s.runLengthMa })
    store.recordDraw(performance.now() - t0)
    cv.dataset.drawnMode = s.mode
    cv.dataset.drawnStep = String(s.view.step)
  }, [s.view, s.mode, s.wellCol, s.extent, s.runLengthMa, widthTick])

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ro = new ResizeObserver(() => setWidthTick((n) => n + 1))
    ro.observe(cv)
    return () => ro.disconnect()
  }, [])

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!s.view) return
    const r = e.currentTarget.getBoundingClientRect()
    store.setWellColumn(columnAtFraction((e.clientX - r.left) / r.width, s.view.nx))
  }

  return (
    <div>
      <div className="row">
        <h2>Section</h2>
        <div role="group" aria-label="Colour mode" className="seg">
          {MODES.map((m) => (
            <button key={m.id} className={s.mode === m.id ? 'on' : ''} aria-pressed={s.mode === m.id} onClick={() => store.setMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <canvas ref={ref} id="section-canvas" height={360} style={{ width: '100%', display: 'block', cursor: 'crosshair', background: '#fff' }} onClick={onClick} aria-label="Stratigraphic section. Click to move the pseudo-well." />
      {s.info ? <Legend mode={s.mode} startAgeMa={s.info.startAgeMa} /> : null}
      {s.viewB && s.diff ? (
        <div className="muted">
          Comparing with the other branch: surface differs by up to {Math.round(s.diff.maxAbsDH * 3.28084).toLocaleString('en-US')} ft{s.diff.identical ? ' (identical)' : ''}.
        </div>
      ) : null}
    </div>
  )
}

const def: ViewDefinition = { id: 'section', title: 'Section', region: 'section', order: 0, component: SectionView }
export default def

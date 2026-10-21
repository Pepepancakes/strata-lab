import { useEffect, useMemo, useRef, useState } from 'react'
import { store, useAppState } from '../../app/store'
import type { StateView } from '../../worker/protocol'
import { COVER_INFO, SALT_INFO, WELD_INFO, WhatItMeans } from '../WhatItMeans'
import type { ViewDefinition } from '../types'
import { COVER_LINE, columnAtFraction, drawSection, SECTION_CSS_HEIGHT, WELD_LINE } from './draw'
import type { SectionWellPath } from './wellPath'
import { COVER_SHADE, legendFor, MODES, ramp, viewHasMode, viewHasSalt, weldedColumns } from './colors'
import { CrestKey, CrestMarkers } from '../crests/Markers'
import { TURBIDITE_INFO, turbiditeReadout } from './turbidite'

const hex = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`

/** Salt, older cover and weld keys with their (i) explanations; shown for runs with salt (M3.5). */
function SaltLegend({ view }: { view: StateView }) {
  const welds = weldedColumns(view).some((x) => x === 1)
  const sw = (style: React.CSSProperties) => <span aria-hidden="true" style={{ display: 'inline-block', width: 22, height: 12, border: '1px solid #555', ...style }} />
  const cover = (c: number) => Math.round(c * COVER_SHADE)
  return (
    <div className="legend" aria-label="Salt legend" data-testid="salt-legend">
      {sw({ background: 'rgb(232,150,170)' })}<span>Salt</span><WhatItMeans what="the salt colour">{SALT_INFO}</WhatItMeans>
      {sw({ background: `rgb(${cover(226)},${cover(196)},${cover(110)})`, borderTop: `2px dashed ${COVER_LINE}` })}<span>Older cover (before the run)</span><WhatItMeans what="the older cover">{COVER_INFO}</WhatItMeans>
      {sw({ height: 0, border: 'none', borderTop: `4px solid ${WELD_LINE}` })}<span>Weld{welds ? '' : ' (none yet)'}</span><WhatItMeans what="a weld">{WELD_INFO}</WhatItMeans>
    </div>
  )
}

function Legend({ mode, startAgeMa }: { mode: (typeof MODES)[number]['id']; startAgeMa: number }) {
  const leg = legendFor(mode, startAgeMa)
  const stops = Array.from({ length: 21 }, (_, i) => hex(ramp(mode, i / 20)))
  return (
    <div className="legend" aria-label="Colour legend">
      <span>{leg.low}</span>
      <span className="ramp" style={{ background: `linear-gradient(90deg, ${stops.join(',')})` }} />
      <span>{leg.high}</span>
      {leg.info ? <WhatItMeans what="the salt thickness scale">{leg.info}</WhatItMeans> : null}
      <span className="muted">{leg.note}</span>
      <span className="hatch" aria-hidden="true" /><span className="muted">MTD (debris deposit)</span>
    </div>
  )
}

/** SFM-3: the share of the shelf-edge flux sent down the slope at the shown step, with its (i) note. */
function TurbiditeLine({ view }: { view: StateView }) {
  const r = turbiditeReadout(view.tcShare ?? 0, view.tcCap ?? 0, view.shelfEdge)
  return (
    <div className="muted" data-testid="turbidite-share">
      {r.text}
      <WhatItMeans what="the turbidite share">{TURBIDITE_INFO}</WhatItMeans>
    </div>
  )
}

function SectionView() {
  const s = useAppState()
  const ref = useRef<HTMLCanvasElement>(null)
  const [widthTick, setWidthTick] = useState(0)
  const salty = !!s.view && viewHasSalt(s.view)
  // Salt thickness mode exists only for runs with salt; on a run without it the section shows grain size.
  const mode = s.mode === 'salt' && !salty ? 'grain' : s.mode
  const showCrests = salty && !!s.crestLog && s.crestLog.saltOn && s.crestLog.episodes.length > 0

  // The planned well of the active branch, as the section draws it; it follows the time slider and the branch switch.
  const wellPath = useMemo((): SectionWellPath | null => {
    const run = s.wellRuns.find((r) => r.branchId === s.activeId)
    if (!run || !s.info || run.samples.n < 2) return null
    const sm = run.samples
    return { xKm: sm.xKm, tvdssFt: sm.tvdssFt, n: sm.n, widthM: s.info.nx * s.info.dx, reachedTd: sm.stopped === null }
  }, [s.wellRuns, s.activeId, s.info])

  useEffect(() => {
    const cv = ref.current
    if (!cv || !s.view || !s.extent || !viewHasMode(s.view, mode)) return
    const t0 = performance.now()
    drawSection(cv, s.view, { mode, wellCol: s.wellCol, extent: s.extent, runLengthMa: s.runLengthMa, events: s.events, selectedEvent: s.selectedEvent, wellPath })
    store.recordDraw(performance.now() - t0)
    cv.dataset.drawnMode = mode
    cv.dataset.drawnStep = String(s.view.step)
  }, [s.view, mode, s.wellCol, s.extent, s.runLengthMa, s.events, s.selectedEvent, wellPath, widthTick])

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
          {MODES.filter((m) => m.id !== 'salt' || salty).map((m) => (
            <button key={m.id} className={mode === m.id ? 'on' : ''} aria-pressed={mode === m.id} onClick={() => store.setMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ position: 'relative' }}>
        <canvas ref={ref} id="section-canvas" style={{ width: '100%', height: SECTION_CSS_HEIGHT, display: 'block', cursor: 'crosshair', background: '#fff' }} onClick={onClick} aria-label="Stratigraphic section. Click to move the pseudo-well." />
        {showCrests && s.crestLog && s.view && s.extent ? <CrestMarkers log={s.crestLog} view={s.view} extent={s.extent} selected={s.selectedCrest} /> : null}
      </div>
      {showCrests ? <CrestKey /> : null}
      {s.info ? <Legend mode={mode} startAgeMa={s.info.startAgeMa} /> : null}
      {salty && s.view ? <SaltLegend view={s.view} /> : null}
      {s.view && s.view.tcShare !== undefined && s.view.tcCap !== undefined ? <TurbiditeLine view={s.view} /> : null}
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

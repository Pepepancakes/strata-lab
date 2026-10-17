// Planned well panel (M4.3): the well controls, the pressure plot with the mud-weight window, and the branch compare.
// The well is a view setting (it never changes a run), so its controls sit here and not in the parameter groups.
// Every number comes from the layer record through the worker (sampleWell) and wellPressures(); nothing is computed
// from geology here.

import { useEffect, useMemo, useState } from 'react'
import { MAX_WELL_COMPARE, store, useAppState, type WellRun } from '../../app/store'
import { DEFAULT_AIR_GAP_FT, validateWell, verticalWell, type WellDefinition } from '../../engine/well'
import { wellPressures, WINDOW_NO_WINDOW, WINDOW_TIGHT } from '../../engine/wellPressure'
import type { FractureMethod } from '../../engine/wellPressureParams'
import { mToFt } from '../../units'
import type { ViewDefinition } from '../types'
import { WhatItMeans } from '../WhatItMeans'
import {
  linePath, makePlotRun, plotRange, readoutAt, saltIntervals, stationAtTvdss, windowBands,
  type PlotRun, type Readout,
} from './plot'

// ---- explanations (plain words; John reads an unexplained flag as a bug) ------------------------

const INFO = {
  hydro: 'Hydrostatic: the pressure of a column of sea water as tall as the well is deep. It is the pressure the rock would have if its water were connected to the sea all the way down. Written as the mud weight (ppg) that would just balance it, measured from the rig floor, so it reads a little under 8.55 ppg.',
  pore: 'Pore pressure: the pressure of the water in the rock pores, as a mud weight. Where it moves right of the dashed blue line the rock is overpressured, because water could not escape as fast as burial squeezed it. This is the lowest mud weight that keeps the hole from taking a kick. The line stops in salt, because salt has no pore water.',
  overburden: 'Overburden: the weight of everything above, the sea water and all the rock, as a mud weight. The fracture gradient can never go above it in this model, and it is the fracture gradient inside salt.',
  fg: 'Fracture gradient: the mud weight at which the rock would split open. Above the salt it is the pore pressure plus a share of the load the grains carry (overburden minus pore pressure). The share comes from the method you pick, with one fixed number for all depths (tuned, not read from the paper\u2019s depth chart). In salt it equals the overburden.',
  window: 'Mud-weight window (green): the band between the pore pressure and the fracture gradient. A mud weight inside the band holds the hole open without a kick or a loss. No wellbore-collapse limit is used here, so the true lower limit can be higher than the pore pressure.',
  tight: 'Tight window (amber): the band between pore pressure and fracture gradient is narrower than the tight limit (0.5 ppg, a labelling threshold, not physics). Drilling here is hard to keep between kick and loss.',
  noWindow: 'No window (red): the pore pressure has reached the fracture gradient, so no mud weight can hold the hole without either a kick or a loss. In a real well this is where a casing string would have to be set above it.',
  salt: 'Salt (pink): rock salt has no pore water, so there is no pore pressure to plot and the pore line stops. The model uses the hydrostatic pressure as the bottom of the window and the overburden as the fracture gradient, which is how salt is usually treated (an assumption to verify).',
  water: 'Sea water (blue shade): the water above the sea floor. There is no rock to fracture here, so every pressure equals the weight of sea water. The dashed line is the sea floor.',
  stopped: 'The well stops before its total depth: it either left the side of the section or reached the base of the record (the bottom of the model). The plot ends there.',
  compare: 'Branch compare: the same well drawn on up to three branches at this time, on the same axes. Each branch has its own colour. The mud-weight window is shaded for the active branch only.',
  fgMethod: 'How the fracture gradient is worked out. Eaton (1969) and Matthews & Kelly (1967) both give the pore pressure plus a share of the grain-carried load. They differ in the share (Eaton 0.67 from a Poisson\u2019s ratio of 0.40, Matthews & Kelly 0.60); both numbers are tuned constants for now. In salt both give the overburden.',
  airGap: 'Air gap: the height of the rig floor above the sea surface. Mud weights are measured from the rig floor, depths are measured from the sea surface (TVDSS). The default of 80 ft is a tuned typical value for a floating rig.',
  location: 'The surface location of the well, in km from the landward edge of the section. Click the section to move it. A click puts it in the middle of that column.',
}

// ---- layout -------------------------------------------------------------------------------------

const W = 640
const H = 420
const PL = 58 // left margin (depth axis)
const PR = 16
const PT = 40
const PB = 34

/** Branch colours on the compare plot (colour-blind safe; each is at least 4.5:1 on white). */
const BRANCH_COLOURS = ['#0b5a9c', '#a04400', '#00785a']
const LINE = { hydro: '#2b6cb0', pore: '#c0261c', overburden: '#222', fg: '#8a4f00' }
const SHADE = { ok: 'rgba(46,160,90,0.26)', tight: 'rgba(245,170,0,0.55)', noWindow: 'rgba(214,40,40,0.5)', salt: 'rgba(232,150,170,0.32)', water: 'rgba(120,170,230,0.25)' }

const fmtFt = (ft: number): string => Math.round(ft).toLocaleString('en-US')
const fmtPpg = (v: number | null): string => (v === null ? 'n/a' : v.toFixed(2))

function branchName(s: { branches: { id: string; parentId: string | null; label: string }[] }, id: string): string {
  const b = s.branches.find((x) => x.id === id)
  return b ? (b.parentId ? b.label : 'Main run') : id
}

// ---- controls -----------------------------------------------------------------------------------

type NumField = 'xKm' | 'kickoffFt' | 'buildRateDegPer100Ft' | 'holdInclinationDeg' | 'totalDepthFt' | 'airGapFt'
const NUM_FIELDS: NumField[] = ['xKm', 'kickoffFt', 'buildRateDegPer100Ft', 'holdInclinationDeg', 'totalDepthFt', 'airGapFt']

const toDraft = (w: WellDefinition): Record<NumField, string> =>
  Object.fromEntries(NUM_FIELDS.map((k) => [k, String(w[k])])) as Record<NumField, string>

/** The values a build-and-hold well starts with when John switches the shape (tuned starting point, all editable). */
const BUILD_AND_HOLD_DEFAULTS = { kickoffFt: 5000, buildRateDegPer100Ft: 3, holdInclinationDeg: 30 }

function WellControls({ plan, problemsOut }: { plan: WellDefinition; problemsOut: (p: string[]) => void }) {
  const s = useAppState()
  const [draft, setDraft] = useState(() => toDraft(plan))
  const [shape, setShape] = useState<'vertical' | 'build-and-hold'>(plan.holdInclinationDeg > 0 ? 'build-and-hold' : 'vertical')
  const [problems, setProblems] = useState<string[]>([])
  const busy = !!s.busy

  // Follow changes made elsewhere (a click on the section moves the surface location), but never overwrite a value the user is still typing.
  useEffect(() => {
    setDraft((d) => {
      const next = { ...d }
      for (const k of NUM_FIELDS) if (Number(d[k]) !== plan[k]) next[k] = String(plan[k])
      return next
    })
    if (plan.holdInclinationDeg > 0) setShape('build-and-hold')
    setProblems([]) // the plan changed to something valid (an edit, or a click on the section), so earlier complaints are out of date
    problemsOut([])
  }, [plan]) // eslint-disable-line react-hooks/exhaustive-deps

  const push = (next: WellDefinition): void => {
    const p = validateWell(next)
    setProblems(p)
    problemsOut(p)
    if (p.length === 0) store.setWellPlan(next)
  }
  const edit = (k: NumField, text: string): void => {
    setDraft({ ...draft, [k]: text })
    push({ ...plan, [k]: text.trim() === '' ? NaN : Number(text) })
  }
  const setShapeTo = (sh: 'vertical' | 'build-and-hold'): void => {
    setShape(sh)
    if (sh === 'vertical') push({ ...plan, kickoffFt: 0, buildRateDegPer100Ft: 0, holdInclinationDeg: 0 })
    else push({ ...plan, ...BUILD_AND_HOLD_DEFAULTS })
  }
  const bnh = shape === 'build-and-hold'
  const field = (k: NumField, label: string, step: number, unit: string, off = false) => (
    <label className="sub" key={k}>
      {label}
      <input type="number" step={step} value={draft[k]} disabled={busy || off} aria-label={`${label} (${unit})`} onChange={(e) => edit(k, e.target.value)} />
    </label>
  )
  return (
    <div data-testid="well-controls">
      <div className="pair" style={{ flexWrap: 'wrap' }}>
        {field('xKm', 'Surface location', 0.1, 'km')}
        <label className="sub">
          Well shape
          <select value={shape} disabled={busy} onChange={(e) => setShapeTo(e.target.value as 'vertical' | 'build-and-hold')}>
            <option value="vertical">Vertical</option>
            <option value="build-and-hold">Build and hold</option>
          </select>
        </label>
        {field('totalDepthFt', 'Total depth', 500, 'ft TVDSS')}
        {field('airGapFt', 'Air gap', 5, 'ft')}
      </div>
      {bnh ? (
        <div className="pair" style={{ flexWrap: 'wrap', marginTop: 4 }}>
          {field('kickoffFt', 'Kickoff depth', 500, 'ft TVDSS')}
          {field('buildRateDegPer100Ft', 'Build rate', 0.5, 'deg per 100 ft')}
          {field('holdInclinationDeg', 'Hold angle', 5, 'deg from vertical')}
          <label className="sub">
            Direction
            <select value={plan.direction} disabled={busy} onChange={(e) => push({ ...plan, direction: e.target.value as WellDefinition['direction'] })}>
              <option value="basinward">Toward the basin</option>
              <option value="landward">Toward the land</option>
            </select>
          </label>
        </div>
      ) : null}
      <div className="pair" style={{ flexWrap: 'wrap', marginTop: 4, alignItems: 'flex-end' }}>
        <label className="sub">
          Fracture-gradient method
          <select value={s.wellPressure.fgMethod} disabled={busy} onChange={(e) => store.setWellPressure({ ...s.wellPressure, fgMethod: e.target.value as FractureMethod })}>
            <option value="eaton">Eaton (1969)</option>
            <option value="matthews-kelly">Matthews & Kelly (1967)</option>
          </select>
        </label>
        <WhatItMeans what="the fracture-gradient method">{INFO.fgMethod}</WhatItMeans>
        <WhatItMeans what="the air gap">{INFO.airGap}</WhatItMeans>
        <WhatItMeans what="the surface location">{INFO.location}</WhatItMeans>
        <button disabled={busy} onClick={() => store.setWellPlan(null)}>Remove well</button>
      </div>
      {problems.length ? (
        <ul className="small" role="alert" data-testid="well-problems" style={{ color: '#f08a7e', margin: '4px 0', paddingLeft: 18 }}>
          {problems.map((p) => <li key={p}>{p}</li>)}
        </ul>
      ) : null}
    </div>
  )
}

// ---- the plot -----------------------------------------------------------------------------------

function PressurePlot({ runs, compare, fgName }: { runs: PlotRun[]; compare: boolean; fgName: string }) {
  const [hoverFt, setHoverFt] = useState<number | null>(null)
  const range = useMemo(() => plotRange(runs), [runs])
  const { xLo, xHi, yTop, yBot } = range
  const x = (v: number): number => PL + ((v - xLo) / (xHi - xLo)) * (W - PL - PR)
  const y = (ft: number): number => PT + ((ft - yTop) / (yBot - yTop)) * (H - PT - PB)
  const primary = runs[0]
  const ps = primary.samples
  const salt = useMemo(() => saltIntervals(ps), [ps])
  const bands = useMemo(() => windowBands(ps, primary.pressures, x, y), [ps, primary.pressures, xLo, xHi, yTop, yBot]) // eslint-disable-line react-hooks/exhaustive-deps
  const yStep = yBot - yTop > 20000 ? 5000 : yBot - yTop > 8000 ? 2000 : 1000
  const yTicks: number[] = []
  for (let ft = Math.ceil(yTop / yStep) * yStep; ft <= yBot; ft += yStep) yTicks.push(ft)
  const xTicks: number[] = []
  for (let v = xLo; v <= xHi; v += xHi - xLo > 14 ? 2 : 1) xTicks.push(v)
  const colour = (i: number, quantity: keyof typeof LINE): string => (compare ? BRANCH_COLOURS[i % BRANCH_COLOURS.length] : LINE[quantity])
  const mudline = ps.mudlineTvdssFt
  const onMove = (e: React.PointerEvent<SVGSVGElement>): void => {
    const r = e.currentTarget.getBoundingClientRect()
    const yy = ((e.clientY - r.top) / r.height) * H
    const ft = yTop + ((yy - PT) / (H - PT - PB)) * (yBot - yTop)
    setHoverFt(ft >= yTop && ft <= yBot ? ft : null)
  }
  const onKey = (e: React.KeyboardEvent<SVGSVGElement>): void => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const step = (e.key === 'ArrowDown' ? 1 : -1) * 250
    setHoverFt((h) => Math.max(yTop, Math.min(yBot, (h ?? yTop) + step)))
  }
  const readouts: Readout[] = hoverFt === null ? [] : runs.map((r) => readoutAt(r, stationAtTvdss(r.samples, hoverFt))).filter((r) => r.station >= 0)
  const hy = hoverFt === null ? null : y(Math.max(yTop, Math.min(yBot, hoverFt)))
  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`} role="img" tabIndex={0} data-testid="pressure-plot"
        aria-label="Pressure plot: mud weight in ppg across, depth in ft TVDSS down. Arrow keys move the depth readout."
        style={{ width: '100%', maxWidth: 720, background: '#fff', borderRadius: 4, touchAction: 'none' }}
        onPointerMove={onMove} onPointerLeave={() => setHoverFt(null)} onKeyDown={onKey}
      >
        {/* grid and axes */}
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke="#e3e6ea" />
            <text x={PL - 5} y={y(t) + 3} fontSize={10} textAnchor="end" fill="#333">{t.toLocaleString('en-US')}</text>
          </g>
        ))}
        {xTicks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={PT} y2={H - PB} stroke="#eef0f3" />
            <text x={x(t)} y={H - PB + 13} fontSize={10} textAnchor="middle" fill="#333">{t}</text>
          </g>
        ))}
        <text x={4} y={14} fontSize={10} fill="#333">Depth, ft TVDSS (below the sea surface)</text>
        <text x={(PL + W - PR) / 2} y={H - 6} fontSize={10} textAnchor="middle" fill="#333">Mud weight (EMW), ppg, measured from the rig floor</text>
        <rect x={PL} y={PT} width={W - PL - PR} height={H - PT - PB} fill="none" stroke="#999" />

        {/* sea water above the sea floor */}
        {mudline > 0 ? (
          <g data-testid="plot-water">
            <rect x={PL} y={y(Math.max(yTop, 0))} width={W - PL - PR} height={Math.max(0, y(Math.min(mudline, yBot)) - y(Math.max(yTop, 0)))} fill={SHADE.water} />
            <line x1={PL} x2={W - PR} y1={y(mudline)} y2={y(mudline)} stroke="#2b6cb0" strokeDasharray="5 3" />
            <text x={W - PR - 3} y={y(mudline) - 3} fontSize={9} textAnchor="end" fill="#1d4e89">sea floor {fmtFt(mudline)} ft</text>
          </g>
        ) : null}

        {/* salt, over the whole width */}
        {salt.map((a, i) => (
          <g key={i} data-testid="plot-salt">
            <rect x={PL} y={y(a.topTvdssFt)} width={W - PL - PR} height={Math.max(1.5, y(a.bottomTvdssFt) - y(a.topTvdssFt))} fill={SHADE.salt} stroke="#a03050" strokeDasharray="3 2" />
            <text x={PL + 4} y={y(a.topTvdssFt) + 11} fontSize={10} fontWeight={600} fill="#7a2040">salt {fmtFt(a.topTvdssFt)} to {fmtFt(a.bottomTvdssFt)} ft</text>
          </g>
        ))}

        {/* mud-weight window of the active branch: green open, amber tight, red none */}
        {bands.map((b, i) => (
          <path key={i} d={b.path} data-testid={b.state === WINDOW_NO_WINDOW ? 'plot-nowindow' : b.state === WINDOW_TIGHT ? 'plot-tight' : 'plot-window'}
            fill={b.state === WINDOW_NO_WINDOW ? SHADE.noWindow : b.state === WINDOW_TIGHT ? SHADE.tight : SHADE.ok} stroke="none" />
        ))}

        {/* lines: hydrostatic once (it barely differs between branches), then the rest per branch */}
        <path d={linePath(primary.lines.hydro, ps.tvdssFt, ps.n, x, y)} fill="none" stroke={LINE.hydro} strokeWidth={1.4} strokeDasharray="4 3" />
        {runs.map((r, i) => {
          const p = r.pressures
          const s = r.samples
          const lw = compare && i > 0 ? 1.6 : 2
          return (
            <g key={r.branchId} data-testid={`plot-run-${i}`}>
              <path d={linePath(r.lines.overburden, s.tvdssFt, p.n, x, y)} fill="none" stroke={colour(i, 'overburden')} strokeWidth={lw} strokeDasharray={compare ? '1.5 3' : undefined} />
              <path d={linePath(r.lines.fg, s.tvdssFt, p.n, x, y)} fill="none" stroke={colour(i, 'fg')} strokeWidth={lw} strokeDasharray="7 3 2 3" />
              <path d={linePath(r.lines.pore, s.tvdssFt, p.n, x, y)} fill="none" stroke={colour(i, 'pore')} strokeWidth={lw + 0.4} />
            </g>
          )
        })}

        {/* where the well stops, if it does not reach total depth */}
        {runs.map((r, i) =>
          r.samples.stopped ? (
            <g key={`stop-${r.branchId}`} data-testid="plot-stop">
              <line x1={PL} x2={W - PR} y1={y(r.samples.tvdssFt[r.samples.n - 1])} y2={y(r.samples.tvdssFt[r.samples.n - 1])} stroke={colour(i, 'pore')} strokeDasharray="2 2" />
              <text x={PL + 4} y={y(r.samples.tvdssFt[r.samples.n - 1]) - 3} fontSize={9} fill="#333">well stops</text>
            </g>
          ) : null)}

        {/* hover guide */}
        {hy !== null ? <line x1={PL} x2={W - PR} y1={hy} y2={hy} stroke="#111" strokeWidth={0.8} /> : null}
        {readouts.map((r, i) => (
          <g key={r.branchId}>
            {r.porePpg !== null ? <circle cx={x(r.porePpg)} cy={y(r.tvdssFt)} r={3.2} fill="#fff" stroke={colour(i, 'pore')} strokeWidth={1.6} /> : null}
            {r.fgPpg !== null ? <circle cx={x(r.fgPpg)} cy={y(r.tvdssFt)} r={3.2} fill="#fff" stroke={colour(i, 'fg')} strokeWidth={1.6} /> : null}
          </g>
        ))}
        <text x={W - PR - 2} y={14} fontSize={10} textAnchor="end" fill="#333">{fgName}</text>
      </svg>
      <div className="small" data-testid="well-hover" aria-live="polite" style={{ minHeight: 36, margin: '4px 0' }}>
        {readouts.length === 0 ? (
          <span className="muted">Move over the plot (or focus it and use the up and down arrow keys) to read the values and the measured depth at that depth.</span>
        ) : (
          <table className="num">
            <thead>
              <tr><th scope="col">{compare ? 'Branch' : 'At'}</th><th scope="col">TVDSS ft</th><th scope="col">MD ft</th><th scope="col">Pore</th><th scope="col">Fracture</th><th scope="col">Overburden</th><th scope="col">Window</th></tr>
            </thead>
            <tbody>
              {readouts.map((r) => (
                <tr key={r.branchId}>
                  <th scope="row">{compare ? r.label : 'hover'}</th>
                  <td>{fmtFt(r.tvdssFt)}</td><td>{fmtFt(r.mdFt)}</td>
                  <td>{r.inSalt ? 'salt' : fmtPpg(r.porePpg)}</td><td>{fmtPpg(r.fgPpg)}</td><td>{fmtPpg(r.overburdenPpg)}</td>
                  <td>{r.widthPpg === null ? r.state : `${r.widthPpg.toFixed(2)} ppg, ${r.state}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ---- legend, flags and compare table ------------------------------------------------------------

function Swatch({ colour, dash, box }: { colour: string; dash?: string; box?: boolean }) {
  // drawn on a white chip so a dark line or a pale shade reads the same as on the white plot
  return box ? (
    <span aria-hidden="true" style={{ display: 'inline-block', width: 22, height: 12, background: `linear-gradient(${colour}, ${colour}), #fff`, border: '1px solid #555' }} />
  ) : (
    <span aria-hidden="true" style={{ display: 'inline-flex', background: '#fff', borderRadius: 3, padding: '2px 3px' }}>
      <svg width={26} height={10}><line x1={0} x2={26} y1={5} y2={5} stroke={colour} strokeWidth={2.4} strokeDasharray={dash} /></svg>
    </span>
  )
}

function Key({ runs, compare, names, hasTight, hasNoWindow, hasSalt, hasWater, hasStop }: { runs: PlotRun[]; compare: boolean; names: string[]; hasTight: boolean; hasNoWindow: boolean; hasSalt: boolean; hasWater: boolean; hasStop: boolean }) {
  const grey = '#444'
  const item = (sw: React.ReactElement, label: string, info: string, what: string) => (
    <span key={label} className="row" style={{ gap: 4 }}>{sw}<span>{label}</span><WhatItMeans what={what}>{info}</WhatItMeans></span>
  )
  return (
    <div className="legend" data-testid="plot-key" aria-label="Pressure plot key" style={{ rowGap: 6, columnGap: 14 }}>
      {compare ? (
        <div className="row" data-testid="branch-legend" style={{ gap: 12, width: '100%' }}>
          <strong className="small">Branches:</strong>
          {runs.map((r, i) => (
            <span key={r.branchId} className="row" style={{ gap: 4 }}><Swatch colour={BRANCH_COLOURS[i % BRANCH_COLOURS.length]} /><span>{names[i]}{i === 0 ? ' (active)' : ''}</span></span>
          ))}
          <WhatItMeans what="the branch compare">{INFO.compare}</WhatItMeans>
        </div>
      ) : null}
      {item(<Swatch colour={LINE.hydro} dash="4 3" />, 'hydrostatic', INFO.hydro, 'the hydrostatic line')}
      {item(<Swatch colour={compare ? grey : LINE.pore} />, 'pore pressure', INFO.pore, 'the pore-pressure line')}
      {item(<Swatch colour={compare ? grey : LINE.overburden} dash={compare ? '1.5 3' : undefined} />, 'overburden', INFO.overburden, 'the overburden line')}
      {item(<Swatch colour={compare ? grey : LINE.fg} dash="7 3 2 3" />, 'fracture gradient', INFO.fg, 'the fracture-gradient line')}
      {item(<Swatch colour={SHADE.ok} box />, 'mud-weight window', INFO.window, 'the mud-weight window')}
      {hasTight ? item(<Swatch colour={SHADE.tight} box />, 'tight', INFO.tight, 'a tight window') : null}
      {hasNoWindow ? item(<Swatch colour={SHADE.noWindow} box />, 'no window', INFO.noWindow, 'no window') : null}
      {hasSalt ? item(<Swatch colour={SHADE.salt} box />, 'salt', INFO.salt, 'salt on the plot') : null}
      {hasWater ? item(<Swatch colour={SHADE.water} box />, 'sea water', INFO.water, 'the sea water shade') : null}
      {hasStop ? item(<Swatch colour="#333" dash="2 2" />, 'well stops', INFO.stopped, 'the well stopping') : null}
    </div>
  )
}

function Flags({ run }: { run: PlotRun }) {
  const sum = run.pressures.summary
  const salt = saltIntervals(run.samples)
  const stop = run.samples.stopped
  const fmt = (a: { topTvdssFt: number; bottomTvdssFt: number; topMdFt: number; bottomMdFt: number }) =>
    `${fmtFt(a.topTvdssFt)} to ${fmtFt(a.bottomTvdssFt)} ft TVDSS (MD ${fmtFt(a.topMdFt)} to ${fmtFt(a.bottomMdFt)} ft)`
  return (
    <div data-testid="well-flags">
      {sum.narrowest ? (
        <p className="small">
          Narrowest window: {sum.narrowest.widthPpg.toFixed(2)} ppg at {fmtFt(sum.narrowest.tvdssFt)} ft TVDSS (MD {fmtFt(sum.narrowest.mdFt)} ft).
        </p>
      ) : (
        <p className="small muted">This well has no rock yet at this time, so there is no window.</p>
      )}
      {sum.tight.map((t, i) => (
        <p key={`t${i}`} className="small" data-testid="flag-tight">
          Tight window {fmt(t)}; narrowest {t.minWidthPpg.toFixed(2)} ppg. <WhatItMeans what="a tight window">{INFO.tight}</WhatItMeans>
        </p>
      ))}
      {sum.noWindow.map((t, i) => (
        <p key={`n${i}`} className="small" data-testid="flag-nowindow">
          No window {fmt(t)}; the pore pressure is {(-t.minWidthPpg).toFixed(2)} ppg above the fracture gradient at the worst point. <WhatItMeans what="no window">{INFO.noWindow}</WhatItMeans>
        </p>
      ))}
      {salt.map((a, i) => (
        <p key={`s${i}`} className="small" data-testid="flag-salt">
          Salt {fmt(a)}. Here the fracture gradient is the overburden and the window starts at the hydrostatic pressure. <WhatItMeans what="salt on the plot">{INFO.salt}</WhatItMeans>
        </p>
      ))}
      {stop ? (
        <p className="small" data-testid="flag-stop">
          The well stops at MD {fmtFt(stop.mdFt)} ft: {stop.reason === 'leftSection' ? 'it leaves the side of the section' : 'it reaches the base of the record'}. <WhatItMeans what="the well stopping">{INFO.stopped}</WhatItMeans>
        </p>
      ) : null}
    </div>
  )
}

function CompareTable({ runs, names }: { runs: PlotRun[]; names: string[] }) {
  return (
    <table className="num small" data-testid="compare-table">
      <caption className="small muted" style={{ textAlign: 'left' }}>Narrowest mud-weight window of this well on each branch</caption>
      <thead><tr><th scope="col">Branch</th><th scope="col">Narrowest, ppg</th><th scope="col">At, ft TVDSS</th><th scope="col">Tight runs</th><th scope="col">No-window runs</th></tr></thead>
      <tbody>
        {runs.map((r, i) => {
          const n = r.pressures.summary.narrowest
          return (
            <tr key={r.branchId}>
              <th scope="row" style={{ color: BRANCH_COLOURS[i % BRANCH_COLOURS.length] }}>{names[i]}</th>
              <td>{n ? n.widthPpg.toFixed(2) : 'n/a'}</td><td>{n ? fmtFt(n.tvdssFt) : 'n/a'}</td>
              <td>{r.pressures.summary.tight.length}</td><td>{r.pressures.summary.noWindow.length}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ---- the view -----------------------------------------------------------------------------------

function WellPlanView() {
  const s = useAppState()
  const plan = s.wellPlan
  const [liveProblems, setLiveProblems] = useState<string[]>([])
  const busy = !!s.busy

  const names = useMemo(() => s.wellRuns.map((r) => branchName(s, r.branchId)), [s.wellRuns, s.branches]) // eslint-disable-line react-hooks/exhaustive-deps
  const runs: PlotRun[] = useMemo(
    () => s.wellRuns.map((r: WellRun, i) => makePlotRun(r.branchId, names[i], r.samples, wellPressures(r.samples, s.wellPressure))),
    [s.wellRuns, s.wellPressure, names],
  )

  if (!s.info) return <div><h2>Planned well</h2><p className="muted">Waiting for the run.</p></div>

  const newWell = (): void => {
    const col = s.wellCol >= 0 ? s.wellCol : Math.round(s.info!.nx * 0.46)
    const xKm = Math.round(((col + 0.5) * s.info!.dx) / 10) / 100
    // total depth: the base of the record under that column, to the nearest 500 ft above it (a well can not go deeper than the model)
    const base = s.view ? mToFt(s.view.seaLevelM - s.view.b[col]) : 20000
    const td = Math.max(2000, Math.min(30000, Math.floor(base / 500) * 500))
    store.setWellPlan(verticalWell(xKm, td))
  }

  const compareOthers = s.branches.filter((b) => b.id !== s.activeId)
  const toggle = (id: string, on: boolean): void => store.setWellCompare(on ? [...s.wellCompare, id] : s.wellCompare.filter((x) => x !== id))
  const compare = runs.length > 1
  const fgName = s.wellPressure.fgMethod === 'eaton' ? 'fracture gradient: Eaton (1969)' : 'fracture gradient: Matthews & Kelly (1967)'
  const primary = runs[0]
  const anyState = (state: number): boolean => !!primary && Array.from(primary.pressures.state).some((v) => v === state)

  return (
    <div data-testid="well-plan">
      <h2>Planned well</h2>
      {!plan ? (
        <div>
          <p className="muted">Plan a well to see the pore pressure, fracture gradient and mud-weight window along it. It is drawn on the section and saved in the scenario file; it never changes the run.</p>
          <button disabled={busy} onClick={newWell}>Plan a well here</button>
        </div>
      ) : (
        <div>
          <WellControls plan={plan} problemsOut={setLiveProblems} />
          <p className="muted small">Click the section to move the surface location. Depths are TVDSS in ft; mud weights are measured from the rig floor ({plan.airGapFt === DEFAULT_AIR_GAP_FT ? 'air gap 80 ft, a tuned default' : `air gap ${plan.airGapFt} ft`}).</p>
          {compareOthers.length ? (
            <fieldset className="small" style={{ border: '1px solid #2a323c', borderRadius: 4, margin: '6px 0' }}>
              <legend>Compare branches (up to {MAX_WELL_COMPARE + 1} in all, with the active one)</legend>
              {compareOthers.map((b) => {
                const on = s.wellCompare.includes(b.id)
                return (
                  <label key={b.id} className="toggle" style={{ marginRight: 12 }}>
                    <input type="checkbox" checked={on} disabled={busy || (!on && s.wellCompare.length >= MAX_WELL_COMPARE)} onChange={(e) => toggle(b.id, e.target.checked)} />
                    {b.parentId ? b.label : 'Main run'}
                  </label>
                )
              })}
            </fieldset>
          ) : null}
          {primary && liveProblems.length === 0 ? (
            <div>
              <PressurePlot runs={runs} compare={compare} fgName={fgName} />
              <Key
                runs={runs} compare={compare} names={names}
                hasTight={anyState(WINDOW_TIGHT)} hasNoWindow={anyState(WINDOW_NO_WINDOW)}
                hasSalt={saltIntervals(primary.samples).length > 0} hasWater={primary.samples.mudlineTvdssFt > 0}
                hasStop={runs.some((r) => r.samples.stopped)}
              />
              <Flags run={primary} />
              {compare ? <CompareTable runs={runs} names={names} /> : null}
              {compare ? runs.slice(1).map((r, i) => (r.samples.stopped ? <p key={r.branchId} className="small">On {names[i + 1]} the well stops at MD {fmtFt(r.samples.stopped.mdFt)} ft.</p> : null)) : null}
            </div>
          ) : primary ? null : <p className="muted small">Sampling the well...</p>}
        </div>
      )}
    </div>
  )
}

const def: ViewDefinition = { id: 'wellplan', title: 'Planned well', region: 'well', order: 0.5, component: WellPlanView }
export default def

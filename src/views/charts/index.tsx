import { useAppState } from '../../app/store'
import { mToFt } from '../../units'
import type { SeriesData } from '../../worker/protocol'
import type { ViewDefinition } from '../types'

const W = 640
const H = 150
const L = 52
const R = 10
const T = 8
const B = 28

interface Line {
  ys: ArrayLike<number>
  colour: string
  label?: string
  /** Optional split into runs of constant value (e.g. which curve is in use). */
  runs?: ArrayLike<number>
}

const RUN_COLOURS = ['#1b6ca8', '#b8651b', '#2e8b57', '#8e44ad']

function niceTicks(lo: number, hi: number, n = 4): number[] {
  const raw = (hi - lo) / n
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)))
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6))
  return out
}

/** Time axis in Ma: oldest on the left, present on the right. */
export function Chart({ ages, lines, nowAgeMa, yLabel }: { ages: ArrayLike<number>; lines: Line[]; nowAgeMa: number | null; yLabel: string }) {
  const n = ages.length
  const a0 = ages[0]
  const a1 = ages[n - 1]
  const x = (a: number) => L + ((a0 - a) / (a0 - a1 || 1)) * (W - L - R)
  let lo = Infinity
  let hi = -Infinity
  for (const ln of lines) for (let i = 0; i < n; i++) { lo = Math.min(lo, ln.ys[i]); hi = Math.max(hi, ln.ys[i]) }
  if (!isFinite(lo)) { lo = 0; hi = 1 }
  if (hi - lo < 1e-9) { hi = lo + 1 }
  const pad = (hi - lo) * 0.08
  lo -= pad
  hi += pad
  const y = (v: number) => T + ((hi - v) / (hi - lo)) * (H - T - B)
  const yt = niceTicks(lo, hi)
  const xt = niceTicks(a1, a0, 5)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 720, background: '#fff', borderRadius: 4 }} role="img" aria-label={yLabel}>
      {yt.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#e3e6ea" />
          <text x={L - 4} y={y(v) + 3} fontSize={10} textAnchor="end" fill="#333">{Math.round(v).toLocaleString('en-US')}</text>
        </g>
      ))}
      {xt.map((v) => (
        <g key={v}>
          <line x1={x(v)} x2={x(v)} y1={T} y2={H - B} stroke="#eef0f2" />
          <text x={x(v)} y={H - B + 12} fontSize={10} textAnchor="middle" fill="#333">{+v.toPrecision(3)}</text>
        </g>
      ))}
      <text x={(L + W - R) / 2} y={H - 3} fontSize={10} textAnchor="middle" fill="#333">Ma (million years ago)</text>
      <text x={4} y={T + 8} fontSize={10} fill="#333">{yLabel}</text>
      {lines.map((ln, li) => {
        // split into segments where `runs` changes, so each source curve gets its own colour
        const segs: { c: string; d: string }[] = []
        let cur = ''
        let curRun = -1
        for (let i = 0; i < n; i++) {
          const run = ln.runs ? ln.runs[i] : 0
          const pt = `${x(ages[i]).toFixed(1)},${y(ln.ys[i]).toFixed(1)}`
          if (run !== curRun) {
            if (cur) segs.push({ c: ln.runs ? RUN_COLOURS[curRun % RUN_COLOURS.length] : ln.colour, d: cur })
            cur = i > 0 ? `M${x(ages[i - 1]).toFixed(1)},${y(ln.ys[i - 1]).toFixed(1)}L${pt}` : `M${pt}`
            curRun = run
          } else cur += `L${pt}`
        }
        if (cur) segs.push({ c: ln.runs ? RUN_COLOURS[curRun % RUN_COLOURS.length] : ln.colour, d: cur })
        return segs.map((sg, i) => <path key={`${li}-${i}`} d={sg.d} fill="none" stroke={sg.c} strokeWidth={1.6} />)
      })}
      {nowAgeMa !== null ? <line x1={x(nowAgeMa)} x2={x(nowAgeMa)} y1={T} y2={H - B} stroke="#111" strokeWidth={1.5} /> : null}
    </svg>
  )
}

function creditAt(series: SeriesData, ageMa: number) {
  // step index whose end age is nearest
  let k = 0
  let best = Infinity
  for (let i = 0; i < series.ageMa.length; i++) {
    const d = Math.abs(series.ageMa[i] - ageMa)
    if (d < best) { best = d; k = i }
  }
  return series.credits[series.creditIdx[k]]
}

function ChartsView() {
  const s = useAppState()
  const ser = s.series
  if (!ser || !s.view) return <div><h2>Charts</h2><p className="muted">Waiting for the run.</p></div>
  const now = s.view.ageMa
  const credit = creditAt(ser, now)
  const seaFt = Array.from(ser.seaLevelM, mToFt)
  const shelf = Array.from(ser.subsShelfMPerMyr, mToFt)
  const basin = Array.from(ser.subsBasinMPerMyr, mToFt)
  return (
    <div>
      <h2>Sea level through time</h2>
      <Chart ages={ser.ageMa} lines={[{ ys: seaFt, colour: '#1b6ca8', runs: ser.creditIdx }]} nowAgeMa={now} yLabel="Sea level, ft" />
      <p className="credit" data-testid="sea-credit">
        <strong>In use at {now.toFixed(2)} Ma:</strong> {credit.name}. {credit.citations.join(' ')}
      </p>
      {ser.credits.length > 1 ? (
        <p className="muted">Line colours change where the spliced record changes: {ser.credits.map((c) => c.name).join(' / ')}.</p>
      ) : null}
      <h2>Subsidence rate through time</h2>
      <Chart ages={ser.ageMa} lines={[{ ys: shelf, colour: '#2e8b57' }, { ys: basin, colour: '#b8651b' }]} nowAgeMa={now} yLabel="ft per Myr" />
      <p className="muted"><span style={{ color: '#2e8b57' }}>green</span> landward edge, <span style={{ color: '#b8651b' }}>orange</span> basinward edge. The rate applied at each step.</p>
    </div>
  )
}

const def: ViewDefinition = { id: 'charts', title: 'Charts', region: 'well', order: 1, component: ChartsView }
export default def

import { store, useAppState } from '../../app/store'
import type { ViewDefinition } from '../types'
import { CAP_MEANING, TRAUGOTT_FLAG_PPG, TRAUGOTT_SOURCE, traugottCheck } from '../well/audit'
import { wellProfile } from '../well/profile'
import { ftToM } from '../../units'
import { DEFAULT_AIR_GAP_FT } from '../../engine/well'

const num = (v: number) => (v === 0 ? '0' : Math.abs(v) < 1e-3 || Math.abs(v) >= 1e4 ? v.toExponential(2) : String(+v.toPrecision(3)))

/** The checks that read the run on screen (AUD-1): the cap at the overburden, and the overburden against the Gulf regional trend. */
function RunChecks() {
  const s = useAppState()
  const v = s.view
  const tc = s.well ? traugottCheck(wellProfile(s.well, s.events, ftToM(s.wellPlan?.airGapFt ?? DEFAULT_AIR_GAP_FT)).trendCell) : null
  const ok = tc ? Math.abs(tc.gapPpg) <= TRAUGOTT_FLAG_PPG : true
  return (
    <div data-testid="run-checks">
      <h3>This run</h3>
      {v && v.clamps !== undefined ? (
        <div data-testid="check-clamps">
          <div><b>Pore pressure capped at the overburden:</b> {v.clamps.toLocaleString('en-US')} time{v.clamps === 1 ? '' : 's'} in this run; largest u / L now {(v.maxUOverL ?? 0).toFixed(3)} (1 = capped).</div>
          <div className="muted small">{CAP_MEANING}</div>
        </div>
      ) : <p className="muted small">Waiting for the run.</p>}
      {tc ? (
        <div data-testid="check-traugott" style={{ marginTop: 8 }}>
          <span className={ok ? 'pass' : 'fail'}>{ok ? 'PASS' : 'FAIL'}</span> Overburden gradient against the deep-water Gulf regional trend
          <div className="small" data-testid="traugott-numbers">
            Pseudo-well at column {s.well!.column + 1}, sediment cell nearest 12,000 ft below the sea floor (the deepest if the column is thinner), at {Math.round(tc.depthBelowSeaFt).toLocaleString('en-US')} ft below the sea surface
            ({Math.round(tc.waterDepthFt).toLocaleString('en-US')} ft of water): model {tc.modelPpg.toFixed(2)} ppg, trend {tc.trendPpg.toFixed(2)} ppg, gap {tc.gapPpg.toFixed(2)} ppg (limit {TRAUGOTT_FLAG_PPG} ppg).
          </div>
          <div className="muted small">{s.presetId === 'gulf' ? 'On the Gulf preset a gap here means the densities are not calibrated to the Gulf (North Sea compaction coefficients until AUD-3).' : 'The trend is for the deep-water Gulf; on other presets it is shown for reference, not as a failure of the model.'}</div>
          <div className="muted small">Source: {TRAUGOTT_SOURCE}</div>
        </div>
      ) : null}
    </div>
  )
}

function ChecksView() {
  const s = useAppState()
  const c = s.checks
  return (
    <div>
      <h2>Physics checks</h2>
      <RunChecks />
      <h3>Solver benchmarks</h3>
      <button disabled={c.running} onClick={() => void store.runChecks()}>{c.running ? 'Running\u2026' : 'Run checks'}</button>
      {c.results ? (
        <span className={c.allPass ? 'pass' : 'fail'} data-testid="checks-summary">
          {' '}{c.allPass ? 'ALL PASS' : 'SOME FAILED'} ({c.results.filter((r) => r.pass).length}/{c.results.length}, {Math.round(c.ms)} ms)
        </span>
      ) : null}
      {c.results ? (
        <ul className="checks">
          {c.results.map((r) => (
            <li key={r.id} data-testid="check-row">
              <span className={r.pass ? 'pass' : 'fail'}>{r.pass ? 'PASS' : 'FAIL'}</span> {r.label}
              <div className="small">{num(r.value)} (limit {num(r.limit)} {r.unit})</div>
              <div className="muted small">{r.detail}</div>
              <div className="muted small">Source: {r.cite}</div>
            </li>
          ))}
        </ul>
      ) : <p className="muted small">Runs the solver benchmarks against exact solutions and hand calculations.</p>}
    </div>
  )
}

const def: ViewDefinition = { id: 'checks', title: 'Physics checks', region: 'right', order: 3, component: ChecksView }
export default def

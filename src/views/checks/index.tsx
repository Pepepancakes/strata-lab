import { store, useAppState } from '../../app/store'
import type { ViewDefinition } from '../types'

const num = (v: number) => (v === 0 ? '0' : Math.abs(v) < 1e-3 || Math.abs(v) >= 1e4 ? v.toExponential(2) : String(+v.toPrecision(3)))

function ChecksView() {
  const s = useAppState()
  const c = s.checks
  return (
    <div>
      <h2>Physics checks</h2>
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

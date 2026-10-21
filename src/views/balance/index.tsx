import { useAppState } from '../../app/store'
import { m2ToKm2 } from '../../units'
import type { StateView } from '../../worker/protocol'
import type { ViewDefinition } from '../types'

export interface BalanceRow {
  label: string
  supplied: number
  stored: number
  exported: number
  imbalance: number
  relError: number
}

/** Balance rows in km^2 of section area (m^2 per metre of margin, divided by 1e6). */
export function balanceRows(v: StateView): BalanceRow[] {
  const { balance: b, ledger: l } = v
  const row = (label: string, keys: ('sand' | 'mud' | 'salt' | 'cement')[]): BalanceRow => {
    const sum = (f: (k: (typeof keys)[number]) => number) => keys.reduce((a, k) => a + f(k), 0)
    const supplied = sum((k) => l.cumIn[k])
    const err = sum((k) => b[k].error)
    return {
      label,
      supplied: m2ToKm2(supplied),
      stored: m2ToKm2(sum((k) => b[k].stored)),
      exported: m2ToKm2(sum((k) => l.cumOut[k])),
      imbalance: m2ToKm2(err),
      relError: supplied > 0 ? err / supplied : 0,
    }
  }
  const rows = [row('All sediment', ['sand', 'mud']), row('Sand only', ['sand'])]
  if (l.cumIn.salt > 0 || b.salt.stored !== 0) rows.push(row('Salt', ['salt']))
  if (l.cumIn.cement > 0 || b.cement.stored !== 0) rows.push(row('Quartz cement', ['cement']))
  return rows
}

function BalanceView() {
  const s = useAppState()
  if (!s.view) return <div><h2>Mass balance</h2><p className="muted">Waiting for the run.</p></div>
  const rows = balanceRows(s.view)
  const f = (v: number) => v.toFixed(3)
  return (
    <div>
      <h2>Mass balance</h2>
      <table className="num">
        <thead>
          <tr><th></th><th>supplied</th><th>stored</th><th>exported</th><th>imbalance</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td>{f(r.supplied)}</td><td>{f(r.stored)}</td><td>{f(r.exported)}</td>
              <td title={`${(r.relError * 100).toExponential(2)} % of supplied`}>{r.imbalance.toExponential(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">km² of solid in the section (grains only, no pores). Stored is the change since the start of the run. Exported = turbidite run-out, slope-failure debris and sediment that diffused out past the basinward edge of the section. Imbalance = stored − (supplied − exported); it should be zero to rounding.</p>
    </div>
  )
}

const def: ViewDefinition = { id: 'balance', title: 'Mass balance', region: 'right', order: 1, component: BalanceView }
export default def

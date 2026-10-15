import { useEffect } from 'react'
import type { Region } from '../views/types'
import { allViews, viewsForRegion } from '../views/registry'
import { store, useAppState } from './store'

const REGIONS: { region: Region; label: string; className: string }[] = [
  { region: 'controls', label: 'Controls', className: 'controls' },
  { region: 'section', label: 'Section', className: 'section' },
  { region: 'well', label: 'Pseudo-well and charts', className: 'well' },
  { region: 'right', label: 'Branches, balance, checks', className: 'right' },
]

export function App() {
  const s = useAppState()
  useEffect(() => {
    store.init()
  }, [])
  return (
    <div className="shell">
      <header>
        <h1>Strata Lab</h1>
        {s.error ? (
          <div className="errbar" role="alert">
            <span>{s.error}</span>
            <button onClick={() => store.clearError()}>Dismiss</button>
          </div>
        ) : null}
        {s.notice ? (
          <div className="warnbar" role="alert" data-testid="notice">
            <span>{s.notice}</span>
            <button onClick={() => store.clearNotice()}>Dismiss</button>
          </div>
        ) : null}
      </header>
      {REGIONS.map(({ region, label, className }) => (
        <section key={region} className={`region ${className}`} aria-label={label}>
          {viewsForRegion(allViews, region).map((v) => (
            <div key={v.id} className="view">
              <v.component />
            </div>
          ))}
        </section>
      ))}
      {s.pendingReplace ? (
        <div className="busy" role="presentation">
          <div role="alertdialog" aria-labelledby="replace-title" aria-describedby="replace-text" data-testid="replace-warning">
            <h2 id="replace-title">Replace unsaved work?</h2>
            <p id="replace-text">
              {s.pendingReplace.what} will replace your current scenario, which has changes that are not saved to a file.
            </p>
            <div className="row">
              <button onClick={() => void store.confirmReplaceAfterSave()}>Save first</button>
              <button onClick={() => store.confirmReplace()}>Replace</button>
              <button autoFocus onClick={() => store.cancelReplace()}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
      {s.busy ? (
        <div className="busy" role="status">
          <div>
            <div>{s.busy.label}{'\u2026'}</div>
            <progress max={1} value={s.busy.frac} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

import type { Region } from '../views/types'
import { allViews, viewsForRegion } from '../views/registry'

const REGIONS: { region: Region; label: string; className: string }[] = [
  { region: 'controls', label: 'Controls', className: 'controls' },
  { region: 'section', label: 'Section', className: 'section' },
  { region: 'well', label: 'Pseudo-well and charts', className: 'well' },
  { region: 'right', label: 'Branches, balance, checks', className: 'right' },
]

export function App() {
  return (
    <div className="shell">
      <header>
        <h1>Strata Lab</h1>
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
    </div>
  )
}

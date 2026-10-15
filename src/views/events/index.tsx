import { store, useAppState } from '../../app/store'
import type { ViewDefinition } from '../types'
import { eventRow } from './format'

function EventsView() {
  const s = useAppState()
  const dx = s.info?.dx ?? 1000
  const on = s.params[s.activeId]?.failOn === 1
  return (
    <div>
      <h2>Slope failures (MTDs)</h2>
      {s.events.length === 0 ? (
        <p className="muted small" data-testid="no-events">
          {on ? 'No slope failure in this run.' : 'Slope failure is off. Turn it on under Controls (it restarts the run), or pick the \u201cOverpressured slope (MTD-prone)\u201d preset.'}
        </p>
      ) : (
        <div className="evtable">
          <table className="num" data-testid="event-list">
            <caption className="muted small">Click a row to go to the event. Volume is the removed area of this 2D section.</caption>
            <thead>
              <tr>
                <th scope="col">#</th><th scope="col">Time (Ma)</th><th scope="col">Cause</th><th scope="col">Source (km)</th>
                <th scope="col">Scar (ft)</th><th scope="col">Volume (km&sup2;)</th><th scope="col">Run-out (km)</th>
              </tr>
            </thead>
            <tbody>
              {s.events.map((e) => {
                const r = eventRow(e, dx)
                const future = e.step + 1 > s.step
                return (
                  <tr
                    key={e.id}
                    className={`${s.selectedEvent === e.id ? 'sel' : ''} ${future ? 'future' : ''}`}
                    data-event={e.id}
                    aria-selected={s.selectedEvent === e.id}
                  >
                    <td><button className="evbtn" onClick={() => store.selectEvent(s.selectedEvent === e.id ? null : e.id)} aria-label={`Go to event ${e.id}, ${r.timeMa} Ma`}>{r.id}</button></td>
                    <td>{r.timeMa}</td><td className="cause">{r.cause}</td><td>{r.sourceKm}</td><td>{r.scarFt}</td><td>{r.volumeKm2}</td><td>{r.runoutKm}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">Cause is the dominant trigger found by comparing the slope and the pore pressure before the failure with now (triggers.ts). Greyed rows happen after the current time.</p>
    </div>
  )
}

const def: ViewDefinition = { id: 'events', title: 'Slope failures', region: 'right', order: 0, component: EventsView }
export default def

import { Fragment, useState } from 'react'
import type { FailureEvent } from '../../engine/state'
import { store, useAppState } from '../../app/store'
import type { ViewDefinition } from '../types'
import { CAUSE_RULE_HELP, causeTerms, DEFAULT_THRESHOLDS, eventFlags, STALLED_HELP, unresolvedColumns, WINDOW_LIMITED_HELP, type CauseThresholds } from './causes'
import { eventRow } from './format'

/** A one-tap (i) explanation. The button is 44 px square to be easy to hit. */
function Hint({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span>
      <button
        className="info"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        style={{ minHeight: 44, minWidth: 44, borderRadius: 22 }}
      >
        {'\u24d8'}
      </button>
      {open ? <span className="srctext" role="note">{text}</span> : null}
    </span>
  )
}

export interface EventsListProps {
  events: readonly FailureEvent[]
  dx: number
  /** Current view step; events after it are greyed. */
  step: number
  selected: number | null
  thresholds?: CauseThresholds
  onSelect?: (id: number | null) => void
}

/** The table of events: one row each, with the three cause terms and the flags under the row. */
export function EventsList({ events, dx, step, selected, thresholds = DEFAULT_THRESHOLDS, onSelect }: EventsListProps) {
  const unresolved = unresolvedColumns(events)
  const nStalled = events.filter((e) => e.stalled).length
  return (
    <div className="evtable">
      <p className="small" data-testid="event-header">
        {events.length} events, {nStalled} stalled; {unresolved} unresolved column{unresolved === 1 ? '' : 's'}
        <Hint label="What unresolved columns are" text={STALLED_HELP} />
      </p>
      <table className="num" data-testid="event-list">
        <caption className="muted small">Click a row to go to the event. Volume is the removed area of this 2D section.</caption>
        <thead>
          <tr>
            <th scope="col">#</th><th scope="col">Time (Ma)</th>
            <th scope="col">Cause <Hint label="How the cause label is chosen" text={CAUSE_RULE_HELP} /></th>
            <th scope="col">Source (km)</th><th scope="col">Scar (ft)</th><th scope="col">Volume (km&sup2;)</th><th scope="col">Run-out (km)</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => {
            const r = eventRow(e, dx)
            const t = causeTerms(e, thresholds)
            const f = eventFlags(e, thresholds)
            const future = e.step + 1 > step
            const cls = `${selected === e.id ? 'sel' : ''} ${future ? 'future' : ''} ${f.stalled ? 'stalled' : ''}`
            return (
              <Fragment key={e.id}>
                <tr className={cls} data-event={e.id} aria-selected={selected === e.id}>
                  <td><button className="evbtn" onClick={() => onSelect?.(selected === e.id ? null : e.id)} aria-label={`Go to event ${e.id}, ${r.timeMa} Ma`}>{r.id}</button></td>
                  <td>{r.timeMa}</td>
                  <td className="cause">{r.cause}{f.stalled ? ' (stalled)' : ''}</td>
                  <td>{r.sourceKm}</td><td>{r.scarFt}</td><td>{r.volumeKm2}</td><td>{r.runoutKm}</td>
                </tr>
                <tr className={`${cls} evdetail`} data-event-detail={e.id}>
                  <td />
                  <td colSpan={6} className="small muted" style={{ textAlign: "left" }}>
                    <span data-testid="cause-terms">{t.slope.text}; {t.pressure.text}; {t.seaLevel.text}</span>
                    {f.stalledNote ? (
                      <div data-testid="stalled-note" style={{ display: "flex", alignItems: "center", gap: 4 }}>{f.stalledNote}<Hint label={`What stalled means (event ${e.id})`} text={STALLED_HELP} /></div>
                    ) : null}
                    {f.windowNote ? (
                      <div data-testid="window-note" style={{ display: "flex", alignItems: "center", gap: 4 }}>{f.windowNote}<Hint label={`What window-limited means (event ${e.id})`} text={WINDOW_LIMITED_HELP} /></div>
                    ) : null}
                  </td>
                </tr>
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function EventsView() {
  const s = useAppState()
  const dx = s.info?.dx ?? 1000
  const p = s.params[s.activeId]
  const on = p?.failOn === 1
  const th: CauseThresholds = p
    ? { failSlopeTerm: p.failSlopeTerm, failPressTerm: p.failPressTerm, failLowstandDrop: p.failLowstandDrop, stabMaxDepth: p.stabMaxDepth }
    : DEFAULT_THRESHOLDS
  return (
    <div>
      <h2>Slope failures (MTDs)</h2>
      {s.events.length === 0 ? (
        <p className="muted small" data-testid="no-events">
          {on ? 'No slope failure in this run.' : 'Slope failure is off. Turn it on under Controls (it restarts the run), or pick the \u201cOverpressured slope (MTD-prone)\u201d preset.'}
        </p>
      ) : (
        <EventsList events={s.events} dx={dx} step={s.step} selected={s.selectedEvent} thresholds={th} onSelect={(id) => store.selectEvent(id)} />
      )}
      <p className="muted small">Cause is the term that pushed hardest towards failure, each measured against its own threshold (tap the (i) by Cause). Greyed rows happen after the current time.</p>
    </div>
  )
}

const def: ViewDefinition = { id: 'events', title: 'Slope failures', region: 'right', order: 0, component: EventsView }
export default def

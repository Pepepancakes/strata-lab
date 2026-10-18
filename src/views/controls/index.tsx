import { useState, type ReactNode } from 'react'
import { store, useAppState, type AppState } from '../../app/store'
import { describeSchedule, MIN_RUN_MA, stepCount } from '../../app/scenario'
import { PARAMS, type ParamDef, type ParamValue } from '../../engine/params'
import { PRESETS, presetParams, type PresetId } from '../../engine/presets'
import { getReference } from '../../engine/references'
import { displayConversion } from '../../units'
import type { ViewDefinition } from '../types'
import { changedKeys, DEFAULT_OPEN, filterGroups, GROUPS, modeNote, type ShownGroup } from './groups'
import { accuracyMode, costText } from './accuracy'

/** Where the open / closed state of the groups is remembered (its own key, not the scenario autosave). */
export const OPEN_GROUPS_KEY = 'strata-lab:ui:openGroups'

/** The ids of the open groups from storage; the defaults when there is nothing, it is damaged, or storage is blocked. */
export function loadOpenGroups(): string[] {
  try {
    const raw = window.localStorage.getItem(OPEN_GROUPS_KEY)
    if (raw === null) return [...DEFAULT_OPEN]
    const v: unknown = JSON.parse(raw)
    if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return v as string[]
  } catch { /* storage blocked: use the defaults */ }
  return [...DEFAULT_OPEN]
}

function saveOpenGroups(ids: string[]): void {
  try { window.localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(ids)) } catch { /* storage blocked: not remembered */ }
}

const OPTION_LABELS: Record<string, string> = { curve: 'Published curve', sine: 'Sine (teaching)' }

export interface SourceText {
  tag: 'cited' | 'tuned' | 'to verify'
  text: string
}

/** The words behind the (i) button of a parameter. */
export function sourceText(def: ParamDef): SourceText {
  const { kind, refId, note } = def.source
  if (kind === 'cited') {
    const ref = refId ? getReference(refId) : undefined
    return { tag: 'cited', text: `${ref ? ref.full : (refId ?? '')} ${note}`.trim() }
  }
  const ref = refId ? getReference(refId) : undefined
  const prefix = ref ? `Form from ${ref.full} ` : ''
  return { tag: kind === 'tuned' ? 'tuned' : 'to verify', text: `${prefix}${note}`.trim() }
}

function Info({ def }: { def: ParamDef }) {
  const [open, setOpen] = useState(false)
  const src = sourceText(def)
  return (
    <span>
      <span className={`tag tag-${src.tag.replace(' ', '-')}`} data-testid="source-tag">{src.tag}</span>
      <button className="info" aria-label={`Source of ${def.label}`} aria-expanded={open} onClick={() => setOpen(!open)}>
        {'\u24d8'}
      </button>
      {open ? <span className="srctext" role="note">{src.text}</span> : null}
    </span>
  )
}

function fmt(v: number): string {
  if (v === 0) return '0'
  const a = Math.abs(v)
  return a >= 1e5 || a < 1e-3 ? v.toExponential(3) : String(+v.toPrecision(5))
}

function NumberBox({ def, value, disabled, onCommit, index }: { def: ParamDef; value: number; disabled: boolean; onCommit: (si: number) => void; index?: number }) {
  const conv = displayConversion(def.unit, def.displayUnit)
  const shown = fmt(conv.to(value))
  const lo = Array.isArray(def.min) ? def.min[index ?? 0] : (def.min as number | null)
  const hi = Array.isArray(def.max) ? def.max[index ?? 0] : (def.max as number | null)
  return (
    <input
      type="number"
      key={shown}
      defaultValue={shown}
      disabled={disabled}
      step="any"
      min={typeof lo === 'number' ? fmt(conv.to(lo)) : undefined}
      max={typeof hi === 'number' ? fmt(conv.to(hi)) : undefined}
      aria-label={`${def.label}${def.components ? ' ' + def.components[index ?? 0] : ''} (${def.displayUnit})`}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      onBlur={(e) => {
        const d = Number(e.target.value)
        if (e.target.value === '' || !Number.isFinite(d)) { e.target.value = shown; return }
        const si = conv.from(d)
        if (Math.abs(si - value) > 1e-12 * Math.max(1, Math.abs(value))) onCommit(si)
      }}
    />
  )
}

type Values = Record<string, ParamValue>

/** Everything a control needs from the app state, worked out once by the panel. */
interface Ctx {
  /** Parameters of the active run (SI), or undefined before the first run. */
  p: Values | undefined
  /** Parameters of the preset (SI). */
  preset: Values
  changed: ReadonlySet<string>
  isBranch: boolean
  busy: boolean
}

function makeCtx(s: AppState): Ctx {
  const p = s.params[s.activeId] as unknown as Values | undefined
  const preset = presetParams(s.presetId) as unknown as Values
  return {
    p, preset,
    changed: new Set(p && !s.busy ? changedKeys(p, preset) : []), // not while a run is replacing the params
    isBranch: !!s.branches.find((b) => b.id === s.activeId)?.parentId,
    busy: !!s.busy,
  }
}

const defOf = (key: string): ParamDef => PARAMS.find((d) => d.key === key)!

/** The preset's value as John reads it (display units). */
function presetText(def: ParamDef, v: ParamValue): string {
  const conv = displayConversion(def.unit, def.displayUnit)
  const unit = def.displayUnit !== '-' && !def.options ? ` ${def.displayUnit}` : ''
  if (typeof v === 'string') return OPTION_LABELS[v] ?? v
  if (Array.isArray(v)) return `${v.map((x) => (typeof x === 'number' ? fmt(conv.to(x)) : String(x))).join(', ')}${unit}`
  if (v === null) return 'none'
  return `${fmt(conv.to(v))}${unit}`
}

function ChangedDot() {
  return <span className="changed-dot" role="img" aria-label="changed from preset" title="Changed from the preset" />
}

function Control({ def, ctx, note }: { def: ParamDef; ctx: Ctx; note?: string | null }) {
  const { p } = ctx
  const disabled = (ctx.isBranch && def.startOnly) || !p || ctx.busy
  const cur = p ? p[def.key] : def.default
  const unit = def.displayUnit
  const changed = ctx.changed.has(def.key)
  let input
  if (def.options) {
    input = (
      <select value={String(cur)} disabled={disabled} aria-label={def.label} onChange={(e) => void store.editParam(def.key, e.target.value)}>
        {def.options.map((o) => <option key={o} value={o}>{OPTION_LABELS[o] ?? o}</option>)}
      </select>
    )
  } else if (Array.isArray(cur)) {
    input = (
      <span className="pair">
        {cur.map((v, i) => (
          <label key={i} className="sub">
            {def.components?.[i] ?? i}
            <NumberBox def={def} index={i} value={v} disabled={disabled} onCommit={(si) => { const next = cur.slice(); next[i] = si; void store.editParam(def.key, next) }} />
          </label>
        ))}
      </span>
    )
  } else {
    input = <NumberBox def={def} value={Number(cur)} disabled={disabled} onCommit={(si) => void store.editParam(def.key, si)} />
  }
  return (
    <div className="control" data-param={def.key}>
      <div className="clabel">
        <span>{changed ? <ChangedDot /> : null}{def.label}{unit !== '-' && !def.options ? <span className="muted"> ({unit})</span> : null}</span>
        <Info def={def} />
      </div>
      {input}
      {changed ? <div className="muted small" data-testid="preset-value">preset {presetText(def, ctx.preset[def.key])}</div> : null}
      {note ? <div className="muted small">{note}</div> : null}
      {disabled && ctx.isBranch && def.startOnly ? <div className="muted small">Set at the start of the run; a branch cannot change it.</div> : null}
    </div>
  )
}

function ScenarioControls({ s }: { s: AppState }) {
  const preset = PRESETS.find((p) => p.id === s.presetId)!
  const lenDef: ParamDef = PARAMS.find((p) => p.key === 'duration')!
  const busy = !!s.busy
  return (
    <div className="scenario">
      <h2>Scenario</h2>
      <div className="control" data-param="preset">
        <div className="clabel">
          <span>Scenario preset</span>
          <span><span className="tag tag-tuned">tuned</span><PresetInfo note={preset.note} /></span>
        </div>
        <select value={s.presetId} disabled={busy} aria-label="Scenario preset" onChange={(e) => store.setPreset(e.target.value as PresetId)}>
          {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>
      <div className="control" data-param="runLength">
        <div className="clabel"><span>Run length <span className="muted">(Myr)</span></span><Info def={lenDef} /></div>
        <input
          type="number" key={s.runLengthMa} defaultValue={+s.runLengthMa.toPrecision(4)} min={MIN_RUN_MA} max={preset.runLengthMa} step="0.5"
          disabled={busy} aria-label="Run length (Myr)"
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          onBlur={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && Math.abs(v - s.runLengthMa) > 1e-6) store.setRunLength(v) }}
        />
        <div className="muted small">Up to {preset.runLengthMa} Myr for this preset; a shorter run keeps the youngest part.</div>
      </div>
      <div className="schedule" data-testid="schedule">
        <strong>Time steps:</strong> {describeSchedule(s.segments)} ({stepCount(s.segments)} steps). <span className="tag tag-tuned">tuned</span>
      </div>
      <DeepCompactionSwitch state={s} />
    </div>
  )
}

function PresetInfo({ note }: { note: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span>
      <button className="info" aria-label="Source of the scenario preset" aria-expanded={open} onClick={() => setOpen(!open)}>{'\u24d8'}</button>
      {open ? <span className="srctext" role="note">{note}</span> : null}
    </span>
  )
}

/** A 0/1 parameter as a check box: a group's switch, or coverBend. Start-only ones lock on a branch. */
function Toggle({ def, ctx, label, ariaLabel, children }: { def: ParamDef; ctx: Ctx; label: string; ariaLabel: string; children?: ReactNode }) {
  const { p } = ctx
  const disabled = (ctx.isBranch && def.startOnly) || !p || ctx.busy
  const on = Number(p ? p[def.key] : def.default) === 1
  const changed = ctx.changed.has(def.key)
  return (
    <div className="control" data-param={def.key}>
      <div className="clabel">
        <label className="toggle">
          <input type="checkbox" checked={on} disabled={disabled} aria-label={ariaLabel} onChange={(e) => void store.editParam(def.key, e.target.checked ? 1 : 0)} />
          {changed ? <ChangedDot /> : null}{' '}{label} {on ? 'on' : 'off'}
        </label>
        <Info def={def} />
      </div>
      {changed ? <div className="muted small" data-testid="preset-value">preset {Number(ctx.preset[def.key]) === 1 ? 'on' : 'off'}</div> : null}
      {ctx.isBranch && def.startOnly ? <div className="muted small">Set at the start of the run; a branch cannot change it.</div> : null}
      {!ctx.isBranch && def.startOnly ? <div className="muted small">Changing it runs the main run again from the start.</div> : null}
      {children}
    </div>
  )
}

/** Names of the group switches as the check box shows them. */
const SWITCH_LABELS: Record<string, { label: string; aria: string }> = {
  saltOn: { label: 'Salt layer', aria: 'Salt layer on' },
  failOn: { label: 'Slope failure (MTDs)', aria: 'Slope failure (MTDs) on' },
  thermal: { label: 'Temperature', aria: 'Temperature on' },
  cement: { label: 'Quartz cement', aria: 'Quartz cement on' },
}

const isOn = (ctx: Ctx, key: string): boolean => Number(ctx.p ? ctx.p[key] : defOf(key).default) === 1

/**
 * AUD-5: "Deep compaction: fast (bundled) / full accuracy (slower)". Start-only, main run only; shows the measured cost.
 * It sits in the Scenario block at the top of the column, not in Grid and numerical settings at the bottom (D20.1): it changes the
 * whole run and the section, so it must be on screen together with the section (D25 lesson; docs/handover.md, AUD-5).
 */
export function DeepCompactionSwitch({ state }: { state: AppState }) {
  const ctx = makeCtx(state)
  const presetId = state.presetId
  const mode = accuracyMode(ctx.preset.bundleEvery, ctx.p ? ctx.p.bundleEvery : ctx.preset.bundleEvery)
  const disabled = ctx.isBranch || !ctx.p || ctx.busy || mode === 'not-bundled'
  const row = { display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, cursor: disabled ? 'default' : 'pointer' } as const
  const pick = (full: boolean) => { if (!disabled && (mode === 'full') !== full) void store.setDeepCompaction(full) }
  return (
    <div className="control" data-param="deepCompaction" data-testid="deep-compaction" role="radiogroup" aria-label="Deep compaction">
      <div className="clabel"><span>Deep compaction</span></div>
      {mode === 'not-bundled' ? (
        <div className="muted small">This preset already solves deep compaction in full (no bundling), so there is nothing to switch.</div>
      ) : (
        <>
          <label style={row}>
            <input type="radio" name="deepCompaction" checked={mode === 'fast'} disabled={disabled} onChange={() => pick(false)} aria-label="Deep compaction: fast (bundled)" />
            Fast (bundled)
          </label>
          <label style={row}>
            <input type="radio" name="deepCompaction" checked={mode === 'full'} disabled={disabled} onChange={() => pick(true)} aria-label="Deep compaction: full accuracy (slower)" />
            Full accuracy (slower)
          </label>
          <div className="muted small" data-testid="deep-compaction-cost">{costText(presetId)} Pore pressure below about 5,000 ft is the part that changes.</div>
          {ctx.isBranch ? <div className="muted small">Set at the start of the run; a branch cannot change it.</div> : <div className="muted small">Changing it runs the main run again from the start.</div>}
        </>
      )}
    </div>
  )
}

function GroupSwitch({ switchKey, ctx }: { switchKey: string; ctx: Ctx }) {
  const names = SWITCH_LABELS[switchKey]
  // Cement runs inside the temperature step (src/engine/step.ts thermalStep), so it needs temperature.
  const needsTemp = switchKey === 'cement' && isOn(ctx, 'cement') && !isOn(ctx, 'thermal')
  return (
    <Toggle def={defOf(switchKey)} ctx={ctx} label={names.label} ariaLabel={names.aria}>
      {isOn(ctx, switchKey) ? null : <div className="muted small">Off: these settings have no effect until it is switched on.</div>}
      {needsTemp ? <div className="muted small">Needs Temperature on to have any effect.</div> : null}
    </Toggle>
  )
}

function GroupBlock({ shown, ctx, searching, open, onToggle }: { shown: ShownGroup; ctx: Ctx; searching: boolean; open: boolean; onToggle: (open: boolean) => void }) {
  const { group } = shown
  const p: Values = ctx.p ?? {}
  const key = group.switchKey
  const nChanged = [...(key ? [key] : []), ...group.sections.flatMap((x) => x.keys)].filter((k) => ctx.changed.has(k)).length
  // Controls the current mode ignores are replaced by a note, except in a search (which finds them).
  const hiddenInMode = (k: string): boolean => !searching && modeNote(k, p) !== null
  const count = shown.sections.reduce((n, sec) => n + sec.keys.filter((k) => !hiddenInMode(k)).length, 0)
  const total = group.sections.reduce((n, sec) => n + sec.keys.filter((k) => !hiddenInMode(k)).length, 0)
  return (
    <details className="group" data-group={group.id} open={open} onToggle={(e) => onToggle(e.currentTarget.open)}>
      <summary>
        <span className="gtitle">{group.title}</span>
        {key ? <span className={`badge ${isOn(ctx, key) ? 'badge-on' : 'badge-off'}`}>{isOn(ctx, key) ? 'on' : 'off'}</span> : null}
        {nChanged > 0 ? <span className="badge badge-changed">{nChanged} changed</span> : null}
        <span className="gcount muted small">{count < total ? `${count} of ${total}` : count}</span>
      </summary>
      {group.note ? <p className="muted small gnote">{group.note}</p> : null}
      {key ? <GroupSwitch switchKey={key} ctx={ctx} /> : null}
      {shown.sections.map((sec, i) => {
        const notes = new Set<string>()
        const rows: ReactNode[] = []
        for (const k of sec.keys) {
          const note = modeNote(k, p)
          if (note && !searching) {
            if (!notes.has(note)) { notes.add(note); rows.push(<div key={`note-${k}`} className="muted small mode-note">{note}</div>) }
          } else if (k === 'coverBend') {
            rows.push(<Toggle key={k} def={defOf(k)} ctx={ctx} label="Cover resists bending" ariaLabel="Cover resists bending" />)
          } else {
            rows.push(<Control key={k} def={defOf(k)} ctx={ctx} note={note} />)
          }
        }
        return (
          <div key={sec.heading ?? i} className="gsection">
            {sec.heading ? <h3>{sec.heading}</h3> : null}
            {rows}
          </div>
        )
      })}
    </details>
  )
}

/** The search box and the groups. Takes the state as a prop so a test can render it. */
export function ControlsPanel({ state, initialQuery = '', initialOpen }: { state: AppState; initialQuery?: string; initialOpen?: string[] }) {
  const [query, setQuery] = useState(initialQuery)
  const [openIds, setOpenIds] = useState<string[]>(() => initialOpen ?? loadOpenGroups())
  const ctx = makeCtx(state)
  const active = state.branches.find((b) => b.id === state.activeId)
  const searching = query.trim() !== ''
  const shown = filterGroups(GROUPS, query, (k) => defOf(k).label)
  const setOpen = (id: string, open: boolean) => {
    if (searching) return // a search opens its groups without changing what is remembered
    if (open === openIds.includes(id)) return
    const next = open ? [...openIds, id] : openIds.filter((x) => x !== id)
    setOpenIds(next)
    saveOpenGroups(next)
  }
  return (
    <div>
      <h2>Controls</h2>
      <p className="muted small">
        {active?.parentId ? `Editing branch "${active.label}". Start-only controls are locked.` : 'Editing the main run: a change runs it again from the start.'}
      </p>
      <div className="ctlsearch">
        <input
          type="search" value={query} onChange={(e) => setQuery(e.target.value)}
          aria-label="Find a parameter" placeholder="Find a parameter (e.g. salt, viscosity)"
        />
        {query !== '' ? <button aria-label="Clear search" onClick={() => setQuery('')}>{'\u00d7'}</button> : null}
      </div>
      {searching && shown.length === 0 ? <p className="muted">No parameter matches "{query.trim()}".</p> : null}
      {shown.map((g) => (
        <GroupBlock key={g.group.id} shown={g} ctx={ctx} searching={searching} open={searching || openIds.includes(g.group.id)} onToggle={(o) => setOpen(g.group.id, o)} />
      ))}
    </div>
  )
}

function ControlsView() {
  const s = useAppState()
  return (
    <div>
      <ScenarioControls s={s} />
      <ControlsPanel state={s} />
    </div>
  )
}

const def: ViewDefinition = { id: 'controls', title: 'Controls', region: 'controls', order: 1, component: ControlsView }
export default def

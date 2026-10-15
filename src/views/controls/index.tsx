import { useState } from 'react'
import { store, useAppState } from '../../app/store'
import { describeSchedule, MIN_RUN_MA, stepCount } from '../../app/scenario'
import { PARAMS, type ParamDef, type ParamValue } from '../../engine/params'
import { PRESETS, type PresetId } from '../../engine/presets'
import { getReference } from '../../engine/references'
import { displayConversion } from '../../units'
import type { ViewDefinition } from '../types'

/** Parameters shown at the top; everything else is under "All other parameters". */
const MAIN = ['supply', 'sandFrac', 'seaLevelKind', 'slAmp', 'slPeriod', 'slShift', 'subsShelf', 'subsBasin']
/** Set by the scenario controls (preset, run length and its schedule), not by a number box. */
const SCENARIO = ['duration', 'dtRec']

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

function Control({ def }: { def: ParamDef }) {
  const s = useAppState()
  const p = s.params[s.activeId] as unknown as Record<string, ParamValue> | undefined
  const isBranch = !!s.branches.find((b) => b.id === s.activeId)?.parentId
  const disabled = (isBranch && def.startOnly) || !p || !!s.busy
  const cur = p ? p[def.key] : def.default
  const unit = def.displayUnit
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
        <span>{def.label}{unit !== '-' && !def.options ? <span className="muted"> ({unit})</span> : null}</span>
        <Info def={def} />
      </div>
      {input}
      {disabled && isBranch && def.startOnly ? <div className="muted small">Set at the start of the run; a branch cannot change it.</div> : null}
    </div>
  )
}

function ScenarioControls() {
  const s = useAppState()
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

function ControlsView() {
  const s = useAppState()
  const editable = PARAMS.filter((d) => !SCENARIO.includes(d.key))
  const main = MAIN.map((k) => editable.find((d) => d.key === k)!).filter(Boolean)
  const rest = editable.filter((d) => !MAIN.includes(d.key))
  const active = s.branches.find((b) => b.id === s.activeId)
  return (
    <div>
      <ScenarioControls />
      <h2>Controls</h2>
      <p className="muted small">
        {active?.parentId ? `Editing branch "${active.label}". Start-only controls are locked.` : 'Editing the main run: a change runs it again from the start.'}
      </p>
      {main.map((d) => <Control key={d.key} def={d} />)}
      <details>
        <summary>All other parameters ({rest.length})</summary>
        {rest.map((d) => <Control key={d.key} def={d} />)}
      </details>
    </div>
  )
}

const def: ViewDefinition = { id: 'controls', title: 'Controls', region: 'controls', order: 1, component: ControlsView }
export default def

// The audit notes under the pseudo-well and the planned-well plot (AUD-1): bundled deep compaction (F-1), the pore-water
// viscosity and the limits of the pressures (F-2, F-9), the cap at the overburden (F-3), the Gulf preset (F-4a).
// The same strings go into the PNG title and the CSV header (see exportNotes).

import { presetParams } from '../../engine/presets'
import type { AppState } from '../../app/store'
import { bundlingNote, GULF_NOT_CALIBRATED, LIMITS_PARAGRAPH, runIsEdited, showsGulfNote } from './audit'

/** The bundleEvery the current run uses: the preset's value unless the user changed it under Controls. */
export function currentBundleEvery(s: Pick<AppState, 'presetId' | 'overrides'>): number {
  const o = s.overrides.bundleEvery
  return typeof o === 'number' ? o : presetParams(s.presetId).bundleEvery
}

/** The one-line notes that must travel with the numbers (plot, PNG, CSV). Empty entries are left out. */
export function exportNotes(s: Pick<AppState, 'presetId' | 'overrides' | 'segments'>): string[] {
  const out: string[] = []
  const b = bundlingNote({ presetId: s.presetId, bundleEvery: currentBundleEvery(s), edited: runIsEdited(s.presetId, s.overrides, s.segments) })
  if (b) out.push(b)
  if (showsGulfNote(s.presetId)) out.push(GULF_NOT_CALIBRATED)
  return out
}

export function AuditNotes({ s }: { s: Pick<AppState, 'presetId' | 'overrides' | 'segments'> }) {
  const notes = exportNotes(s)
  return (
    <div data-testid="audit-notes">
      {notes.map((n, i) => (
        <p key={i} className="small" role="note" data-testid={n === GULF_NOT_CALIBRATED ? 'gulf-note' : 'bundling-note'}
          style={{ background: '#fff4d6', border: '1px solid #b07a00', borderRadius: 4, padding: '6px 8px', color: '#4a3300' }}>{n}</p>
      ))}
      <p className="small muted" data-testid="pressure-limits">{LIMITS_PARAGRAPH}</p>
    </div>
  )
}

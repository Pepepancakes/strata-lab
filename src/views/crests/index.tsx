import { useMemo, useState } from 'react'
import { store, useAppState } from '../../app/store'
import { APP_VERSION, ENGINE_VERSION } from '../../version'
import { getPreset } from '../../engine/presets'
import { downloadBlob } from '../wellplan/exportPng'
import { WhatItMeans } from '../WhatItMeans'
import { viewHasSalt } from '../section/colors'
import type { ViewDefinition } from '../types'
import { crestCsv, crestFileName, crestRecordsCsv, type CrestExportContext } from './exportCrests'
import { LabelGlyph } from './Markers'
import { crestRows, fmt, LABEL_MEANING, LABEL_TEXT, sortRows, type SortDir, type SortKey } from './model'

export const CREST_INFO =
  'F is how fast the top of the salt rises at the crest, A is how fast the seafloor beside it builds up (the mean of the cells 3 to 5 km either side). Both are least-squares rates in ft/Myr over the last 1 Myr that the crest was within 1,640 ft of the seafloor. F - A above zero: the salt outpaced its flanks (tabular). Below zero: the flanks outpaced the salt (tapered). Within 82 ft/Myr of zero the label is unresolved (tuned noise floor). Hooks and wedges (the fold zones of 50 to 1,000 m) are not resolved at the grid size, so the label comes from the rates only.'

const COLUMNS: { key: SortKey; head: string; unit: string }[] = [
  { key: 'id', head: 'Crest', unit: '' },
  { key: 'xKm', head: 'x', unit: 'km' },
  { key: 'firstAgeMa', head: 'First', unit: 'Ma' },
  { key: 'lastAgeMa', head: 'Last', unit: 'Ma' },
  { key: 'atSeafloorMyr', head: 'At seafloor', unit: 'Myr' },
  { key: 'fFtPerMyr', head: 'F', unit: 'ft/Myr' },
  { key: 'aFtPerMyr', head: 'A', unit: 'ft/Myr' },
  { key: 'fMinusAFtPerMyr', head: 'F \u2212 A', unit: 'ft/Myr' },
  { key: 'ratioAF', head: 'A/F', unit: '' },
  { key: 'label', head: 'Label', unit: '' },
  { key: 'neighbourSaltFt', head: 'Salt beside', unit: 'ft' },
  { key: 'lOverH', head: 'L/h', unit: '' },
  { key: 'endText', head: 'How it ended', unit: '' },
]

function CrestsView() {
  const s = useAppState()
  const [key, setKey] = useState<SortKey>('id')
  const [dir, setDir] = useState<SortDir>('asc')
  const [status, setStatus] = useState<string | null>(null)
  const log = s.crestLog
  const rows = useMemo(() => (log ? sortRows(crestRows(log), key, dir) : []), [log, key, dir])
  const salty = !!s.view && viewHasSalt(s.view)
  if (!salty) return null // shown only when salt is on

  const onBranch = !!s.info && s.activeId !== s.info.rootId
  const sortBy = (k: SortKey): void => {
    if (k === key) setDir(dir === 'asc' ? 'desc' : 'asc')
    else {
      setKey(k)
      setDir('asc')
    }
  }
  const context = (): CrestExportContext => ({
    scenario: getPreset(s.presetId).label, presetId: s.presetId, dxM: s.info?.dx ?? 1000, appVersion: APP_VERSION, engineVersion: ENGINE_VERSION,
  })
  const save = (what: 'table' | 'records'): void => {
    if (!log) return
    try {
      const ctx = context()
      const text = what === 'table' ? crestCsv(ctx, log) : crestRecordsCsv(ctx, log)
      downloadBlob(crestFileName(ctx, what), new Blob([text], { type: 'text/csv;charset=utf-8' }))
      setStatus(`Saved ${crestFileName(ctx, what)}.`)
    } catch (e) {
      store.fail(`Export failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  const step = s.view?.step ?? 0

  return (
    <div className="crest-panel" data-testid="crest-panel">
      <div className="row">
        <h2>Salt crests</h2>
        <WhatItMeans what="F and A">{CREST_INFO}</WhatItMeans>
      </div>
      <p className="small muted" data-testid="crest-explain">
        F is the rise rate of the salt top at the crest and A is the rise rate of the seafloor beside it, both in ft/Myr over the last 1 Myr the crest was near the seafloor.
        Hooks and wedges are not resolved at the grid size, so the label comes from the rates only. Click a row to go to the crest&apos;s last age.
      </p>
      {onBranch ? (
        <p className="small muted" data-testid="crest-branch-note">The crest log is kept for the main run only. Switch to the main run to see it.</p>
      ) : !log ? (
        <p className="small muted">Waiting for the run.</p>
      ) : rows.length === 0 ? (
        <p className="small muted" data-testid="crest-none">No salt crest came within 1,640 ft of the seafloor in this run.</p>
      ) : (
        <>
          <div className="row" style={{ gap: 8, margin: '6px 0' }}>
            <button style={{ minHeight: 44 }} onClick={() => save('table')}>Export crests (CSV)</button>
            <button style={{ minHeight: 44 }} onClick={() => save('records')}>Export crest records (CSV)</button>
            <span className="small muted" role="status" data-testid="crest-export-status">{status ?? 'Saves the table (ft, ft/Myr, km, Ma) or the record behind each crest.'}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="num crest-table" data-testid="crest-table" style={{ fontSize: 12 }}>
              <caption className="small muted" style={{ textAlign: 'left' }}>
                {log.episodes.length} crest{log.episodes.length === 1 ? '' : 's'}. Sort with the column heads. Greyed rows are not active at the current time.
              </caption>
              <thead>
                <tr>
                  {COLUMNS.map((c) => (
                    <th key={c.key} scope="col" aria-sort={key === c.key ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'} style={{ verticalAlign: 'bottom' }}>
                      <button onClick={() => sortBy(c.key)} aria-label={`Sort by ${c.head}${c.unit ? ` (${c.unit})` : ''}`} style={{ minHeight: 44, minWidth: 44, background: 'transparent', border: 'none', color: 'inherit', fontWeight: 600, textAlign: 'inherit' }}>
                        {c.head}{c.unit ? <><br /><span className="muted small">{c.unit}</span></> : null}{key === c.key ? (dir === 'asc' ? ' \u25b2' : ' \u25bc') : ''}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const active = r.firstViewStep <= step && step <= r.lastViewStep
                  const sel = s.selectedCrest === r.id
                  return (
                    <tr key={r.id} className={sel ? 'sel' : active ? '' : 'future'} data-crest-row={r.id} aria-selected={sel}>
                      <td>
                        <button className="evbtn" style={{ minHeight: 44, minWidth: 44 }} onClick={() => store.selectCrest(sel ? null : r.id)} aria-label={`Go to crest ${r.id}, last age ${r.lastAgeMa.toFixed(2)} Ma`}>{r.id}</button>
                      </td>
                      <td>{fmt.one(r.xKm)}</td>
                      <td>{fmt.two(r.firstAgeMa)}</td>
                      <td>{fmt.two(r.lastAgeMa)}</td>
                      <td>{fmt.two(r.atSeafloorMyr)}</td>
                      <td>{fmt.signed0(r.fFtPerMyr)}</td>
                      <td>{fmt.signed0(r.aFtPerMyr)}</td>
                      <td>{fmt.signed0(r.fMinusAFtPerMyr)}</td>
                      <td>{fmt.ratio(r.ratioAF)}</td>
                      <td className="cause" title={LABEL_MEANING[r.label]}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><LabelGlyph label={r.label} />{LABEL_TEXT[r.label]}</span>
                      </td>
                      <td>{fmt.num0(r.neighbourSaltFt)}</td>
                      <td>{fmt.one(r.lOverH)}</td>
                      <td className="cause">{r.endText}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="small muted">
            Salt beside is the mean salt thickness {log.episodes[0] ? log.episodes[0].neighbourKm : 10} km either side at the crest&apos;s last record. L/h is the flow length to the nearest salt-free column over the mean salt thickness.
            {log.merged > 0 ? ` ${log.merged} candidate${log.merged === 1 ? '' : 's'} merged into an older crest and not listed.` : ''}
          </p>
        </>
      )}
    </div>
  )
}

const def: ViewDefinition = { id: 'crests', title: 'Salt crests', region: 'well', order: 0.75, component: CrestsView }
export default def

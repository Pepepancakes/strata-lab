import { useState } from 'react'
import { store } from '../../app/store'
import type { CrestLog } from '../../engine/crestLog'
import type { StateView } from '../../worker/protocol'
import { SECTION_CSS_HEIGHT } from '../section/draw'
import { crestRows, LABEL_MEANING, LABEL_SHAPE, LABEL_TEXT, markersAt, rowTip } from './model'

const SIZE = 22

/** The shape of a label: triangle up (tabular), triangle down (tapered), diamond (unresolved), with its letter. */
export function LabelGlyph({ label, selected }: { label: keyof typeof LABEL_SHAPE; selected?: boolean }) {
  const s = LABEL_SHAPE[label]
  const pts = s.shape === 'triangle-up' ? '11,1 21,20 1,20' : s.shape === 'triangle-down' ? '1,2 21,2 11,21' : '11,1 21,11 11,21 1,11'
  const ty = s.shape === 'triangle-up' ? 17 : s.shape === 'triangle-down' ? 12 : 15
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 22 22" aria-hidden="true" focusable="false">
      <polygon points={pts} fill={s.colour} stroke={selected ? '#ffe14d' : '#fff'} strokeWidth={selected ? 2.5 : 1.2} />
      <text x="11" y={ty} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff" fontFamily="system-ui, sans-serif">{s.letter}</text>
    </svg>
  )
}

/**
 * Markers over the section: one at each crest active at the current time, standing on the seafloor above the
 * crest column. Shape + letter show the label; hover or focus shows the row's numbers; a click picks the crest
 * (moves the time machine to its last age, like a click on its table row). Positions use the same mapping as the
 * canvas: x = (column + 0.5) / nx of the width, y = (zTop - seafloor) / (zTop - zBot) of the height.
 */
export function CrestMarkers({ log, view, extent, selected }: { log: CrestLog; view: StateView; extent: { zTop: number; zBot: number }; selected: number | null }) {
  const [tip, setTip] = useState('')
  const marks = markersAt(log, view.step)
  const rows = crestRows(log)
  const span = extent.zTop - extent.zBot
  return (
    <>
      <div aria-label="Crest markers" data-testid="crest-markers" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: SECTION_CSS_HEIGHT, pointerEvents: 'none' }}>
        {marks.map((m) => {
          const row = rows.find((r) => r.id === m.id)
          if (!row || !(span > 0)) return null
          const y = Math.max(0, Math.min(SECTION_CSS_HEIGHT, ((extent.zTop - view.H[m.col]) / span) * SECTION_CSS_HEIGHT))
          const text = rowTip(row)
          return (
            <button
              key={m.id}
              data-crest={m.id}
              data-label={m.label}
              aria-label={`Crest ${m.id}, ${LABEL_TEXT[m.label]}. ${text}`}
              aria-pressed={selected === m.id}
              title={text}
              onClick={() => store.selectCrest(m.id)}
              onMouseEnter={() => setTip(text)}
              onMouseLeave={() => setTip('')}
              onFocus={() => setTip(text)}
              onBlur={() => setTip('')}
              style={{
                position: 'absolute', left: `${((m.col + 0.5) / view.nx) * 100}%`, top: Math.max(22, y - 2), width: 44, height: 44,
                transform: 'translate(-50%, -100%)', pointerEvents: 'auto', background: 'transparent', border: 'none', padding: 0,
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 2,
              }}
            >
              <LabelGlyph label={m.label} selected={selected === m.id} />
            </button>
          )
        })}
      </div>
      <div className="small" data-testid="crest-tip" role="status" style={{ minHeight: '1.4em', color: '#f2d37a' }}>{tip}</div>
    </>
  )
}

/** The key to the markers: each shape, its letter and its meaning in words. */
export function CrestKey() {
  return (
    <div className="legend" aria-label="Crest marker key" data-testid="crest-key">
      {(['tabular', 'tapered', 'unresolved'] as const).map((l) => (
        <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} title={LABEL_MEANING[l]}>
          <LabelGlyph label={l} />{LABEL_SHAPE[l].letter} {LABEL_TEXT[l]}
        </span>
      ))}
    </div>
  )
}

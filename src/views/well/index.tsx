import { useState } from 'react'
import { useAppState } from '../../app/store'
import { eventSentence, eventsAtCell } from '../events/format'
import { ramp } from '../section/colors'
import type { ViewDefinition } from '../types'
import { wellProfile, type WellPoint } from './profile'

const W = 640
const H = 380
const TOP = 34
const BOT = 22
const TRACKS = [
  { x: 52, w: 150 },
  { x: 214, w: 90 },
  { x: 316, w: 120 },
  { x: 448, w: 60 },
]

type NumKey = 'poreEmw' | 'overburdenEmw' | 'hydroEmw' | 'porosity' | 'tempF'

function Track({ pts, field, x0, w, lo, hi, y, colour, dash }: { pts: WellPoint[]; field: NumKey; x0: number; w: number; lo: number; hi: number; y: (ft: number) => number; colour: string; dash?: string }) {
  const d = pts
    .filter((p) => p[field] !== null)
    .map((p, i) => `${i ? 'L' : 'M'}${(x0 + ((Math.max(lo, Math.min(hi, p[field] as number)) - lo) / (hi - lo)) * w).toFixed(1)},${y(p.tvdssFt).toFixed(1)}`)
    .join('')
  return <path d={d} fill="none" stroke={colour} strokeWidth={1.6} strokeDasharray={dash} />
}

function WellView() {
  const s = useAppState()
  const [tip, setTip] = useState('')
  const dx = s.info?.dx ?? 1000
  const w = s.well
  if (!w) return <div><h2>Pseudo-well</h2><p className="muted">Waiting for the run.</p></div>
  const prof = wellProfile(w, s.events)
  const pts = prof.points
  const topFt = Math.min(prof.topFt, 0)
  const botFt = Math.max(prof.bottomFt, 1000)
  const y = (ft: number) => TOP + ((ft - topFt) / (botFt - topFt)) * (H - TOP - BOT)
  const step = botFt - topFt > 20000 ? 5000 : botFt - topFt > 8000 ? 2000 : 1000
  const ticks: number[] = []
  for (let ft = Math.ceil(topFt / step) * step; ft <= botFt; ft += step) ticks.push(ft)
  const emwLo = 6
  const emwHi = 20
  const tMax = Math.max(250, Math.ceil(Math.max(...pts.map((p) => p.tempF), 100) / 50) * 50)
  const km = (w.xM / 1000).toFixed(0)
  return (
    <div>
      <h2>Pseudo-well at {km} km</h2>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 720, background: '#fff', borderRadius: 4 }} role="img" aria-label={`Pseudo-well at ${km} km, ${w.ageMa.toFixed(2)} Ma`}>
        {/* depth axis */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={46} x2={W - 140} y1={y(t)} y2={y(t)} stroke="#e3e6ea" />
            <text x={42} y={y(t) + 3} fontSize={10} textAnchor="end" fill="#333">{t.toLocaleString('en-US')}</text>
          </g>
        ))}
        <text x={4} y={13} fontSize={10} fill="#333">TVDSS, ft below the sea surface</text>
        {/* track 1: pressures in ppg EMW */}
        <text x={TRACKS[0].x} y={TOP - 4} fontSize={10} fill="#333">Pressure, ppg EMW</text>
        <rect x={TRACKS[0].x} y={TOP} width={TRACKS[0].w} height={H - TOP - BOT} fill="none" stroke="#999" />
        <Track pts={pts} field="hydroEmw" x0={TRACKS[0].x} w={TRACKS[0].w} lo={emwLo} hi={emwHi} y={y} colour="#2b7bd6" dash="4 3" />
        <Track pts={pts} field="overburdenEmw" x0={TRACKS[0].x} w={TRACKS[0].w} lo={emwLo} hi={emwHi} y={y} colour="#222" />
        <Track pts={pts} field="poreEmw" x0={TRACKS[0].x} w={TRACKS[0].w} lo={emwLo} hi={emwHi} y={y} colour="#d1352b" />
        <text x={TRACKS[0].x + 2} y={H - 8} fontSize={9} fill="#333">{emwLo}</text>
        <text x={TRACKS[0].x + TRACKS[0].w - 2} y={H - 8} fontSize={9} textAnchor="end" fill="#333">{emwHi}</text>
        {/* track 2: porosity */}
        <text x={TRACKS[1].x} y={TOP - 4} fontSize={10} fill="#333">Porosity</text>
        <rect x={TRACKS[1].x} y={TOP} width={TRACKS[1].w} height={H - TOP - BOT} fill="none" stroke="#999" />
        <Track pts={pts} field="porosity" x0={TRACKS[1].x} w={TRACKS[1].w} lo={0} hi={0.7} y={y} colour="#01665e" />
        <text x={TRACKS[1].x + 2} y={H - 8} fontSize={9} fill="#333">0</text>
        <text x={TRACKS[1].x + TRACKS[1].w - 2} y={H - 8} fontSize={9} textAnchor="end" fill="#333">0.7</text>
        {/* track 3: temperature with cementation onset */}
        <text x={TRACKS[2].x} y={TOP - 4} fontSize={10} fill="#333">Temperature, °F</text>
        <rect x={TRACKS[2].x} y={TOP} width={TRACKS[2].w} height={H - TOP - BOT} fill="none" stroke="#999" />
        <Track pts={pts} field="tempF" x0={TRACKS[2].x} w={TRACKS[2].w} lo={0} hi={tMax} y={y} colour="#c0392b" />
        <text x={TRACKS[2].x + 2} y={H - 8} fontSize={9} fill="#333">0</text>
        <text x={TRACKS[2].x + TRACKS[2].w - 2} y={H - 8} fontSize={9} textAnchor="end" fill="#333">{tMax}</text>
        {w.cementOn || prof.cemOnsetFt !== null ? (
          <g>
            <line x1={TRACKS[2].x + (prof.cemOnsetF / tMax) * TRACKS[2].w} x2={TRACKS[2].x + (prof.cemOnsetF / tMax) * TRACKS[2].w} y1={TOP} y2={H - BOT} stroke="#7b3fa0" strokeDasharray="3 3" />
            {prof.cemOnsetFt !== null ? (
              <g>
                <line x1={TRACKS[2].x} x2={TRACKS[2].x + TRACKS[2].w} y1={y(prof.cemOnsetFt)} y2={y(prof.cemOnsetFt)} stroke="#7b3fa0" />
                <text x={TRACKS[2].x + TRACKS[2].w - 2} y={y(prof.cemOnsetFt) - 3} fontSize={9} textAnchor="end" fill="#7b3fa0">
                  cementation starts {Math.round(prof.cemOnsetF)} °F{w.cementOn ? '' : ' (cement off)'}
                </text>
              </g>
            ) : null}
          </g>
        ) : null}
        {/* track 4: grain size column and salt */}
        <text x={TRACKS[3].x} y={TOP - 4} fontSize={10} fill="#333">Grain size</text>
        <rect x={TRACKS[3].x} y={TOP} width={TRACKS[3].w} height={H - TOP - BOT} fill="#fff" stroke="#999" />
        {pts.map((p) => {
          const y0 = y(p.tvdssFt - p.thickFt / 2)
          const y1 = y(p.tvdssFt + p.thickFt / 2)
          const c = ramp('grain', p.sandFrac)
          return <rect key={p.layer} x={TRACKS[3].x} y={y0} width={TRACKS[3].w} height={Math.max(0.6, y1 - y0)} fill={p.salt ? 'rgb(232,150,170)' : `rgb(${c[0]},${c[1]},${c[2]})`} />
        })}
        {prof.saltIntervals.map(([a, b], i) => (
          <text key={i} x={TRACKS[3].x + TRACKS[3].w + 4} y={y((a + b) / 2)} fontSize={10} fill="#a03050">salt</text>
        ))}
        {/* MTD intervals: hatched, with the event ids; hover (or focus) shows the event */}
        <defs>
          <pattern id="mtd-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="rgba(255,255,255,0.35)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#222" strokeWidth="2.4" />
          </pattern>
        </defs>
        {prof.mtdIntervals.map((m, i) => {
          const evs = m.layers.flatMap((l) => eventsAtCell(s.events, l, w.column)).filter((e, k, a) => a.findIndex((x) => x.id === e.id) === k)
          const label = evs.length ? evs.map((e) => `#${e.id}`).join(', ') : '?'
          const tip = evs.length ? evs.map((e) => eventSentence(e, dx)).join('\n') : 'MTD (event not found)'
          const y0 = y(m.topFt)
          const h = Math.max(3, y(m.botFt) - y0)
          return (
            <g key={i} data-testid="well-mtd" tabIndex={0} role="img" aria-label={tip} onMouseEnter={() => setTip(tip)} onMouseLeave={() => setTip('')} onFocus={() => setTip(tip)} onBlur={() => setTip('')}>
              <title>{tip}</title>
              <rect x={TRACKS[3].x} y={y0} width={TRACKS[3].w} height={h} fill="url(#mtd-hatch)" stroke={evs.some((e) => e.id === s.selectedEvent) ? '#d6a000' : '#222'} strokeWidth={evs.some((e) => e.id === s.selectedEvent) ? 2.5 : 1} />
              <text x={TRACKS[3].x + TRACKS[3].w + 4} y={y0 + Math.min(h, 12) - 2} fontSize={10} fontWeight={600} fill="#7a0e3d">MTD {label}</text>
            </g>
          )
        })}
        <text x={TRACKS[3].x} y={H - 8} fontSize={9} fill="#333">mud</text>
        <text x={TRACKS[3].x + TRACKS[3].w} y={H - 8} fontSize={9} textAnchor="end" fill="#333">sand</text>
        {/* legend */}
        <g fontSize={10}>
          <line x1={530} x2={555} y1={50} y2={50} stroke="#d1352b" strokeWidth={2} /><text x={560} y={53} fill="#333">pore</text>
          <line x1={530} x2={555} y1={66} y2={66} stroke="#222" strokeWidth={2} /><text x={560} y={69} fill="#333">overburden</text>
          <line x1={530} x2={555} y1={82} y2={82} stroke="#2b7bd6" strokeWidth={2} strokeDasharray="4 3" /><text x={560} y={85} fill="#333">hydrostatic</text>
        </g>
      </svg>
      <p className="mtdtip" data-testid="mtd-tip" aria-live="polite">{tip || (prof.mtdIntervals.length ? 'Hover a hatched interval to see its event.' : '')}</p>
      <p className="muted">Column {w.column + 1} at {w.ageMa.toFixed(2)} Ma. Click the section to move the well. Temperature is steady conduction (no burial transient).</p>
    </div>
  )
}

const def: ViewDefinition = { id: 'well', title: 'Pseudo-well', region: 'well', order: 0, component: WellView }
export default def

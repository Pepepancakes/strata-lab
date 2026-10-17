// The planned well drawn on the section (M4.3): a path with a white halo (so it shows on every colour mode),
// a triangle at the wellhead and a labelled square at total depth. Canvas drawing only; no geology here.

import { M_PER_FT } from '../../units'

/** A planned well as the section draws it: stations in km from the landward edge and ft TVDSS, with the width of the section. */
export interface SectionWellPath {
  xKm: ArrayLike<number>
  tvdssFt: ArrayLike<number>
  /** Number of stations to draw (the well may stop before its total depth). */
  n: number
  /** Width of the section, m (nx * dx). */
  widthM: number
  /** True when the last station is total depth; false when the well stopped early (left the section or reached the base of the record). */
  reachedTd: boolean
}

export const TD_COLOUR = '#d1352b'
export const STOPPED_COLOUR = '#e8a000'

export function drawWellPath(ctx: CanvasRenderingContext2D, wp: SectionWellPath, sl: number, W: number, row: (z: number) => number, dpr: number): void {
  const px = (i: number) => ((wp.xKm[i] * 1000) / wp.widthM) * W
  const py = (i: number) => row(sl - wp.tvdssFt[i] * M_PER_FT)
  const stride = Math.max(1, Math.floor(wp.n / 300)) // about 300 segments is plenty for the screen
  const trace = () => {
    ctx.beginPath()
    ctx.moveTo(px(0), py(0))
    for (let i = stride; i < wp.n - 1; i += stride) ctx.lineTo(px(i), py(i))
    ctx.lineTo(px(wp.n - 1), py(wp.n - 1))
  }
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  trace()
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'
  ctx.lineWidth = 5 * dpr
  ctx.stroke()
  trace()
  ctx.strokeStyle = '#111'
  ctx.lineWidth = 2.2 * dpr
  ctx.stroke()
  // wellhead: a small triangle on the rig-floor end of the path
  const x0 = px(0)
  const y0 = py(0)
  ctx.fillStyle = '#111'
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 1.5 * dpr
  ctx.beginPath()
  ctx.moveTo(x0, y0 - 1 * dpr)
  ctx.lineTo(x0 - 5 * dpr, y0 - 10 * dpr)
  ctx.lineTo(x0 + 5 * dpr, y0 - 10 * dpr)
  ctx.closePath()
  ctx.stroke()
  ctx.fill()
  // total depth: a filled square, labelled
  const xe = px(wp.n - 1)
  const ye = py(wp.n - 1)
  const r = 5 * dpr
  ctx.fillStyle = wp.reachedTd ? TD_COLOUR : STOPPED_COLOUR
  ctx.strokeStyle = '#111'
  ctx.lineWidth = 1.6 * dpr
  ctx.fillRect(xe - r, ye - r, 2 * r, 2 * r)
  ctx.strokeRect(xe - r, ye - r, 2 * r, 2 * r)
  ctx.font = `bold ${11 * dpr}px system-ui`
  const label = wp.reachedTd ? 'TD' : 'well stops'
  const tw = ctx.measureText(label).width
  const lx = xe + r + 4 * dpr + tw > W ? xe - r - 4 * dpr - tw : xe + r + 4 * dpr
  ctx.lineWidth = 3 * dpr
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'
  ctx.strokeText(label, lx, ye + 4 * dpr)
  ctx.fillStyle = '#111'
  ctx.fillText(label, lx, ye + 4 * dpr)
}

// Draws the stratigraphic section onto a canvas. The look follows spike 001 (app.html
// renderSection): per-pixel raster of the layers, time lines, seafloor, sea level, pseudo-well,
// shoreline / shelf-edge markers, ft and km axes, vertical-exaggeration label.
//
// Fallback-colour fix (spike 001): a layer can be empty in one column and present in its
// neighbour, so a pixel that falls on an empty cell takes the colour of the other neighbour
// instead of showing white sky ("white specks").

import type { ColorMode, Extent } from '../../app/store'
import { M_PER_FT, mToFt } from '../../units'
import { SALT } from '../../engine/record'
import type { StateView } from '../../worker/protocol'
import { BASEMENT, cellValue, pack, ramp, SALT_COLOUR, SKY, SUBSTRATE, WATER } from './colors'

export interface SectionDrawOptions {
  mode: ColorMode
  wellCol: number
  extent: Extent
  runLengthMa: number
}

/** Spacing of the time lines, Ma: 100 kyr for short runs, coarser for long ones. */
export function timeLineEveryMa(runLengthMa: number): number {
  if (runLengthMa <= 5) return 0.1
  if (runLengthMa <= 30) return 1
  return 5
}

function fitCanvas(cv: HTMLCanvasElement): { dpr: number; W: number; H: number } {
  const dpr = window.devicePixelRatio || 1
  const w = Math.max(1, cv.clientWidth)
  const h = Number(cv.getAttribute('height')) || 360
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr)
    cv.height = Math.round(h * dpr)
  }
  return { dpr, W: cv.width, H: cv.height }
}

/** Nice step for the depth axis, ft. */
function depthStepFt(rangeFt: number): number {
  if (rangeFt <= 20000) return 2000
  if (rangeFt <= 50000) return 5000
  return 10000
}

export function drawSection(cv: HTMLCanvasElement, v: StateView, o: SectionDrawOptions): void {
  const { dpr, W, H } = fitCanvas(cv)
  const ctx = cv.getContext('2d')
  if (!ctx) return
  const nx = v.nx
  const top = v.nLayers - 1
  const nb = top + 2
  const bnd = new Float64Array(nb * nx)
  const col = new Uint32Array((top + 1) * nx)
  for (let j = 0; j < nx; j++) {
    let z = v.b[j]
    bnd[j] = z
    for (let l = 0; l <= top; l++) {
      const i = l * nx + j
      z += v.thick![i]
      bnd[(l + 1) * nx + j] = z
      if (l === 0) col[i] = SUBSTRATE
      else if (v.material[i] === SALT) col[i] = SALT_COLOUR
      else col[i] = v.sand![i] + v.mud![i] > 0 ? pack(ramp(o.mode, cellValue(v, o.mode, l, j))) : 0
    }
  }
  const SL = v.seaLevelM
  const { zTop, zBot } = o.extent
  const sy = H / (zTop - zBot)
  const row = (z: number) => Math.round((zTop - z) * sy)
  const img = ctx.createImageData(W, H)
  const buf = new Uint32Array(img.data.buffer)
  buf.fill(SKY)
  for (let px = 0; px < W; px++) {
    const xf = ((px + 0.5) / W) * nx - 0.5
    let j0 = Math.floor(xf)
    let w = xf - j0
    if (j0 < 0) { j0 = 0; w = 0 }
    if (j0 >= nx - 1) { j0 = nx - 1; w = 0 }
    const j1 = Math.min(j0 + 1, nx - 1)
    const jn = w < 0.5 ? j0 : j1
    const lerp = (l: number) => bnd[l * nx + j0] * (1 - w) + bnd[l * nx + j1] * w
    const surf = lerp(top + 1)
    if (SL > surf) for (let r = Math.max(0, row(SL)); r < Math.min(H, row(surf)); r++) buf[r * W + px] = WATER
    for (let r = Math.max(0, row(lerp(0))); r < H; r++) buf[r * W + px] = BASEMENT
    let zt = surf
    for (let l = top; l >= 0; l--) {
      const zb = lerp(l)
      const c = col[l * nx + jn] || col[l * nx + (jn === j0 ? j1 : j0)]
      if (c && zt > zb) {
        const r0 = Math.max(0, row(zt))
        const r1 = Math.min(H, row(zb))
        for (let r = r0; r < r1; r++) buf[r * W + px] = c
      }
      zt = zb
    }
  }
  ctx.putImageData(img, 0, 0)

  const X = (j: number) => ((j + 0.5) / nx) * W
  // time lines
  const every = timeLineEveryMa(o.runLengthMa)
  ctx.lineWidth = 0.7 * dpr
  ctx.strokeStyle = 'rgba(20,20,20,0.35)'
  for (let l = 1; l <= top; l++) {
    if (Math.floor(v.layerAgeMa[l] / every + 1e-9) === Math.floor(v.layerAgeMa[l - 1] / every + 1e-9)) continue
    ctx.beginPath()
    for (let j = 0; j < nx; j++) {
      const y = row(bnd[l * nx + j])
      if (j) ctx.lineTo(X(j), y)
      else ctx.moveTo(X(j), y)
    }
    ctx.stroke()
  }
  // seafloor and sea level
  ctx.strokeStyle = 'rgba(0,0,0,0.8)'
  ctx.lineWidth = dpr
  ctx.beginPath()
  for (let j = 0; j < nx; j++) {
    const y = row(bnd[(top + 1) * nx + j])
    if (j) ctx.lineTo(X(j), y)
    else ctx.moveTo(X(j), y)
  }
  ctx.stroke()
  ctx.strokeStyle = '#2b7bd6'
  ctx.setLineDash([6 * dpr, 4 * dpr])
  ctx.beginPath()
  ctx.moveTo(0, row(SL))
  ctx.lineTo(W, row(SL))
  ctx.stroke()
  ctx.setLineDash([])
  // pseudo-well
  if (o.wellCol >= 0 && o.wellCol < nx) {
    ctx.strokeStyle = '#111'
    ctx.lineWidth = 2 * dpr
    ctx.beginPath()
    ctx.moveTo(X(o.wellCol), row(Math.max(SL, v.H[o.wellCol])))
    ctx.lineTo(X(o.wellCol), row(v.b[o.wellCol]))
    ctx.stroke()
  }
  // shoreline and shelf edge
  ctx.font = `${11 * dpr}px system-ui`
  ctx.fillStyle = '#123'
  const mark = (j: number, txt: string) => {
    if (j < 0) return
    const x = X(j)
    const y = row(SL) - 4 * dpr
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x - 4 * dpr, y - 7 * dpr)
    ctx.lineTo(x + 4 * dpr, y - 7 * dpr)
    ctx.fill()
    ctx.fillText(txt, x + 6 * dpr, y - 2 * dpr)
  }
  mark(v.shore, 'shoreline')
  if (v.shelfEdge !== v.shore) mark(v.shelfEdge, 'shelf edge')
  // axes: depth in ft below datum, distance in km
  ctx.fillStyle = 'rgba(30,35,43,0.85)'
  ctx.font = `${10 * dpr}px system-ui`
  const stepFt = depthStepFt(mToFt(zTop - zBot))
  for (let ft = 0; ft >= mToFt(zBot); ft -= stepFt) {
    const y = row(ft * M_PER_FT)
    ctx.fillRect(0, y, 5 * dpr, dpr)
    ctx.fillText(`${(-ft).toLocaleString('en-US')} ft`, 7 * dpr, y + 3 * dpr)
  }
  const lenKm = (nx * v.dx) / 1000
  const kmStep = lenKm > 200 ? 50 : 25
  for (let km = 0; km <= lenKm; km += kmStep) {
    const x = ((km * 1000) / (nx * v.dx)) * W
    ctx.fillRect(x, H - 6 * dpr, dpr, 6 * dpr)
    ctx.fillText(`${km} km`, Math.min(x + 3 * dpr, W - 40 * dpr), H - 8 * dpr)
  }
  ctx.fillText(`vertical exaggeration \u2248 ${verticalExaggeration(nx * v.dx, W, zTop - zBot, H).toFixed(0)}\u00d7`, W - 170 * dpr, 14 * dpr)
}

/** Horizontal metres per pixel over vertical metres per pixel. */
export function verticalExaggeration(widthM: number, widthPx: number, heightM: number, heightPx: number): number {
  return widthM / widthPx / (heightM / heightPx)
}

/** Column under a click at fraction fx (0..1) across the canvas. */
export function columnAtFraction(fx: number, nx: number): number {
  return Math.max(0, Math.min(nx - 1, Math.floor(fx * nx)))
}

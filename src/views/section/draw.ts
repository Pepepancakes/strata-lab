// Draws the stratigraphic section onto a canvas. The look follows spike 001 (app.html
// renderSection): per-pixel raster of the layers, time lines, seafloor, sea level, pseudo-well,
// shoreline / shelf-edge markers, ft and km axes, vertical-exaggeration label.
//
// Fallback-colour fix (spike 001): a layer can be empty in one column and present in its
// neighbour, so a pixel that falls on an empty cell takes the colour of the other neighbour
// instead of showing white sky ("white specks").

import type { ColorMode, Extent } from '../../app/store'
import { M_PER_FT, mToFt } from '../../units'
import { MTD, SALT } from '../../engine/record'
import type { FailureEvent } from '../../engine/state'
import type { StateView } from '../../worker/protocol'
import { BASEMENT, COVER_SHADE, cellValue, NEUTRAL_SEDIMENT, pack, ramp, SALT_COLOUR, SALT_RAMP_MAX_M, saltColumnThickness, shade, SKY, SUBSTRATE, viewHasSalt, WATER, weldedColumns } from './colors'

export interface SectionDrawOptions {
  mode: ColorMode
  wellCol: number
  extent: Extent
  runLengthMa: number
  /** Slope failures of the run (all of them; only those up to the view's step are drawn). */
  events?: readonly FailureEvent[]
  selectedEvent?: number | null
}

/**
 * Which cells show the MTD texture: cells the record tags MTD, plus every cell in the deposit of a
 * failure event (the layer of the event, from depositFrom to depositTo). The engine tags a cell MTD
 * only when debris is at least half of its solids (failure.ts), and a fresh debris deposit is often
 * thinner than the normal sediment of its step, so the tag alone would hide most deposits.
 */
export function mtdMask(v: StateView, events?: readonly FailureEvent[]): Uint8Array {
  const out = new Uint8Array(v.nLayers * v.nx)
  for (let i = 0; i < out.length; i++) if (v.material[i] === MTD) out[i] = 1
  for (const e of events ?? []) {
    if (e.layer < 0 || e.layer >= v.nLayers || e.depositFrom < 0) continue
    for (let j = e.depositFrom; j <= e.depositTo; j++) out[e.layer * v.nx + j] = 1
  }
  // M2.8 (review finding 6): a cell with no sediment (or no thickness) cannot show, so it is never marked
  if (v.sand && v.mud && v.thick) {
    for (let i = 0; i < out.length; i++) if (out[i] && !(v.sand[i] + v.mud[i] > 0 && v.thick[i] > 0)) out[i] = 0
  }
  return out
}

/** A headwall stays marked for this many view steps after its event (the picked event always). */
export const SCAR_FLASH_STEPS = 3

/** View step at which an event first shows (record step k is seen at view step k + 1). */
export const eventViewStep = (e: FailureEvent): number => e.step + 1

/**
 * MTD texture: diagonal stripes whose direction changes from block to block (chaotic look), drawn
 * dark on a light colour and light on a dark one, so they show over every colour mode.
 * Pure function of the pixel position: no randomness.
 */
export function mtdTexture(c: number, px: number, py: number, dpr: number): number {
  const cell = Math.max(1, Math.round(10 * dpr))
  const bx = Math.floor(px / cell)
  const by = Math.floor(py / cell)
  const h = (Math.imul(bx, 73856093) ^ Math.imul(by, 19349663)) >>> 0
  const dir = h & 3
  const period = Math.max(3, Math.round(6 * dpr))
  const width = Math.max(1, Math.round(2 * dpr))
  const u = dir === 0 ? px + py : dir === 1 ? px - py + 4096 * period : dir === 2 ? px + py + 3 : py * 2 + px
  if (u % period >= width) return c
  const r = c & 255
  const g = (c >>> 8) & 255
  const b = (c >>> 16) & 255
  const dark = 0.299 * r + 0.587 * g + 0.114 * b > 120
  const k = dark ? 0.35 : 1
  const mix = (v: number) => (dark ? Math.round(v * k) : Math.round(v + (255 - v) * 0.6))
  return ((255 << 24) | (mix(b) << 16) | (mix(g) << 8) | mix(r)) >>> 0
}

/** Spacing of the time lines, Ma: 100 kyr for short runs, coarser for long ones. */
export function timeLineEveryMa(runLengthMa: number): number {
  if (runLengthMa <= 5) return 0.1
  if (runLengthMa <= 30) return 1
  return 5
}

/** Display height of the section, CSS px. The canvas is styled to exactly this height. */
export const SECTION_CSS_HEIGHT = 360

/**
 * Size the canvas backing store to its display size times the display scaling.
 * The CSS height is passed in, never read back from the canvas: the `height`
 * attribute IS the backing size, so reading it back multiplied it by the scaling
 * on every redraw (runaway growth and a crash above 100% Windows scaling).
 */
export function fitCanvas(cv: HTMLCanvasElement, cssHeight: number, dpr: number = window.devicePixelRatio || 1): { dpr: number; W: number; H: number } {
  const w = Math.max(1, cv.clientWidth)
  const h = cssHeight
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
  const { dpr, W, H } = fitCanvas(cv, SECTION_CSS_HEIGHT)
  const ctx = cv.getContext('2d')
  if (!ctx) return
  const nx = v.nx
  const top = v.nLayers - 1
  const nb = top + 2
  const bnd = new Float64Array(nb * nx)
  const col = new Uint32Array((top + 1) * nx)
  const isMtd = mtdMask(v, o.events)
  // Salt (M3.5): layer 0 is salt and layer 1 the older cover when the run has salt. Salt cells are salt-coloured in
  // every mode (never porosity or pressure); in salt-thickness mode the colour is the column's salt thickness.
  const hasSalt = viewHasSalt(v)
  const saltMode = o.mode === 'salt' && hasSalt
  const modeForCells: ColorMode = o.mode === 'salt' ? 'grain' : o.mode
  const saltThick = hasSalt ? saltColumnThickness(v) : null
  for (let j = 0; j < nx; j++) {
    let z = v.b[j]
    bnd[j] = z
    for (let l = 0; l <= top; l++) {
      const i = l * nx + j
      z += v.thick![i]
      bnd[(l + 1) * nx + j] = z
      if (hasSalt && v.material[i] === SALT) {
        col[i] = v.sand![i] + v.mud![i] > 0 ? (saltMode ? pack(ramp('salt', saltThick![j] / SALT_RAMP_MAX_M)) : SALT_COLOUR) : 0
      } else if (l === 0) col[i] = SUBSTRATE
      else if (v.sand![i] + v.mud![i] > 0) {
        const c = saltMode ? NEUTRAL_SEDIMENT : pack(ramp(modeForCells, cellValue(v, modeForCells, l, j)))
        col[i] = hasSalt && l === 1 ? shade(c, COVER_SHADE) : c // the older cover is a shade darker than the run's sediment
      } else col[i] = 0
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
      const jc = col[l * nx + jn] ? jn : jn === j0 ? j1 : j0
      const c = col[l * nx + jc]
      if (c && zt > zb) {
        const r0 = Math.max(0, row(zt))
        const r1 = Math.min(H, row(zb))
        if (isMtd[l * nx + jc]) for (let r = r0; r < r1; r++) buf[r * W + px] = mtdTexture(c, px, r, dpr)
        else for (let r = r0; r < r1; r++) buf[r * W + px] = c
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
  if (hasSalt) drawSaltMarks(ctx, v, bnd, X, row, dpr)
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
  // critical slip surface (factor of safety mode): where the infinite-slope search finds the weakest cell
  if (o.mode === 'fs' && v.fsMin && v.fsDepth && v.fsLayer) {
    const path = () => {
      let open = false
      ctx.beginPath()
      for (let j = 0; j < nx; j++) {
        if (v.fsLayer![j] >= 0 && v.fsMin![j] < FS_LINE_MAX) {
          const y = row(v.H[j] - v.fsDepth![j])
          if (open) ctx.lineTo(X(j), y)
          else ctx.moveTo(X(j), y)
          open = true
        } else open = false
      }
    }
    path()
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.lineWidth = 4 * dpr
    ctx.stroke()
    path()
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 1.6 * dpr
    ctx.setLineDash([6 * dpr, 4 * dpr])
    ctx.stroke()
    ctx.setLineDash([])
  }
  // failure events: headwall marks and the picked event's source and deposit
  if (o.events) drawEvents(ctx, v, o, bnd, X, row, dpr)
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

/** Colours of the salt marks (also used by the legend in index.tsx). */
export const WELD_LINE = '#3b0a24'
export const COVER_LINE = '#5a4630'

/**
 * Salt marks (M3.5): the top of the salt (a thin magenta line), the top of the older cover (a dashed brown line:
 * everything below it was laid down before the run), and the welds (a heavy dark line on the base of the salt,
 * where the salt has thinned below the weld thickness, with a white edge so it shows on every colour).
 * `bnd` holds the layer boundaries, (layer + 1) * nx + column: layer 0 (salt) lies between bnd[0..nx) and bnd[nx..2nx).
 */
function drawSaltMarks(
  ctx: CanvasRenderingContext2D, v: StateView, bnd: Float64Array,
  X: (j: number) => number, row: (z: number) => number, dpr: number,
): void {
  const nx = v.nx
  const trace = (layer: number) => {
    ctx.beginPath()
    for (let j = 0; j < nx; j++) {
      const y = row(bnd[layer * nx + j])
      if (j) ctx.lineTo(X(j), y)
      else ctx.moveTo(X(j), y)
    }
  }
  trace(1)
  ctx.strokeStyle = '#a02a62'
  ctx.lineWidth = 1.4 * dpr
  ctx.stroke()
  if (v.nLayers > 2) {
    trace(2)
    ctx.strokeStyle = COVER_LINE
    ctx.lineWidth = 1.2 * dpr
    ctx.setLineDash([5 * dpr, 3 * dpr])
    ctx.stroke()
    ctx.setLineDash([])
  }
  const welded = weldedColumns(v)
  let first = -1
  for (let j = 0; j <= nx; j++) {
    if (j < nx && welded[j]) {
      if (first < 0) first = j
      continue
    }
    if (first < 0) continue
    const a = first
    const b = j - 1
    first = -1
    const run = () => {
      ctx.beginPath()
      ctx.moveTo(X(a) - 0.5 * (X(1) - X(0)), row(bnd[a]))
      for (let k = a; k <= b; k++) ctx.lineTo(X(k), row(bnd[k]))
      ctx.lineTo(X(b) + 0.5 * (X(1) - X(0)), row(bnd[b]))
    }
    run()
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 6.5 * dpr
    ctx.lineCap = 'round'
    ctx.stroke()
    run()
    ctx.strokeStyle = WELD_LINE
    ctx.lineWidth = 3.5 * dpr
    ctx.stroke()
    ctx.lineCap = 'butt'
    ctx.font = `bold ${11 * dpr}px system-ui`
    ctx.fillStyle = WELD_LINE
    const mid = (X(a) + X(b)) / 2
    ctx.textAlign = 'center'
    ctx.fillText('weld', mid, row(bnd[Math.round((a + b) / 2)]) - 6 * dpr)
    ctx.textAlign = 'start'
  }
}

/** Horizontal metres per pixel over vertical metres per pixel. */
export function verticalExaggeration(widthM: number, widthPx: number, heightM: number, heightPx: number): number {
  return widthM / widthPx / (heightM / heightPx)
}

/** Column under a click at fraction fx (0..1) across the canvas. */
export function columnAtFraction(fx: number, nx: number): number {
  return Math.max(0, Math.min(nx - 1, Math.floor(fx * nx)))
}

/** The dashed critical-slip line is drawn where the weakest cell of the column has FS below this. */
const FS_LINE_MAX = 3

/**
 * Headwall marks (a red flag on the seafloor over the source columns) for events that just happened
 * or are picked, and the outline of the picked event's deposit. `bnd` holds the layer boundaries,
 * (layer + 1) * nx + column: the deposit of layer l lies between bnd[l] and bnd[l + 1].
 */
function drawEvents(
  ctx: CanvasRenderingContext2D, v: StateView, o: SectionDrawOptions, bnd: Float64Array,
  X: (j: number) => number, row: (z: number) => number, dpr: number,
): void {
  const nx = v.nx
  const top = v.nLayers - 1
  const surfY = (j: number) => row(bnd[(top + 1) * nx + j])
  for (const e of o.events ?? []) {
    const shown = eventViewStep(e)
    if (v.step < shown) continue
    const picked = e.id === o.selectedEvent
    if (!picked && v.step - shown >= SCAR_FLASH_STEPS) continue
    // source: the seafloor over the columns that failed
    ctx.strokeStyle = '#d6246e'
    ctx.lineWidth = 3 * dpr
    ctx.beginPath()
    for (let j = e.sourceFrom; j <= e.sourceTo; j++) {
      if (j === e.sourceFrom) ctx.moveTo(X(j), surfY(j))
      else ctx.lineTo(X(j), surfY(j))
    }
    ctx.stroke()
    // headwall flag at the upslope end
    const x = X(e.sourceFrom)
    const y = surfY(e.sourceFrom) - 6 * dpr
    ctx.fillStyle = '#d6246e'
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x - 5 * dpr, y - 9 * dpr)
    ctx.lineTo(x + 5 * dpr, y - 9 * dpr)
    ctx.fill()
    ctx.font = `bold ${11 * dpr}px system-ui`
    ctx.fillStyle = '#7a0e3d'
    ctx.fillText(`headwall #${e.id}`, x + 7 * dpr, y - 3 * dpr)
    // deposit outline of the picked event
    if (picked && e.depositFrom >= 0 && e.depositTo >= e.depositFrom && e.layer <= top) {
      const l = e.layer
      const trace = () => {
        ctx.beginPath()
        for (let j = e.depositFrom; j <= e.depositTo; j++) {
          const y0 = row(bnd[(l + 1) * nx + j])
          if (j === e.depositFrom) ctx.moveTo(X(j), y0)
          else ctx.lineTo(X(j), y0)
        }
        for (let j = e.depositTo; j >= e.depositFrom; j--) ctx.lineTo(X(j), row(bnd[l * nx + j]))
        ctx.closePath()
      }
      trace()
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 4.5 * dpr
      ctx.stroke()
      trace()
      ctx.strokeStyle = '#ffe14d'
      ctx.lineWidth = 2.5 * dpr
      ctx.stroke()
    }
  }
}

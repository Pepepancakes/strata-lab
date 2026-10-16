// Colour ramps and per-cell values for the section, copied from spike 001 (app.html) so the
// picture looks the same. Colours are packed as 0xAABBGGRR (little-endian RGBA), the layout of
// ImageData, so the raster can be written straight into a Uint32Array.

import { SALT } from '../../engine/record'
import { cToF, mToFt } from '../../units'
import type { ColorMode } from '../../app/store'
import type { StateView } from '../../worker/protocol'

export type Rgb = [number, number, number]
type Stop = [number, Rgb]

/** Factor-of-safety ramp: FS 0.25 .. 4 on a log scale, 1.0 in the middle; below FS_WARN the colours are red. */
export const FS_LO = 0.25
export const FS_HI = 4
export const FS_WARN = 1.2
const FS_SPAN = Math.log(FS_HI / FS_LO)
/** Ramp position of a factor of safety (Infinity and NaN give the top). */
export const fsToT = (fs: number): number => (fs > 0 ? Math.max(0, Math.min(1, 0.5 + Math.log(fs) / FS_SPAN)) : fs === 0 ? 0 : 1)
export const FS_WARN_T = fsToT(FS_WARN)

export const RAMPS: Record<ColorMode, Stop[]> = {
  grain: [[0, [92, 99, 88]], [0.35, [150, 145, 112]], [0.7, [226, 196, 110]], [1, [250, 214, 72]]],
  age: [[0, [68, 1, 84]], [0.25, [59, 82, 139]], [0.5, [33, 145, 140]], [0.75, [94, 201, 98]], [1, [253, 231, 37]]],
  phi: [[0, [84, 48, 5]], [0.35, [191, 129, 45]], [0.7, [199, 234, 229]], [1, [1, 102, 94]]],
  op: [[0, [236, 238, 232]], [0.25, [253, 208, 120]], [0.5, [240, 120, 60]], [0.75, [200, 40, 40]], [1, [110, 0, 30]]],
  // blue (cold) to red (hot); new in M1.6
  temp: [[0, [49, 54, 149]], [0.25, [116, 173, 209]], [0.5, [254, 224, 144]], [0.75, [244, 109, 67]], [1, [165, 0, 38]]],
  // factor of safety, log scale centred on FS = 1 (t = 0.5): reds up to FS 1.2 (the unsafe band), then pale to blue
  // salt thickness (M3.5): pale pink for thin salt to deep magenta for thick salt; sediment is grey in this mode
  salt: [[0, [253, 226, 234]], [0.35, [236, 140, 168]], [0.7, [176, 44, 104]], [1, [84, 0, 52]]],
  fs: [[0, [103, 0, 13]], [0.25, [165, 15, 21]], [0.5, [222, 45, 38]], [FS_WARN_T, [252, 187, 161]], [FS_WARN_T + 0.01, [226, 232, 240]], [0.7, [209, 226, 243]], [0.85, [107, 174, 214]], [1, [8, 81, 156]]],
}

export const MODES: { id: ColorMode; label: string }[] = [
  { id: 'grain', label: 'Grain size' },
  { id: 'age', label: 'Age' },
  { id: 'phi', label: 'Porosity' },
  { id: 'op', label: 'Overpressure (\u03bb*)' },
  { id: 'temp', label: 'Temperature (\u00b0F)' },
  { id: 'fs', label: 'Factor of safety' },
  // M3.5: the button shows only when the run has salt
  { id: 'salt', label: 'Salt thickness' },
]

/** Porosity range of the ramp (spike 001): 0.10 to 0.65. */
export const PHI_LO = 0.1
export const PHI_SPAN = 0.55
/** Temperature range of the ramp, deg C (32 to 392 deg F). */
export const TEMP_LO_C = 0
export const TEMP_HI_C = 200

export function ramp(mode: ColorMode, x: number): Rgb {
  const R = RAMPS[mode]
  const t0 = Math.max(0, Math.min(1, x))
  for (let i = 0; i < R.length - 1; i++) {
    const [a, ca] = R[i]
    const [b, cb] = R[i + 1]
    if (t0 <= b) {
      const t = (t0 - a) / (b - a)
      return [0, 1, 2].map((c) => Math.round(ca[c] + (cb[c] - ca[c]) * t)) as Rgb
    }
  }
  return R[R.length - 1][1]
}

export const pack = (c: Rgb): number => ((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0

export const SUBSTRATE = pack([170, 170, 170])
export const BASEMENT = pack([84, 86, 92])
export const WATER = pack([206, 227, 245])
export const SKY = pack([255, 255, 255])
/** Salt, pink as in spike 002. Not present in M1 runs; drawn when the record has it. */
export const SALT_COLOUR = pack([232, 150, 170])

/** Salt-thickness mode: the top of the ramp, m (5 km = 16,404 ft). Thicker salt takes the top colour. Fixed, so colours compare across time steps. */
export const SALT_RAMP_MAX_M = 5000
/** Sediment in salt-thickness mode: neutral grey (the older cover a shade darker). */
export const NEUTRAL_SEDIMENT = pack([214, 214, 210])
/** The older (pre-run) cover is drawn this much darker than the same colour in the run's own sediment. */
export const COVER_SHADE = 0.68

/** Does this view come from a run with salt? (layer 0 salt, layer 1 the older cover) */
export const viewHasSalt = (v: StateView): boolean => (v.nPre ?? 1) === 2

/** Darken a packed colour (0xAABBGGRR) by a factor 0..1. */
export function shade(c: number, k: number): number {
  const r = Math.round((c & 255) * k)
  const g = Math.round(((c >>> 8) & 255) * k)
  const b = Math.round(((c >>> 16) & 255) * k)
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0
}

/** Salt thickness of every column, m: bulk thickness of its salt cells that hold salt (zero where none is left). */
export function saltColumnThickness(v: StateView): Float64Array {
  const out = new Float64Array(v.nx)
  if (!v.thick) return out
  for (let l = 0; l < v.nLayers; l++) {
    for (let j = 0; j < v.nx; j++) {
      const i = l * v.nx + j
      if (v.material[i] === SALT && v.thick[i] > 0) out[j] += v.thick[i]
    }
  }
  return out
}

/** Is a column welded in this view? Its salt has thinned below the weld thickness after once being thicker (weldAge set). */
export function weldedColumns(v: StateView, thick: Float64Array = saltColumnThickness(v)): Uint8Array {
  const out = new Uint8Array(v.nx)
  if (!v.weldAge) return out
  const limit = v.weldThick ?? 10
  for (let j = 0; j < v.nx; j++) out[j] = v.weldAge[j] >= 0 && thick[j] < limit ? 1 : 0
  return out
}

/** Does the view carry the arrays this colour mode needs? (A new mode is drawn only once its data has arrived.) */
export function viewHasMode(v: StateView, mode: ColorMode): boolean {
  if (mode === 'op') return !!v.lam
  if (mode === 'temp') return !!v.temp
  if (mode === 'fs') return !!v.fsCell
  return true
}

/** The ramp position 0..1 of cell (layer l, column j) for a colour mode. */
export function cellValue(v: StateView, mode: ColorMode, l: number, j: number): number {
  const i = l * v.nx + j
  const s = v.sand![i]
  const m = v.mud![i]
  const tot = s + m
  switch (mode) {
    case 'grain':
      return s / tot
    case 'age': {
      // position in time of the middle of the layer: 0 = start of the run (old), 1 = present
      const start = v.layerAgeMa[0]
      const mid = (v.layerAgeMa[l] + v.layerAgeMa[l - 1]) / 2
      return start > 0 ? (start - mid) / start : 0
    }
    case 'phi':
      return (1 - tot / v.thick![i] - PHI_LO) / PHI_SPAN
    case 'op':
      return v.lam![i]
    case 'temp':
      return (v.temp![i] - TEMP_LO_C) / (TEMP_HI_C - TEMP_LO_C)
    case 'fs':
      return fsToT(v.fsCell![i])
    case 'salt':
      return 0 // salt cells take the colour of the column's salt thickness (draw.ts); sediment is neutral grey
  }
}

export interface Legend {
  /** Text at the low and high end of the ramp. */
  low: string
  high: string
  note: string
  /** The words behind the (i) button of the ramp (salt thickness mode only). */
  info?: string
}

export function legendFor(mode: ColorMode, startAgeMa: number): Legend {
  const t = (c: number) => `${Math.round(cToF(c))} \u00b0F`
  switch (mode) {
    case 'grain':
      return { low: 'mud', high: 'sand', note: 'share of sand in the layer' }
    case 'age':
      return { low: `${+startAgeMa.toPrecision(4)} Ma (old)`, high: '0 Ma (young)', note: 'age of the layer when it was laid down' }
    case 'phi':
      return { low: '0.10', high: '0.65', note: 'porosity' }
    case 'op':
      return { low: '0 hydrostatic', high: '1 at overburden', note: '\u03bb* = share of the buoyant load carried by the pore fluid' }
    case 'temp':
      return { low: t(TEMP_LO_C), high: t(TEMP_HI_C), note: 'steady conduction from the basal heat flow (no transient burial cooling)' }
    case 'salt': {
      const top = `${Math.round(mToFt(SALT_RAMP_MAX_M)).toLocaleString('en-US')} ft`
      return {
        low: '0 ft', high: `${top} or more`, note: 'thickness of the salt in the column; sediment is grey',
        info: `The colour of the salt shows how thick the salt is at that place, from pale pink (thin) to deep magenta (thick). The scale is fixed at 0 to ${top}, so colours compare between time steps; anything thicker takes the top colour. Sediment is grey so the salt stands out; the older cover (laid down before the run) is the darker grey. Thickness is the total salt in the column, in feet.`,
      }
    }
    case 'fs':
      return { low: `${FS_LO} (fails)`, high: `${FS_HI} (safe)`, note: `log scale, 1.0 in the middle, red below ${FS_WARN}; flat seafloor (no driving stress) is blue. Dashed line: critical slip depth. Hatched = MTD.` }
  }
}

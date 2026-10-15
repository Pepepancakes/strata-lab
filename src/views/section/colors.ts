// Colour ramps and per-cell values for the section, copied from spike 001 (app.html) so the
// picture looks the same. Colours are packed as 0xAABBGGRR (little-endian RGBA), the layout of
// ImageData, so the raster can be written straight into a Uint32Array.

import { cToF } from '../../units'
import type { ColorMode } from '../../app/store'
import type { StateView } from '../../worker/protocol'

export type Rgb = [number, number, number]
type Stop = [number, Rgb]

export const RAMPS: Record<ColorMode, Stop[]> = {
  grain: [[0, [92, 99, 88]], [0.35, [150, 145, 112]], [0.7, [226, 196, 110]], [1, [250, 214, 72]]],
  age: [[0, [68, 1, 84]], [0.25, [59, 82, 139]], [0.5, [33, 145, 140]], [0.75, [94, 201, 98]], [1, [253, 231, 37]]],
  phi: [[0, [84, 48, 5]], [0.35, [191, 129, 45]], [0.7, [199, 234, 229]], [1, [1, 102, 94]]],
  op: [[0, [236, 238, 232]], [0.25, [253, 208, 120]], [0.5, [240, 120, 60]], [0.75, [200, 40, 40]], [1, [110, 0, 30]]],
  // blue (cold) to red (hot); new in M1.6
  temp: [[0, [49, 54, 149]], [0.25, [116, 173, 209]], [0.5, [254, 224, 144]], [0.75, [244, 109, 67]], [1, [165, 0, 38]]],
}

export const MODES: { id: ColorMode; label: string }[] = [
  { id: 'grain', label: 'Grain size' },
  { id: 'age', label: 'Age' },
  { id: 'phi', label: 'Porosity' },
  { id: 'op', label: 'Overpressure (\u03bb*)' },
  { id: 'temp', label: 'Temperature (\u00b0F)' },
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

/** Does the view carry the arrays this colour mode needs? (A new mode is drawn only once its data has arrived.) */
export function viewHasMode(v: StateView, mode: ColorMode): boolean {
  if (mode === 'op') return !!v.lam
  if (mode === 'temp') return !!v.temp
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
  }
}

export interface Legend {
  /** Text at the low and high end of the ramp. */
  low: string
  high: string
  note: string
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
  }
}

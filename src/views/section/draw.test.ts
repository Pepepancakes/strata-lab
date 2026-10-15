import { describe, expect, it } from 'vitest'
import { fitCanvas } from './draw'

/** Minimal stand-in for a canvas element: the backing size is the width/height attributes. */
function fakeCanvas(clientWidth: number) {
  const attrs: Record<string, string> = { height: '360' }
  return {
    clientWidth,
    getAttribute: (k: string) => attrs[k] ?? null,
    get width() { return Number(attrs.width ?? 300) },
    set width(v: number) { attrs.width = String(v) },
    get height() { return Number(attrs.height ?? 150) },
    set height(v: number) { attrs.height = String(v) },
  } as unknown as HTMLCanvasElement
}

describe('fitCanvas (section canvas sizing)', () => {
  // Regression: at display scaling above 100% the height was read back from the
  // attribute it had just written, so every redraw multiplied it by the scaling
  // (360 -> 540 -> 810 ...) until the browser could not allocate the canvas.
  for (const dpr of [1, 1.25, 1.5, 2]) {
    it(`keeps a stable backing size over repeated redraws at ${dpr * 100}% scaling`, () => {
      const cv = fakeCanvas(1200)
      const first = fitCanvas(cv, 360, dpr)
      for (let i = 0; i < 20; i++) fitCanvas(cv, 360, dpr)
      expect(cv.height).toBe(Math.round(360 * dpr))
      expect(cv.width).toBe(Math.round(1200 * dpr))
      expect(first).toEqual({ dpr, W: Math.round(1200 * dpr), H: Math.round(360 * dpr) })
    })
  }
})

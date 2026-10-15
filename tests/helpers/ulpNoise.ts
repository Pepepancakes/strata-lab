// Emulates "another machine's libm": while `withUlpNoise` runs, the transcendental Math functions
// (pow, exp, log, trig ...) return their result times (1 + k * amp), with k in {-1, 0, +1} chosen
// from the result's own bits and a salt. amp = 2.2e-16 is one unit in the last place, the size of
// the differences between the Windows and the Linux maths libraries. It is deterministic, so a test
// that uses it is repeatable. sqrt, + - * / are exact in IEEE 754 and are not touched.
// Why: the engine's threshold logic (shoreline, shelf edge, slope failure) amplifies a 1 ulp
// difference into tens of metres of surface height (measured: 55 to 74 m on the default run).
// Tests that compare across machines must tolerate that; this helper lets them prove they do.
const NAMES = ['pow', 'exp', 'log', 'log10', 'log1p', 'expm1', 'tanh', 'atan', 'atan2', 'sin', 'cos', 'tan', 'cbrt'] as const

export function withUlpNoise<T>(amp: number, salt: number, fn: () => T): T {
  const f = new Float64Array(1)
  const u = new Uint32Array(f.buffer)
  const saved = NAMES.map((n) => Math[n])
  const jig = (x: number): number => {
    if (!Number.isFinite(x) || x === 0) return x
    f[0] = x
    const h = Math.imul(u[0] ^ (u[1] * 31) ^ salt, 0x9e3779b1) >>> 28 // 0..15
    return x * (1 + (h < 5 ? -1 : h < 10 ? 0 : 1) * amp)
  }
  NAMES.forEach((n, i) => {
    const orig = saved[i] as (...a: number[]) => number
    ;(Math as unknown as Record<string, unknown>)[n] = (...a: number[]) => jig(orig(...a))
  })
  try {
    return fn()
  } finally {
    NAMES.forEach((n, i) => {
      ;(Math as unknown as Record<string, unknown>)[n] = saved[i]
    })
  }
}

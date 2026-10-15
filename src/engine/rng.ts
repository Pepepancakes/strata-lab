// Seeded random numbers (mulberry32). Not used by physics yet.
// Why: the engine must be deterministic, so Math.random is banned in src/engine. If a later
// process needs randomness it uses this, and the state is part of snapshots.

export interface Rng {
  /** Next number in [0, 1). */
  next(): number
  getState(): number
  setState(s: number): void
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0
      let t = a
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
    getState: () => a,
    setState: (s) => {
      a = s >>> 0
    },
  }
}

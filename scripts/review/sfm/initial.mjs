// Initial surface, copied by hand from src/engine/step.ts PROFILE (reviewer's copy, so the hand
// calculations do not import the engine for an expected value).
const PROFILE = [[0, 15], [10000, 0], [40000, -100], [65000, -1500], [150000, -1900]]
export function initialSurface(x) {
  for (let i = 0; i < PROFILE.length - 1; i++) {
    const [x0, z0] = PROFILE[i], [x1, z1] = PROFILE[i + 1]
    if (x <= x1) return z0 + (z1 - z0) * (x - x0) / (x1 - x0)
  }
  return PROFILE[PROFILE.length - 1][1]
}

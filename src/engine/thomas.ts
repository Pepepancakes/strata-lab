// Tridiagonal solver (Thomas algorithm), used by transport (implicit diffusion) and compaction
// (implicit consolidation). Solves lo[i] x[i-1] + di[i] x[i] + up[i] x[i+1] = rhs[i], i < n.
// Assumes a diagonally dominant matrix (true for both users), so no pivoting. cp, dp are scratch.
// Benchmarked indirectly by the Gibson (1958) test and the transport mass balance.

export function thomas(
  n: number,
  lo: Float64Array,
  di: Float64Array,
  up: Float64Array,
  rhs: Float64Array,
  x: Float64Array,
  cp: Float64Array,
  dp: Float64Array,
): void {
  cp[0] = up[0] / di[0]
  dp[0] = rhs[0] / di[0]
  for (let i = 1; i < n; i++) {
    const m = di[i] - lo[i] * cp[i - 1]
    cp[i] = up[i] / m
    dp[i] = (rhs[i] - lo[i] * dp[i - 1]) / m
  }
  x[n - 1] = dp[n - 1]
  for (let i = n - 2; i >= 0; i--) x[i] = dp[i] - cp[i] * x[i + 1]
}

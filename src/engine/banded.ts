// Banded linear solver (M3.2): LU with partial pivoting for a general square band matrix with kl
// sub-diagonals and ku super-diagonals. Used by the cover-bending term of the salt flow, whose
// system has 3 sub- and 3 super-diagonals (salt.ts). Plain Gaussian elimination in a fixed order, so
// the result is deterministic (no Math calls, only + - * /). Same layout and algorithm as LAPACK
// dgbtf2/dgbtrs (unblocked). Benchmarked against a dense solve in tests/banded.test.ts.
//
// Storage: `ab` holds ldab = 2 kl + ku + 1 rows of n values, row-major. A(i, j) lives at
// ab[(kl + ku + i - j) * n + j], for max(0, j - ku) <= i <= min(n - 1, j + kl). The first kl rows
// are workspace for the fill-in that pivoting makes. `ab` is overwritten by the factors.

export interface BandedScratch {
  ab: Float64Array
  ipiv: Int32Array
}

export function makeBandedScratch(n: number, kl: number, ku: number): BandedScratch {
  return { ab: new Float64Array((2 * kl + ku + 1) * n), ipiv: new Int32Array(n) }
}

/** Index of A(i, j) in `ab`. */
export function bandIndex(n: number, kl: number, ku: number, i: number, j: number): number {
  return (kl + ku + i - j) * n + j
}

/**
 * Solve A x = b in place (b becomes x). A is given in `s.ab` (filled by the caller through
 * bandIndex; the kl workspace rows must be zero) and is destroyed. Throws if A is singular.
 */
export function solveBanded(n: number, kl: number, ku: number, s: BandedScratch, b: Float64Array): void {
  const { ab, ipiv } = s
  const kv = kl + ku
  const at = (i: number, j: number): number => (kv + i - j) * n + j
  let ju = 0
  for (let j = 0; j < n; j++) {
    const km = Math.min(kl, n - 1 - j)
    // pivot: largest |A(i, j)|, i = j..j+km (first one wins a tie)
    let jp = 0
    let best = Math.abs(ab[at(j, j)])
    for (let d = 1; d <= km; d++) {
      const v = Math.abs(ab[at(j + d, j)])
      if (v > best) {
        best = v
        jp = d
      }
    }
    ipiv[j] = j + jp
    if (!(best > 0)) throw new Error('solveBanded: singular matrix')
    ju = Math.max(ju, Math.min(j + ku + jp, n - 1))
    if (jp !== 0) {
      for (let c = j; c <= ju; c++) {
        const p = at(j, c)
        const q = at(j + jp, c)
        const t = ab[p]
        ab[p] = ab[q]
        ab[q] = t
      }
    }
    if (km > 0) {
      const piv = ab[at(j, j)]
      for (let d = 1; d <= km; d++) ab[at(j + d, j)] /= piv
      for (let c = j + 1; c <= ju; c++) {
        const u = ab[at(j, c)]
        if (u !== 0) for (let d = 1; d <= km; d++) ab[at(j + d, c)] -= ab[at(j + d, j)] * u
      }
    }
  }
  // forward: apply the row interchanges and the unit lower factor
  for (let j = 0; j < n; j++) {
    const l = ipiv[j]
    if (l !== j) {
      const t = b[j]
      b[j] = b[l]
      b[l] = t
    }
    const km = Math.min(kl, n - 1 - j)
    const bj = b[j]
    for (let d = 1; d <= km; d++) b[j + d] -= ab[at(j + d, j)] * bj
  }
  // backward: upper factor has up to kl + ku super-diagonals
  for (let j = n - 1; j >= 0; j--) {
    b[j] /= ab[at(j, j)]
    const bj = b[j]
    for (let i = Math.max(0, j - kv); i < j; i++) b[i] -= ab[at(i, j)] * bj
  }
}

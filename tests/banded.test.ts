// Banded solver against a dense Gaussian solve (full pivoting-free reference with partial pivoting).
import { describe, it, expect } from 'vitest'
import { bandIndex, makeBandedScratch, solveBanded } from '../src/engine/banded'
import { createRng } from '../src/engine/rng'

/** Dense solve with partial pivoting, the reference. */
function denseSolve(A: number[][], b: number[]): number[] {
  const n = b.length
  const M = A.map((r, i) => [...r, b[i]])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r
    ;[M[c], M[p]] = [M[p], M[c]]
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c]
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]
    }
  }
  const x = new Array<number>(n).fill(0)
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n]
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]
    x[r] = s / M[r][r]
  }
  return x
}

function randomBand(n: number, kl: number, ku: number, seed: number, weakDiagonal: boolean) {
  const rng = createRng(seed)
  const A: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  for (let i = 0; i < n; i++)
    for (let j = Math.max(0, i - kl); j <= Math.min(n - 1, i + ku); j++) A[i][j] = rng.next() * 2 - 1 + (i === j && !weakDiagonal ? 3 : 0)
  const b = Array.from({ length: n }, () => rng.next() * 2 - 1)
  return { A, b }
}

function bandSolve(A: number[][], b: number[], kl: number, ku: number): number[] {
  const n = b.length
  const s = makeBandedScratch(n, kl, ku)
  for (let i = 0; i < n; i++) for (let j = Math.max(0, i - kl); j <= Math.min(n - 1, i + ku); j++) s.ab[bandIndex(n, kl, ku, i, j)] = A[i][j]
  const x = Float64Array.from(b)
  solveBanded(n, kl, ku, s, x)
  return Array.from(x)
}

const relDiff = (a: number[], b: number[]): number => {
  let d = 0
  let m = 0
  for (let i = 0; i < a.length; i++) {
    d = Math.max(d, Math.abs(a[i] - b[i]))
    m = Math.max(m, Math.abs(b[i]))
  }
  return d / m
}

describe('banded solver against a dense solve', () => {
  const cases: Array<[number, number, number, boolean]> = [
    [30, 3, 3, false], // the salt system's shape
    [30, 3, 3, true], // weak diagonal: forces row interchanges
    [25, 1, 1, true], // tridiagonal
    [40, 2, 4, true],
    [40, 4, 1, true],
    [7, 3, 3, true],
    [1, 3, 3, false],
  ]
  for (const [n, kl, ku, weak] of cases) {
    it(`n ${n}, kl ${kl}, ku ${ku}, ${weak ? 'pivoting needed' : 'dominant diagonal'}: 1e-12 relative`, () => {
      for (let seed = 1; seed <= 5; seed++) {
        const { A, b } = randomBand(n, kl, ku, seed, weak)
        expect(relDiff(bandSolve(A, b, kl, ku), denseSolve(A, b))).toBeLessThan(1e-12)
      }
    })
  }

  it('throws on a singular matrix', () => {
    const A = [[1, 2, 0], [2, 4, 0], [0, 0, 1]]
    expect(() => bandSolve(A, [1, 1, 1], 1, 1)).toThrow()
  })

  it('is deterministic: the same input gives bit-identical output', () => {
    const { A, b } = randomBand(30, 3, 3, 9, true)
    expect(bandSolve(A, b, 3, 3)).toEqual(bandSolve(A, b, 3, 3))
  })
})

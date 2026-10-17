'use strict';
// A small 2D Stokes solver for spike 004. Offline, plain JavaScript, no dependencies, never ships in the app.
//
// Method (what is implemented, and where it comes from):
//   - Incompressible Stokes + continuity, plane strain, variable viscosity, on a regular staggered grid
//     (vx on vertical faces, vy on horizontal faces, P at cell centres, shear viscosity at the nodes);
//     second-order finite differences. Gerya (2010) Introduction to Numerical Geodynamic Modelling (CUP):
//     the staggered-grid discretisation of the momentum and continuity equations (chapter numbers to verify).
//   - Materials on Lagrangian markers (marker-in-cell, Gerya 2010; Harlow and Welch 1965 for the idea), bilinear
//     (area) weights to the grid, harmonic average for viscosity and arithmetic for density, 4th order
//     Runge-Kutta advection with the frozen velocity field, deterministic reseeding of empty cells.
//   - Free surface by a "sticky" low-viscosity top layer (here sea water), Crameri et al. (2012) GJI 189, 38-54, with
//     the implicit free-surface stabilisation of Kaus, Muhlhaus and May (2010) PEPI 181, 12-20 (the density
//     update  rho -> rho - theta dt v.grad(rho)  moved to the left hand side of the vertical momentum equation).
//   - The linear system is solved directly: banded LU with partial pivoting (the saddle point system has a zero
//     diagonal in the continuity rows). Pressure unknowns are scaled by eta_ref / h so the matrix is balanced.
//   - Pressure level: P of the cell (0,0) is pinned to zero (continuity of that cell is implied by the others),
//     unless open (pressure) boundaries are given.
// Coordinates: x to the right, y DOWN from the top of the box, gravity g along +y. Free-slip top and side walls,
// no-slip bottom, unless noted. All SI (or any consistent unit system).

function createModel(o) {
  const nx = o.nx, ny = o.ny, W = o.W, H = o.H;
  const m = {
    nx, ny, W, H, dx: W / nx, dy: H / ny, g: o.g === undefined ? 9.81 : o.g,
    mats: o.mats, etaRef: o.etaRef || 1e18, theta: o.theta || 0, open: o.open || null,
    bottom: o.bottom || 'noslip', top: o.top || 'freeslip', compaction: o.compaction || null,
    pin: o.open ? false : true,
    t: 0, step: 0, nmark: 0, cap: 0, x: null, y: null, mat: null, seed: (o.seed || 12345) >>> 0,
    vx: new Float64Array((nx + 1) * ny), vy: new Float64Array(nx * (ny + 1)), P: new Float64Array(nx * ny),
    nPerCell: o.nPerCell || [6, 6],
    ySurf: new Float64Array(nx),
    rhoY: new Float64Array(nx * (ny + 1)), etaP: new Float64Array(nx * ny), etaS: new Float64Array((nx + 1) * (ny + 1)),
    lastSolveMs: 0,
  };
  const [mx, my] = m.nPerCell;
  const n0 = nx * ny * mx * my;
  m.cap = Math.ceil(n0 * 1.6); m.x = new Float64Array(m.cap); m.y = new Float64Array(m.cap); m.mat = new Uint8Array(m.cap);
  let k = 0;
  for (let j = 0; j < nx; j++) for (let i = 0; i < ny; i++) for (let a = 0; a < mx; a++) for (let b = 0; b < my; b++) {
    const x = (j + (a + 0.5 + 0.5 * (rnd(m) - 0.5)) / mx) * m.dx, y = (i + (b + 0.5 + 0.5 * (rnd(m) - 0.5)) / my) * m.dy;
    m.x[k] = x; m.y[k] = y; m.mat[k] = o.init(x, y); k++;
  }
  m.nmark = k;
  return m;
}

// small deterministic LCG (no Math.random so every run of a case is reproducible)
function rnd(m) { m.seed = (Math.imul(m.seed, 1664525) + 1013904223) >>> 0; return m.seed / 4294967296; }

// ------------------------------------------------------------------ markers -> grid
function surfaceProfile(m) {
  const { nx, dx, H } = m, ys = m.ySurf; ys.fill(H);
  for (let k = 0; k < m.nmark; k++) {
    if (m.mat[k] === 0) continue;
    let j = Math.floor(m.x[k] / dx); if (j < 0) j = 0; else if (j >= nx) j = nx - 1;
    if (m.y[k] < ys[j]) ys[j] = m.y[k];
  }
}

function markerRho(m, k) {
  const mt = m.mats[m.mat[k]];
  if (mt.compact && m.compaction) {
    let fx = m.x[k] / m.dx - 0.5, j = Math.floor(fx); if (j < 0) j = 0; if (j > m.nx - 2) j = m.nx - 2; let w = fx - j; w = w < 0 ? 0 : w > 1 ? 1 : w;
    const ys = (1 - w) * m.ySurf[j] + w * m.ySurf[Math.min(m.nx - 1, j + 1)];
    return m.compaction(Math.max(0, m.y[k] - ys));
  }
  return mt.rho;
}

function markersToGrid(m) {
  const { nx, ny, dx, dy } = m;
  surfaceProfile(m);
  const sw = new Float64Array(nx * (ny + 1)), sr = m.rhoY; sr.fill(0);
  const wP = new Float64Array(nx * ny), iP = m.etaP; iP.fill(0);
  const wS = new Float64Array((nx + 1) * (ny + 1)), iS = m.etaS; iS.fill(0);
  const rhoCache = new Float64Array(m.mats.length), isConst = m.mats.map((t) => !t.compact);
  m.mats.forEach((t, q) => { rhoCache[q] = t.rho; });
  const etaInv = m.mats.map((t) => 1 / t.eta);
  for (let k = 0; k < m.nmark; k++) {
    const x = m.x[k], y = m.y[k], q = m.mat[k];
    const rho = isConst[q] ? rhoCache[q] : markerRho(m, k), ei = etaInv[q];
    // rho at vy nodes: x = (j+.5)dx, y = i dy
    spread(x / dx - 0.5, y / dy, nx, ny + 1, sw, sr, rho);
    spread(x / dx - 0.5, y / dy - 0.5, nx, ny, wP, iP, ei);
    spread(x / dx, y / dy, nx + 1, ny + 1, wS, iS, ei);
  }
  for (let q = 0; q < sw.length; q++) sr[q] = sw[q] > 0 ? sr[q] / sw[q] : m.mats[0].rho;
  for (let q = 0; q < wP.length; q++) iP[q] = wP[q] > 0 ? wP[q] / iP[q] : m.mats[0].eta;
  for (let q = 0; q < wS.length; q++) iS[q] = wS[q] > 0 ? wS[q] / iS[q] : m.mats[0].eta;
}

// bilinear spread of one marker value onto a node grid (columns j, rows i; index j*nyn+i)
function spread(fx, fy, nxn, nyn, wArr, vArr, v) {
  let j = Math.floor(fx), i = Math.floor(fy);
  if (j < 0) j = 0; else if (j > nxn - 2) j = nxn - 2;
  if (i < 0) i = 0; else if (i > nyn - 2) i = nyn - 2;
  let a = fx - j, b = fy - i; a = a < 0 ? 0 : a > 1 ? 1 : a; b = b < 0 ? 0 : b > 1 ? 1 : b;
  const q = j * nyn + i, w00 = (1 - a) * (1 - b), w01 = (1 - a) * b, w10 = a * (1 - b), w11 = a * b;
  wArr[q] += w00; vArr[q] += w00 * v; wArr[q + 1] += w01; vArr[q + 1] += w01 * v;
  wArr[q + nyn] += w10; vArr[q + nyn] += w10 * v; wArr[q + nyn + 1] += w11; vArr[q + nyn + 1] += w11 * v;
}

// ------------------------------------------------------------------ the linear system
function solveStokes(m, dt) {
  const t0 = process.hrtime.bigint();
  const { nx, ny, dx, dy, g } = m;
  const ny1 = ny + 1, nN = (nx + 1) * ny1, n = 3 * nN;
  const kl = 3 * ny1 + 6, ku = kl, Wb = 2 * kl + ku + 1;
  const AB = m._AB && m._AB.length === n * Wb ? m._AB : (m._AB = new Float64Array(n * Wb)); AB.fill(0);
  const rhs = new Float64Array(n);
  const kp = m.etaRef / (0.5 * (dx + dy));
  const dsc = m.etaRef / (dx * dy);        // scale of the trivial (Dirichlet / dummy) rows, so the pivot search is not skewed
  const id = (j, i, c) => (j * ny1 + i) * 3 + c;
  const add = (r, col, v) => { AB[r * Wb + col - r + kl] += v; };
  const { etaP, etaS, rhoY } = m;
  const iP = (j, i) => j * ny + i, iS = (j, i) => j * ny1 + i, iR = (j, i) => j * ny1 + i;
  const dx2 = dx * dx, dy2 = dy * dy;
  const th = m.theta * dt * g;
  const open = m.open;

  for (let j = 0; j <= nx; j++) for (let i = 0; i <= ny; i++) {
    // ---- vx row (face j, row i), rows 0..ny-1
    {
      const r = id(j, i, 0);
      if (i >= ny) { add(r, r, dsc); }
      else if (j === 0 || j === nx) {
        if (!open) { add(r, r, dsc); }
        else {
          // half cell next to an open boundary: total normal stress = -p_bc, fully developed (dvx/dx = 0 outside)
          const e = j === 0 ? etaP[iP(0, i)] : etaP[iP(nx - 1, i)];
          const c = j === 0 ? 0 : nx - 1, s = j === 0 ? 1 : -1;     // s: direction into the domain
          const pbc = j === 0 ? open.pL : open.pR;
          // sigma_xx(cell) = 2 e dvx/dx - P ; balance over the half cell: s*(sigma_cell - sigma_bc)/(dx/2) + dsigma_xy/dy = 0
          // dvx/dx(cell) = (vx[c+1]-vx[c])/dx
          const fx = 2 / dx;
          add(r, id(c + 1, i, 0), s * fx * 2 * e / dx); add(r, id(c, i, 0), -s * fx * 2 * e / dx);
          add(r, id(c, i, 2), -s * fx * kp);
          rhs[r] = -s * fx * pbc;                      // sigma_bc = -pbc, moved to the right hand side
          // shear part
          shearX(r, j, i);
        }
      } else {
        const A = etaP[iP(j, i)], B = etaP[iP(j - 1, i)];
        add(r, id(j + 1, i, 0), 2 * A / dx2); add(r, id(j, i, 0), -2 * (A + B) / dx2); add(r, id(j - 1, i, 0), 2 * B / dx2);
        shearX(r, j, i);
        add(r, id(j, i, 2), -kp / dx); add(r, id(j - 1, i, 2), kp / dx);
      }
    }
    // ---- vy row (column j, face i), columns 0..nx-1
    {
      const r = id(j, i, 1);
      if (j >= nx) { add(r, r, dsc); }
      else if (i === 0 || i === ny) { add(r, r, dsc); }
      else {
        const A = etaP[iP(j, i)], B = etaP[iP(j, i - 1)];
        add(r, id(j, i + 1, 1), 2 * A / dy2); add(r, id(j, i, 1), -2 * (A + B) / dy2); add(r, id(j, i - 1, 1), 2 * B / dy2);
        if (j < nx - 1) {   // right shear node (j+1,i)
          const C = etaS[iS(j + 1, i)];
          add(r, id(j + 1, i, 1), C / dx2); add(r, id(j, i, 1), -C / dx2);
          add(r, id(j + 1, i, 0), C / (dx * dy)); add(r, id(j + 1, i - 1, 0), -C / (dx * dy));
        }
        if (j > 0) {        // left shear node (j,i)
          const D = etaS[iS(j, i)];
          add(r, id(j, i, 1), -D / dx2); add(r, id(j - 1, i, 1), D / dx2);
          add(r, id(j, i, 0), -D / (dx * dy)); add(r, id(j, i - 1, 0), D / (dx * dy));
        }
        add(r, id(j, i, 2), -kp / dy); add(r, id(j, i - 1, 2), kp / dy);
        rhs[r] = -g * rhoY[iR(j, i)];
        if (th > 0) {       // implicit free surface stabilisation, Kaus et al. 2010
          const rY = (rhoY[iR(j, Math.min(ny, i + 1))] - rhoY[iR(j, Math.max(0, i - 1))]) / ((Math.min(ny, i + 1) - Math.max(0, i - 1)) * dy);
          const jl = Math.max(0, j - 1), jr = Math.min(nx - 1, j + 1);
          const rX = jr > jl ? (rhoY[iR(jr, i)] - rhoY[iR(jl, i)]) / ((jr - jl) * dx) : 0;
          add(r, id(j, i, 1), -th * rY);
          const cx = -th * rX * 0.25;
          add(r, id(j, i, 0), cx); add(r, id(j + 1, i, 0), cx); add(r, id(j, i - 1, 0), cx); add(r, id(j + 1, i - 1, 0), cx);
        }
      }
    }
    // ---- continuity / pressure row (cell j,i)
    {
      const r = id(j, i, 2);
      if (j >= nx || i >= ny) { add(r, r, dsc); }
      else if (m.pin && j === 0 && i === 0) { add(r, r, dsc); }
      else {
        add(r, id(j + 1, i, 0), kp / dx); add(r, id(j, i, 0), -kp / dx);
        add(r, id(j, i + 1, 1), kp / dy); add(r, id(j, i, 1), -kp / dy);
      }
    }
  }

  // shear terms of the x momentum row r at vx(j,i): d/dy[ eta_s (dvx/dy + dvy/dx) ]
  function shearX(r, j, i) {
    const C = etaS[iS(j, i + 1)], D = etaS[iS(j, i)];
    // lower node (j,i+1)
    if (i === ny - 1 && m.bottom === 'noslip') {
      // wall below the last row: quadratic extrapolation to the ghost value, u_g = -2 u_i + u_{i-1}/3 (exact for a parabola)
      add(r, id(j, i, 0), -3 * C / dy2); add(r, id(j, i - 1, 0), C / (3 * dy2));
    } else if (i < ny - 1) {
      add(r, id(j, i + 1, 0), C / dy2); add(r, id(j, i, 0), -C / dy2);
    } // free slip bottom: no flux
    const inner = j > 0 && j < nx;   // open boundary faces: dvy/dx taken as zero
    if (inner) { add(r, id(j, i + 1, 1), C / (dx * dy)); add(r, id(j - 1, i + 1, 1), -C / (dx * dy)); }
    // upper node (j,i)
    if (i > 0) {
      add(r, id(j, i, 0), -D / dy2); add(r, id(j, i - 1, 0), D / dy2);
      if (inner) { add(r, id(j, i, 1), -D / (dx * dy)); add(r, id(j - 1, i, 1), D / (dx * dy)); }
    } else if (m.top === 'noslip') { add(r, id(j, i, 0), -3 * D / dy2); add(r, id(j, i + 1, 0), D / (3 * dy2)); }
  }

  // ---- banded LU with partial pivoting; the right hand side is carried along
  luSolve(AB, rhs, n, kl, ku);
  for (let j = 0; j <= nx; j++) for (let i = 0; i < ny; i++) m.vx[j * ny + i] = rhs[id(j, i, 0)];
  for (let j = 0; j < nx; j++) for (let i = 0; i <= ny; i++) m.vy[j * ny1 + i] = rhs[id(j, i, 1)];
  for (let j = 0; j < nx; j++) for (let i = 0; i < ny; i++) m.P[j * ny + i] = rhs[id(j, i, 2)] * kp;
  m.lastSolveMs = Number(process.hrtime.bigint() - t0) / 1e6;
}

function luSolve(AB, b, n, kl, ku) {
  const Wb = 2 * kl + ku + 1;
  for (let c = 0; c < n; c++) {
    const last = Math.min(n - 1, c + kl), cmax = Math.min(n - 1, c + kl + ku);
    let p = c, best = Math.abs(AB[c * Wb + kl]);
    for (let r = c + 1; r <= last; r++) { const v = Math.abs(AB[r * Wb + c - r + kl]); if (v > best) { best = v; p = r; } }
    if (best === 0) throw new Error('singular matrix at column ' + c);
    if (p !== c) {
      for (let col = c; col <= cmax; col++) {
        const a = c * Wb + col - c + kl, bq = p * Wb + col - p + kl;
        const tmp = AB[a]; AB[a] = AB[bq]; AB[bq] = tmp;
      }
      const tb = b[c]; b[c] = b[p]; b[p] = tb;
    }
    const piv = AB[c * Wb + kl], rowC = c * Wb + kl - c;
    for (let r = c + 1; r <= last; r++) {
      const q = r * Wb + c - r + kl, f0 = AB[q];
      if (f0 === 0) continue;
      const f = f0 / piv; AB[q] = 0;
      const rowR = r * Wb + kl - r;
      for (let col = c + 1; col <= cmax; col++) AB[rowR + col] -= f * AB[rowC + col];
      b[r] -= f * b[c];
    }
  }
  for (let r = n - 1; r >= 0; r--) {
    const cmax = Math.min(n - 1, r + kl + ku), base = r * Wb + kl - r;
    let s = b[r];
    for (let col = r + 1; col <= cmax; col++) s -= AB[base + col] * b[col];
    b[r] = s / AB[r * Wb + kl];
  }
}

// ------------------------------------------------------------------ advection
function velAt(m, x, y, out) {
  const { nx, ny, dx, dy } = m;
  // vx: nodes (j dx, (i+.5) dy)
  let fx = x / dx, j = Math.floor(fx); if (j < 0) j = 0; else if (j > nx - 1) j = nx - 1;
  let a = fx - j; a = a < 0 ? 0 : a > 1 ? 1 : a;
  let fy = y / dy - 0.5, i = Math.floor(fy); if (i < 0) i = 0; else if (i > ny - 2) i = ny - 2;
  let b = fy - i; b = b < 0 ? 0 : b > 1 ? 1 : b;
  const vx = m.vx, q = j * ny + i;
  out[0] = (1 - a) * (1 - b) * vx[q] + (1 - a) * b * vx[q + 1] + a * (1 - b) * vx[q + ny] + a * b * vx[q + ny + 1];
  // vy: nodes ((j+.5) dx, i dy)
  fx = x / dx - 0.5; j = Math.floor(fx); if (j < 0) j = 0; else if (j > nx - 2) j = nx - 2;
  a = fx - j; a = a < 0 ? 0 : a > 1 ? 1 : a;
  fy = y / dy; i = Math.floor(fy); if (i < 0) i = 0; else if (i > ny - 1) i = ny - 1;
  b = fy - i; b = b < 0 ? 0 : b > 1 ? 1 : b;
  const vy = m.vy, q2 = j * (ny + 1) + i;
  out[1] = (1 - a) * (1 - b) * vy[q2] + (1 - a) * b * vy[q2 + 1] + a * (1 - b) * vy[q2 + ny + 1] + a * b * vy[q2 + ny + 2];
}

function maxVel(m) {
  let a = 0, b = 0;
  for (let q = 0; q < m.vx.length; q++) { const v = Math.abs(m.vx[q]); if (v > a) a = v; }
  for (let q = 0; q < m.vy.length; q++) { const v = Math.abs(m.vy[q]); if (v > b) b = v; }
  return [a, b];
}

function advect(m, dt) {
  const v = [0, 0], k1 = [0, 0], k2 = [0, 0], k3 = [0, 0], k4 = [0, 0];
  for (let k = 0; k < m.nmark; k++) {
    const x = m.x[k], y = m.y[k];
    velAt(m, x, y, k1);
    velAt(m, x + 0.5 * dt * k1[0], y + 0.5 * dt * k1[1], k2);
    velAt(m, x + 0.5 * dt * k2[0], y + 0.5 * dt * k2[1], k3);
    velAt(m, x + dt * k3[0], y + dt * k3[1], k4);
    let nxp = x + dt * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]) / 6, nyp = y + dt * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]) / 6;
    if (nxp < 0) nxp = 0; else if (nxp > m.W) nxp = m.W;
    if (nyp < 0) nyp = 0; else if (nyp > m.H) nyp = m.H;
    m.x[k] = nxp; m.y[k] = nyp;
  }
  void v;
}

// ------------------------------------------------------------------ reseeding: keep 25 % .. 250 % of the nominal count per cell
function reseed(m) {
  const { nx, ny, dx, dy } = m, nc = nx * ny, nom = m.nPerCell[0] * m.nPerCell[1];
  const cnt = new Int32Array(nc);
  const cellOf = (k) => { let j = Math.floor(m.x[k] / dx), i = Math.floor(m.y[k] / dy); j = j < 0 ? 0 : j >= nx ? nx - 1 : j; i = i < 0 ? 0 : i >= ny ? ny - 1 : i; return j * ny + i; };
  for (let k = 0; k < m.nmark; k++) cnt[cellOf(k)]++;
  // remove extras (drop every other marker of a crowded cell, in marker order: deterministic)
  const keep = new Uint8Array(m.nmark).fill(1), seen = new Int32Array(nc), lim = Math.ceil(2.5 * nom);
  let removed = 0;
  for (let k = 0; k < m.nmark; k++) { const c = cellOf(k); if (cnt[c] > lim && seen[c]++ % 2 === 1) { keep[k] = 0; removed++; } }
  if (removed) { let w = 0; for (let k = 0; k < m.nmark; k++) if (keep[k]) { m.x[w] = m.x[k]; m.y[w] = m.y[k]; m.mat[w] = m.mat[k]; w++; } m.nmark = w; cnt.fill(0); for (let k = 0; k < m.nmark; k++) cnt[cellOf(k)]++; }
  // cell lists
  const start = new Int32Array(nc + 1);
  for (let c = 0; c < nc; c++) start[c + 1] = start[c] + cnt[c];
  const fill = start.slice(0, nc), list = new Int32Array(m.nmark);
  for (let k = 0; k < m.nmark; k++) list[fill[cellOf(k)]++] = k;
  const low = Math.floor(0.25 * nom);
  let added = 0;
  const addX = [], addY = [], addM = [];
  for (let j = 0; j < nx; j++) for (let i = 0; i < ny; i++) {
    const c = j * ny + i; if (cnt[c] > low) continue;
    const need = Math.ceil(0.6 * nom) - cnt[c];
    for (let s = 0; s < need; s++) {
      const x = (j + rnd(m)) * dx, y = (i + rnd(m)) * dy;
      // nearest existing marker in the 3 x 3 neighbourhood sets the material
      let best = -1, bd = Infinity;
      for (let jj = Math.max(0, j - 1); jj <= Math.min(nx - 1, j + 1); jj++) for (let ii = Math.max(0, i - 1); ii <= Math.min(ny - 1, i + 1); ii++) {
        const cc = jj * ny + ii;
        for (let q = start[cc]; q < start[cc + 1]; q++) { const k = list[q]; const d = (m.x[k] - x) ** 2 + (m.y[k] - y) ** 2; if (d < bd) { bd = d; best = k; } }
      }
      if (best < 0) continue;
      addX.push(x); addY.push(y); addM.push(m.mat[best]); added++;
    }
  }
  if (m.nmark + added > m.cap) {
    m.cap = Math.ceil((m.nmark + added) * 1.5);
    const nxa = new Float64Array(m.cap), nya = new Float64Array(m.cap), nma = new Uint8Array(m.cap);
    nxa.set(m.x.subarray(0, m.nmark)); nya.set(m.y.subarray(0, m.nmark)); nma.set(m.mat.subarray(0, m.nmark));
    m.x = nxa; m.y = nya; m.mat = nma;
  }
  for (let q = 0; q < added; q++) { m.x[m.nmark] = addX[q]; m.y[m.nmark] = addY[q]; m.mat[m.nmark] = addM[q]; m.nmark++; }
  return { added, removed };
}

// ------------------------------------------------------------------ sedimentation: water markers below the aggradation surface become sediment
function aggrade(m, ysFn, fromMat, toMat) {
  let n = 0;
  for (let k = 0; k < m.nmark; k++) if (m.mat[k] === fromMat && m.y[k] > ysFn(m.x[k])) { m.mat[k] = toMat; n++; }
  return n;
}

// one time step: properties, solve, advance markers by dt (chosen from the CFL number), reseed. Returns dt.
function step(m, dtMax, cfl, opts) {
  opts = opts || {};
  markersToGrid(m);
  // dt for the stabilisation uses the dt of this step, so choose dt from the previous velocities first
  let dt = dtMax;
  if (m.step > 0) { const [a, b] = maxVel(m); const vm = Math.max(a / m.dx, b / m.dy, 1e-300); dt = Math.min(dtMax, cfl / vm); }
  solveStokes(m, dt);
  const [a, b] = maxVel(m); const vm = Math.max(a / m.dx, b / m.dy, 1e-300);
  if (dt > cfl / vm) dt = Math.min(dt, cfl / vm);
  advect(m, dt);
  m.t += dt; m.step++;
  const rs = reseed(m);
  return { dt, vmax: Math.max(a, b), reseeded: rs.added };
}

// ------------------------------------------------------------------ diagnostics
function areasByMaterial(m) {
  // area of each material from the marker fractions of the cells
  const { nx, ny, dx, dy } = m, nc = nx * ny, nm = m.mats.length;
  const cnt = new Float64Array(nc * nm), tot = new Float64Array(nc);
  for (let k = 0; k < m.nmark; k++) {
    let j = Math.floor(m.x[k] / dx), i = Math.floor(m.y[k] / dy); j = j < 0 ? 0 : j >= nx ? nx - 1 : j; i = i < 0 ? 0 : i >= ny ? ny - 1 : i;
    cnt[(j * ny + i) * nm + m.mat[k]]++; tot[j * ny + i]++;
  }
  const A = new Float64Array(nm);
  for (let c = 0; c < nc; c++) if (tot[c] > 0) for (let q = 0; q < nm; q++) A[q] += cnt[c * nm + q] / tot[c] * dx * dy;
  return A;
}

function vrms(m) {
  const { nx, ny } = m; let s = 0;
  for (let j = 0; j < nx; j++) for (let i = 0; i < ny; i++) {
    const u = 0.5 * (m.vx[j * ny + i] + m.vx[(j + 1) * ny + i]), v = 0.5 * (m.vy[j * (ny + 1) + i] + m.vy[j * (ny + 1) + i + 1]);
    s += u * u + v * v;
  }
  return Math.sqrt(s / (nx * ny));
}

/** per x-bin (one grid column each): highest (smallest y) marker of material q, or NaN; resolution is the marker spacing */
function topOfMaterial(m, q, bins) {
  const nb = bins || m.nx, out = new Float64Array(nb).fill(NaN), w = m.W / nb;
  for (let k = 0; k < m.nmark; k++) {
    if (m.mat[k] !== q) continue;
    let j = Math.floor(m.x[k] / w); j = j < 0 ? 0 : j >= nb ? nb - 1 : j;
    if (Number.isNaN(out[j]) || m.y[k] < out[j]) out[j] = m.y[k];
  }
  return out;
}

module.exports = { createModel, markersToGrid, solveStokes, luSolve, advect, reseed, aggrade, step, areasByMaterial, vrms, topOfMaterial, maxVel, velAt, rnd };

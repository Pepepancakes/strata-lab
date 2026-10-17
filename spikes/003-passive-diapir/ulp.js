// 1 ulp maths noise for the spike: a plain-JS copy of withUlpNoise in tests/helpers/ulpNoise.ts (same names, same
// hash, same amplitude), so the spike's runs can be repeated as "another machine's libm" would repeat them.
const NAMES = ['pow', 'exp', 'log', 'log10', 'log1p', 'expm1', 'tanh', 'atan', 'atan2', 'sin', 'cos', 'tan', 'cbrt'];
const AMP = 2.2e-16;

function withUlpNoise(amp, salt, fn) {
  const f = new Float64Array(1), u = new Uint32Array(f.buffer);
  const saved = NAMES.map((n) => Math[n]);
  const jig = (x) => {
    if (!Number.isFinite(x) || x === 0) return x;
    f[0] = x;
    const h = Math.imul(u[0] ^ (u[1] * 31) ^ salt, 0x9e3779b1) >>> 28;
    return x * (1 + (h < 5 ? -1 : h < 10 ? 0 : 1) * amp);
  };
  NAMES.forEach((n, i) => { Math[n] = (...a) => jig(saved[i](...a)); });
  try { return fn(); } finally { NAMES.forEach((n, i) => { Math[n] = saved[i]; }); }
}

module.exports = { withUlpNoise, AMP, SIX_SALTS: [3, 5, 7, 11, 13, 17] };

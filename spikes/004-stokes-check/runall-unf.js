'use strict';
// Launch the unfiltered-level Gulf runs in parallel: node runall-unf.js  (sets S4_UNFILT=1, tag -unf)
const { spawn } = require('child_process');
const path = require('path');
const SCR = process.env.S4_SCRATCH || path.join(require('os').tmpdir(), 'strata-s4');
const jobs = [['A', '1'], ['B', '1'], ['A', '10'], ['B', '10'], ['A', '0.1'], ['B', '0.1']];
let left = jobs.length;
for (const [r, cf] of jobs) {
  const out = require('fs').openSync(path.join(SCR, `run_unf_${r}_${cf}.txt`), 'w');
  const p = spawn(process.execPath, [path.join(__dirname, 'cases.js'), 'gulf', r, cf], { env: { ...process.env, S4_UNFILT: '1', S4_TAG: '-unf', S4_SCRATCH: SCR }, stdio: ['ignore', out, out] });
  p.on('exit', (c) => { console.log('done', r, cf, 'exit', c); if (--left === 0) console.log('all done'); });
}

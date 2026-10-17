const fs = require('fs'), path = require('path'), os = require('os');
const SCR = process.env.S4_SCRATCH || path.join(os.tmpdir(), 'strata-s4');
const o = JSON.parse(fs.readFileSync(path.join(SCR, 'out-' + process.argv[2] + '.json')));
const every = +process.argv[3] || 2;
console.log('t\tcrestKm\tcover\trelief\tzoneMin@km\texpZoneKm\tminAll@km\texpAllKm\tvmax');
o.series.forEach((r, i) => { if (i % every === 0) console.log([r.tMyr, r.crestKm, r.coverM, r.reliefM, r.zoneMinCoverM + '@' + r.zoneMinCoverKm, r.zoneExposedKm, r.minCoverM + '@' + r.minCoverKm, r.exposedKm, r.vmaxMmyr].join('\t')); });

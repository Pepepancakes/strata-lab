import json, os, sys
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

scr = os.environ['S4_SCRATCH']
def load(n):
    p = os.path.join(scr, 'out-%s.json' % n)
    return json.load(open(p)) if os.path.exists(p) else None

fig, ax = plt.subplots(2, 2, figsize=(14, 9))
# Gulf: cover over the crest and relief
g = load('gulf-B') or load('gulf-A')
for k, (names, title) in enumerate([(['gulf-A', 'gulf-B', 'gulf-A-unf', 'gulf-B-unf'], 'Gulf, resolution; -unf = unfiltered level'), (['gulf-B-cov0.1', 'gulf-B', 'gulf-B-cov10', 'gulf-B-cov0.1-unf', 'gulf-B-unf', 'gulf-B-cov10-unf'], 'Gulf, cover viscosity (B)')]):
    a = ax[0][k]
    for n in names:
        o = load(n)
        if not o: continue
        s = [r for r in o['series'] if 'coverM' in r]
        a.plot([r['tMyr'] for r in s], [r['coverM'] for r in s], label=n)
    th = g['thinSeries'] if g else []
    a.plot([r['tMyr'] for r in th], [r['coverM'] for r in th], 'k--', label='thin sheet (S3b)')
    a.axhline(100, color='grey', lw=0.5); a.set_xlabel('time, Myr'); a.set_ylabel('cover over the crest, m'); a.set_title(title); a.legend()
for k, n in enumerate(['gl24-A', 'gl24-B']):
    o = load(n)
    if not o: continue
    a = ax[1][0]
    s = [r for r in o['series'] if 'coverM' in r]
    a.plot([r['tMyr'] for r in s], [r['coverM'] for r in s], label=n + ' cover over crest')
    a.plot([r['tMyr'] for r in s], [r['reliefM'] for r in s], '--', label=n + ' crest above flank')
a = ax[1][0]
o = load('gl24-A')
if o:
    ts = o['thinSeries']
    a.plot([r['tMyr'] for r in ts], [r['crestDepthM'] for r in ts], 'k:', label='thin sheet: crest depth below seafloor')
a.set_xlabel('time, Myr'); a.set_ylabel('m'); a.set_title('GL24-like case'); a.legend()
# profile snapshots for the Gulf B run
o = load('gl24-B') or load('gl24-A')
a = ax[1][1]
if o:
    for sn in o['snaps']:
        x = [(o['snaps'][0]['x0'] + (i + 0.5) * sn['dx']) / 1000 for i in range(len(sn['sea']))]
        a.plot(x, [v if v is not None else float('nan') for v in sn['sea']], label='seafloor %.0f Myr' % sn['tMyr'])
    sn = o['snaps'][0]
    a.plot(x, [v if v is not None else float('nan') for v in sn['salt']], 'k', lw=0.7, label='salt top %.0f Myr' % sn['tMyr'])
    sn = o['snaps'][-1]
    a.plot(x, [v if v is not None else float('nan') for v in sn['salt']], 'r', lw=0.7, label='salt top %.0f Myr' % sn['tMyr'])
    a.legend(fontsize=6)
a.set_xlabel('x, km'); a.set_ylabel('elevation, m (thin-sheet frame)'); a.set_title('GL24-like B: salt top (black first, red last) and seafloor')
fig.tight_layout()
out = os.path.join(scr, 's4-stokes-check.png')
fig.savefig(out, dpi=110)
print(out)

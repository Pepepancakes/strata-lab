# Spike 001: deepwater shelf-to-basin (throwaway)

Question: can a 2D process model of a deepwater margin be physically honest **and** feel live
(scrub, rewind, branch what-ifs) in a browser?

Open `dist/strata-spike-001.html` (single offline file). `node build.js` rebuilds it; `node test.js` runs the checks.

## Files
- `engine.js`: physics only, no display code (transport, turbidite routing, compaction + pore pressure, snapshots, benchmarks)
- `app.html`: UI (section, pseudo-well, sea-level chart, branches, checks)
- `test.js`: Gibson benchmark, drained compaction, mass balance, timing, determinism
- `tune.js`: parameter sweeps used to pick slope/coastal-plain diffusivities

## Physics
- Two grain sizes (sand, mud), each moved by water-depth-dependent diffusion; sand less mobile.
  Grain-size sorting is routed cell by cell from high to low ground so both total and sand-only mass balance exactly.
- Turbidity currents: a share of supply bypasses the slope when the shoreline is within ~8 km of the shelf edge,
  deposits where the gradient eases.
- Compaction: Athy-type porosity vs effective stress (Sclater & Christie 1980 constants), porosity-dependent permeability,
  1D consolidation solved implicitly per column. Unloading is stiffer than loading.

## Results (2026-10-14)
| Criterion | Result |
|---|---|
| Pore pressure vs Gibson (1958) exact solution, T = 0.1 / 1 / 10 | max error 0.0001 of overburden — PASS |
| Drained compaction vs Sclater & Christie at 2 km | sand 0.290 vs 0.286, mud 0.245 vs 0.227 — PASS |
| Mass balance, all sediment and sand alone | error ~1e-14 of supply (rounding) — PASS |
| 3 Myr run (600 × 5 kyr steps, 150 columns) | ~1.5 s in Node and Chrome |
| Scrub to a random time | median 24 ms, max ~100 ms; dragging backwards median 62 ms |
| Rewind and replay | bit-identical to a straight run — PASS |
| Branch: sea level −50 m from 2 Ma | history before 2 Ma identical; afterwards shoreline ~5 km and shelf edge ~3 km further basinward at highstands, ~5 % more basin-floor sand. Effect is modest because the ±40 m cycles already swing the shoreline across the whole shelf. |

## Known limits (spike)
- Turbidites are a transport-length rule, not flow physics. No slope failure, faults, salt, 3D.
- Default overpressure is mild (max ~14 % of load) at 20 m²/yr supply; lower mud permeability to see more.
- Slope and coastal-plain diffusivities were tuned by eye to ~6° muddy slopes and ~0.3 m/km coastal plain, not calibrated to data.
- Snapshots are full copies (~75 MB heap for one branch); four branches is the cap.

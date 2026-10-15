# Spike 002 — salt under the prograding wedge (throwaway)

**Question:** can salt flow in the column model, interactively, and does it look like Gulf salt?

**Answer:** partly. Broad salt movement works and passes its checks. Diapirs do not: their width
is set by the grid, not by the physics. That is the main finding, and it shapes M1 and M3.

## Try it
Open `dist/strata-spike-002.html` (one offline file). Pink is salt, grey is older cover, dark grey
is basement. New controls: salt viscosity, salt thickness at the start, older cover thickness, and
older cover unevenness. The last three only apply to the base case, because they set the start.

To see the diapir problem: set *Older cover over salt* to about 3,300 ft and *Older cover
unevenness* to ±30 %.

## What was added to spike 001
- A salt layer between the basement and the sediment: 1,500 m thick basinward of 45 km, tapering
  to nothing at 25 km.
- Salt flows sideways as a thin viscous channel (lubrication theory: flux = h³/12η × pressure
  gradient). It is driven by the load on the salt roof plus the roof's elevation. The water-load
  part is solved implicitly, and the flux form conserves salt exactly.
- Sediment columns ride up or down on the salt. They do not move sideways.
- The pseudo-well shows the salt interval with salt density (2,160 kg/m³) in the overburden.

## Results
| Check | Result |
|---|---|
| Salt flow vs linear lubrication theory (4 cases: 25–200 km bumps, 1e17 and 1e18 Pa·s) | decay rates within 0.06–0.9 % |
| Salt flux under a sediment load step vs hand calculation | pressure step exact; flux within 0.02 % |
| Salt volume conserved (3 Myr run) | 5e-16 relative; nothing clipped |
| Sediment mass, sand-only balance, Gibson, Sclater & Christie, bit-identical rewind | all still pass |
| 3 Myr run | ~1.9 s in Node, ~2.0 s in Chrome (target < 5 s) |
| Scrubbing in Chrome | jump median 25 ms (max 106); dragging backward median 51 ms (max 94) |

**What the default run shows (viscosity 1e17 Pa·s, 1,500 m salt, 200 m older cover):**
the prograding slope wedge sinks into the salt and pushes it basinward. Under the shelf and upper
slope the salt thins to about 160–280 m. Basinward it thickens from 1,500 m to about 2,000 m and
lifts the deep-water seafloor. This is progradation-driven salt expulsion (Ge et al. 1997). No
welds form in 3 Myr, and there are no diapirs.

**What the uneven-cover experiment shows:** dense older cover over lighter salt is unstable. Salt
rises where the cover is thin and minibasins sink between the rises. Shallow growth looks right.
But the diapirs that reach near the seafloor are 1–4 grid cells wide whatever the cell size:

| Grid cell | Gentle thin spot (30 %, 8 km): salt high width | Strong thin spot (60 %, 4 km): salt high width |
|---|---|---|
| 1,000 m | 9.0 km | 3 cells |
| 500 m | 8.5 km | 1 cell |
| 250 m | 6.8 km | 4 cells |

Gentle structures settle to a real width. Diapirs do not. In thin-sheet theory with a heavy
cover, the narrowest bumps grow fastest, so the grid decides the width. Real diapir width is set
by the strength and bending of the cover, or by full 2D flow, and this model has neither.

## Recommendation for M1 (layer record)
1. **Store salt as its own material in the column record, not as a special bottom layer.** Each
   column holds an ordered list of units, each tagged *sediment* or *salt*. Today there is only
   one salt unit at the base. A canopy (salt above younger sediment) must still be storable later
   without changing the file format.
2. **Keep columns fixed in x for now.** Vertical riding is enough for expulsion, sag basins and
   welds. Sideways movement of sediment (rafts, canopies) is a later solver change, not a record
   change.
3. **Salt conservation joins the permanent checks** (salt-only balance, like sand-only).
4. **M3 needs a decision before it starts.** Diapirs need one of these:
   - (a) cover bending stiffness in the thin-sheet equation. This adds a term that stops the
     narrowest bumps from growing fastest, so width comes from cover thickness and strength.
     It stays fast, and the published thin-sheet literature does this.
   - (b) a real 2D viscous (Stokes) solver for salt and cover. This is correct but slow, and
     probably not interactive at 3 Myr in a browser.

   Recommend (a) for M3, with (b) as the backlog route to canopies.

## Not done (out of scope)
Canopies and sheets, dissolution, faults over salt, cover strength, and salt in the porosity and
overpressure solvers (salt is treated as having no pores and no flow). Viscosity 1e17 Pa·s is at
the fast end of the published range. It was chosen so flow shows in 3 Myr, so it is *tuned*.

## Files
`engine.js` (spike 001 + salt), `app.html`, `build.js`, `test.js` (`node test.js` → `ALL PASS`),
`tune_salt.js` (parameter sweeps), `grid_check.js` (diapir width vs grid; `node grid_check.js
0.6 4000`), `tune.js` (from spike 001).

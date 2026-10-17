# Strata Lab: user guide

For the person using the app. Depths and elevations are in feet, pressures in ppg (equivalent mud
weight), temperatures in °F, distances along the section in km. Where a unit is something else
(for example diffusivity in m²/yr) the control says so. The model works in SI inside; the
conversion happens in one place (`src/units.ts`).

How the project works is in `docs/agent-guide.md`. Where each number comes from is in
`docs/physics-references.md`. This guide says what to click and what to expect.

## 1. What the app does
It builds a 2D slice of a deepwater margin, from the shelf out to the basin floor, by running
physical processes forward in time:
- sediment is supplied at the landward end and spread by transport (rivers on land, waves and
  gravity in the sea, turbidity currents to the basin floor);
- sea level rises and falls, which moves the shoreline and decides where sand goes;
- the basement subsides, faster at the basinward end;
- buried layers compact, and the water they squeeze out can only escape at a rate set by their
  permeability, so fast-buried mud stays overpressured;
- optionally, burial temperature and quartz cement are tracked in the sands;
- optionally, steep slopes fail and run out as debris flows, leaving mass-transport deposits
  (MTDs; section 13);
- optionally, a layer of salt under the sediment flows sideways and bends the cover above it into
  minibasins, diapirs and welds (salt; section 14).

You choose the conditions, watch the section build, scrub back to any time, and branch a what-if.
Same inputs always give the same result, bit for bit, which is what makes rewind and branches
trustworthy.

It is a learning and planning tool. It is not calibrated to any field and uses no company data.
See section 15 for what it cannot do.

## 2. Opening it
Open `dist/strata-lab.html` in a browser (after `npm run build`; see `README.md`). It is one file,
works offline and sends nothing anywhere. The default scenario (last 3 Myr) runs on load, in
about 2 seconds. The line **Engine worker: OK** in the controls column tells you the physics engine started.

The page has three columns: the controls on the left; in the middle the section with its time
bar, and under it the pseudo-well and charts; and on the right branches, mass balance, speed and
physics checks.

## 3. The controls
Editing the **main run** runs it again from the start. Editing while a **branch** is active
changes only that branch, from where it forks (section 7). Controls that set up the run
(marked "start" below) are locked in a branch.

Every control has a small **ⓘ** button and a tag next to its name:
- **cited**: the value or its form comes from a published source. ⓘ shows the full citation.
- **tuned**: chosen by eye to give a plausible picture, not measured. ⓘ says what it was tuned for.
- **to verify**: the source is believed right but has not been checked against the paper.

"Allowed" below is what the number box accepts. Those limits are guard rails, **not published
ranges**. A published range is given only where one exists.

### 3.1 Scenario (top of the controls)
**Scenario preset** (tuned): six standard runs. Choosing one replaces the main run.
- *Last 3 Myr (default)*: 150 columns of 1 km, 5 kyr steps, 600 steps.
- *Miocene to present (23 Myr)*: 400 columns of 1 km, 50 kyr steps back to 3 Ma, then 5 kyr.
- *Full Cenozoic (66 Myr)*: 400 columns, 100 kyr steps back to 23 Ma, then as the Miocene run.
- *Overpressured slope (MTD-prone)*: the 3 Myr default with mud permeability x0.1, supply 30 m²/yr and slope failure on; 5 kyr steps.
- *Gulf-style: wedge over salt (66 Ma)*: 400 columns, 100 kyr steps back to 23 Ma then 50 kyr and 5 kyr, salt on (4000 m thick, pinching out between 10 and 100 km, ending between 200 and 240 km) under a 300 m uneven cover, supply 28 m²/yr, 10 % of it as turbidity currents. Tuned (M3.8, M3.10), not matched to a field.
- *Salt: uneven cover (10 Myr)*: 150 columns of 1 km, 50 kyr steps, 200 steps, runs in under a second. Thin salt (1000 m, viscosity 1e17) under a thin uneven cover and a fast supply (50 m²/yr) gives a dozen small diapirs and minibasins. A teaching toy, tuned and synthetic.

**Run length (Myr)** (tuned): how long to run, from 0.5 Myr up to the preset's length. A shorter
run keeps the **youngest** part of the preset's schedule, so a 10 Myr run of the Miocene preset
is the last 10 Myr, cut on a whole step.

The line **Time steps:** under it says exactly what steps are used, for example "5 kyr steps back
to 3 Ma (600 steps)". Read section 5 before trusting a coarse-step run for fine detail.

### 3.2 How the Controls panel is laid out
Below **Scenario** is the **Controls** heading, a line saying whether you are editing the main run or a branch, then:

- **Find a parameter** (the box says *Find a parameter (e.g. salt, viscosity)*): a search box that stays at the top of the controls column. Type part of a control's name (for example *salt* or *viscosity*), of a heading inside a group, or of a group's title. The groups with a match open and the others hide; inside a group only the matching controls stay, unless the group's title matched, which keeps the whole group. *salt* shows the whole **Salt** group and also **Salt substeps per record step** under **Grid and numerical settings**. The × button (**Clear search**) empties the box and puts the groups back as you left them. When nothing matches the panel says *No parameter matches "text"*.
- **Ten groups**, in this order: **Sediment supply**, **Sea level**, **Subsidence**, **Salt**, **Slope failure (MTDs)**, **Transport and turbidity currents**, **Compaction and pore pressure**, **Temperature**, **Quartz cement**, **Grid and numerical settings**. Each group header shows its title, *on* or *off* for the groups that have a switch, *N changed* when some of its controls differ from the preset, and how many controls it holds. The first three start open. Open or close a group by clicking its header; the browser remembers which are open (separately from the scenario autosave, so it never goes into a scenario file).
- **Switches.** Salt, Slope failure (MTDs), Temperature and Quartz cement each have a check box at the top of their group: **Salt layer on**, **Slope failure (MTDs) on**, **Temperature on** and **Quartz cement on**. They are start-only, so ticking one runs the main run again from the start, and a branch cannot change them. The other controls of a switched-off group stay visible and editable, with the line *Off: these settings have no effect until it is switched on.* Quartz cement only runs together with temperature: if cement is on and temperature is off, the group says *Needs Temperature on to have any effect.* Inside Salt, **Cover resists bending (1) / not (0) (salt on)** is a check box too, *Cover resists bending*.
- **Controls the current choice ignores are hidden.** The sine's amplitude and period appear only when **Sea-level source** is *Sine (teaching)*; the decay time only when **Subsidence history** is *thermal*; the piecewise factors only when it is *history*. A short grey line says when they will appear. Their values are kept, and a search still finds them.
- **Changed from the preset.** A control whose value differs from the chosen preset (a main-run change, or a branch's edit) gets a small dot (*changed from preset*) before its name and, under the box, *preset* followed by the preset's value in the units you read. The group header counts them (*N changed*). The Scenario controls are not marked.

Pairs of boxes are **sand** and **mud**, in that order. The ⓘ button on each control gives its source, and the tag says *cited*, *tuned* or *to verify*. In the tables below, "start" means the control only sets the start of the run, so a branch cannot change it.

### 3.3 The groups, in panel order

**Sediment supply** and **Sea level** (open at the start)
| Control | Default | Allowed | Source |
|---|---|---|---|
| **Sediment supply** (ft²/yr) | 215.3 (20 m²/yr) | 0 to 2153 | tuned. Solid volume per foot of margin; an order of magnitude for a large-river margin, no source yet |
| **Sand share of supply** | 0.35 | 0 to 1 | tuned. Share of the solid volume that is sand |
| **Sea-level source** | Published curve | Published curve, Sine (teaching) | cited (section 6) |
| **Sea-level amplitude (sine only)** (ft) | 131.2 (40 m) | 0 to 492 | tuned. Used only with the sine |
| **Sea-level period (sine only)** (kyr) | 100 | 10 to 1000 | tuned. Used only with the sine |
| **Sea-level offset** (ft) | 0 | -656 to 656 | tuned. Shifts either source up or down; a what-if knob |

**Subsidence** (open at the start)
| Control | Default | Allowed | Source |
|---|---|---|---|
| **Subsidence, landward edge** (ft/Myr) | 131.2 (40 m/Myr) | 0 to 1640 | tuned. The 40 to 150 m/Myr range was chosen by eye |
| **Subsidence, basinward edge** (ft/Myr) | 492.1 (150 m/Myr) | 0 to 1640 | tuned. Rate varies linearly between the two edges |
| **Subsidence history** | constant | | start. cited: McKenzie (1978). Choices *constant*, *thermal*, *history* (changing subsidence, M1.4c; off by default) |
| **Thermal subsidence decay time** (Myr) | 62.8 | | cited: McKenzie (1978). Used only for *thermal* |
| **Subsidence history (piecewise factors)** (Ma, -) | empty | | start. tuned. See below |

What these three groups do physically:
- *Supply and sand share* set how much solid is delivered and how much of it is sand. More supply
  makes the shelf edge advance faster and buries mud faster (more overpressure). More sand makes
  more sand available to bypass to the basin floor at lowstand.
- *Sea level* moves the shoreline across the shelf. At a lowstand the shoreline sits near the
  shelf edge and sand bypasses to the slope and basin floor. The offset raises or lowers the
  whole record.
- *Subsidence* creates room. Where it is faster, more sediment piles up and burial is deeper.

**Subsidence history (piecewise factors)** has no boxes in the app yet. It is a list the engine
accepts but the controls have no editor for, so the *history* choice of **Subsidence history**
has nothing to work with. Use *constant* or *thermal*.

**Salt** (M3.1 to M3.3; off by default, so the default run is unchanged). Section 14.2 explains each control.

*Starting salt*
| Control | Default | Source |
|---|---|---|
| Salt layer on (1) / off (0) | 0 | start. tuned (switch). Shown as the check box *Salt layer on* at the top of the group. A mobile salt layer between the basement and the sediment |
| Initial salt thickness (ft) | 4921 (1500 m) | start. tuned. Synthetic |
| Salt pinch-out: no salt landward of (km) | 25 | start. tuned |
| Salt pinch-out: full thickness basinward of (km) | 45 | start. tuned |
| Salt basin limit: full thickness landward of | 2000 | start. tuned; idea after Hudec et al. (2013), to verify. The basinward end of the salt basin; the Gulf-style preset uses 200 km |
| Salt basin limit: no salt basinward of | 2500 | start. tuned. The Gulf-style preset uses 240 km. Salt can flow past it, but none starts there |

*Flow and cover*
| Control | Default | Source |
|---|---|---|
| Salt viscosity (Pa s) | 1e17 | tuned. Hudec & Jackson (2007) range about 1e17 to 1e19, to verify; the default is the fast end so flow shows in 3 Myr |
| Thickness of the older cover (salt on) (ft) | 656 (200 m) | start. tuned (allowed 164 to 9,843). The pre-run cover over the salt; the Gulf-style preset uses a thicker one |
| Unevenness of the older cover (salt on) | 0 | start. tuned. Seeded random thickness variation of the older cover |
| Seed of the cover unevenness | 1 | start. tuned |
| Cover resists bending (1) / not (0) (salt on) | 1 | tuned (check box). 1: the sediment above the salt is a viscous plate, so a preferred diapir width emerges. 0: thin-sheet flow only (M3.1), where the narrowest bumps grow fastest |
| Cover effective viscosity as a plate (salt on) (Pa s) | 1e19 | tuned. No published value for a whole cover is in the references (to verify). Widths scale as its 1/6 power |

*Welds and heat*
| Control | Default | Source |
|---|---|---|
| Weld: salt thinner than (ft) | 32.8 (10 m) | tuned (allowed 0 to 656). Hudec & Jackson (2007). A column counts as welded once its salt, which was thicker, falls below this. A label and an age only |
| Salt thermal conductivity at 0 deg C (W/m/K) | 6.0 | to verify (Clauser & Huenges 1995). Halite is about 5 to 6.5 near the surface, 2 to 4 times the sediment |
| Salt conductivity falls with temperature: a (1/K) | 0.0030 | to verify (Clauser & Huenges 1995). Coefficients as remembered for crystalline rock, not checked for halite |
| Salt conductivity falls with temperature: b (W/m/K^2) | 0.0042 | to verify (Clauser & Huenges 1995). See a |

With salt on, the sediment loads the salt and squeezes it basinward; the cover above rides up and down on the salt. Salt volume is conserved and has its own line in the mass balance. The cover resists bending (M3.2), so the width of the structures is set by the cover viscosity and thickness, not by the cell size: check by halving the cell size. Welds (M3.3): salt can never go below zero thickness. When a long step would ask a cell for more salt than it holds, the outflow is cut to what the cell has, so nothing is clipped and salt stays conserved. A column whose salt falls below Weld: salt thinner than is welded, and its first weld age is kept (it rewinds with the run). Salt conducts heat well, so everything below salt is cooler in the Temperature colour mode and the pseudo-well, and the weight of salt counts in the overburden.

**Slope failure (MTDs)** (M2.1 and M2.2; drawn by the Factor of safety colour mode, section 4, and in the section, the event list and the pseudo-well, sections 4, 8 and 10)

*Stability*
| Control | Default (sand / mud) | Source |
|---|---|---|
| **Friction angle phi' (effective stress)** (deg) | 33 / 25 | to verify (Hampton et al. 1996). Muds about 20 to 30°, sands about 30 to 38° |
| **Cohesion c' (effective stress)** (psi) | 0 / 0 | to verify (Hampton et al. 1996). Normally consolidated marine clay is near 0 |
| **Stability search depth below the seafloor** (ft) | 984 (300 m) | tuned. How deep the factor-of-safety search goes |

The factor of safety is the strength holding a slab of sediment in place divided by the pull of
gravity along the slope. Below 1 the slab would slide. The engine works it out from the
seafloor slope and the model's own pore pressure, so overpressure lowers it directly.

*Failure and run-out*, and the switch and the triggers below
| Control | Default | Source |
|---|---|---|
| Slope failure on (1) / off (0) | 0 | start. tuned (switch). Shown as the check box *Slope failure (MTDs)* at the top of the group. Off keeps the run identical to M1 |
| Most columns in one failure | 10 | tuned. How far a failure spreads sideways |
| Debris-flow yield strength (psi) | 0.73 (5 kPa) | tuned. Imran et al. (2001) model, to verify |
| Debris-flow viscosity (Pa s) | 1000 | tuned. Sets the speed, not where the flow stops |
| Debris-flow bulk density (kg/m^3) | 1800 | tuned |
| Porosity of mud in a fresh debris deposit | 0.55 | tuned |

*Triggers*
| Control | Default | Source |
|---|---|---|
| Shallowest slip surface considered (ft) | 32.8 (10 m) | tuned (allowed 0 to 328). Thinner slides than this are skin slides, not MTDs; 0 searches every cell |
| Gentlest slope checked for failure (deg) | 0.5 | tuned (allowed 0 to 5). A speed cut and a stated limit: failures on slopes under this are not modelled |
| Sea-level fall that makes an event a lowstand event (ft) | 65.6 (20 m) | tuned (allowed 0.3 to 328). Only the trigger tag |
| Accumulation rate that counts as rapid loading (m/yr) | 0.001 | tuned (allowed 0.00001 to 0.1). Only the trigger tag |
| Slope term that counts as oversteepening | 0.1 | tuned (allowed 0.001 to 5). Only the trigger tag |
| Pressure term that counts as overpressure | 0.1 | tuned (allowed 0.001 to 5). Only the trigger tag |
| Run-out below which a repeat failure is not tried again (km) | 0.5 | tuned (allowed 0 to 10). Skips re-failing a column that moved nothing |

With the switch on, any column whose factor of safety falls below 1 fails: the sediment above the slip surface runs out as a debris flow and stops where the yield strength holds it, as a mass-transport deposit (MTD). Sand and mud are conserved separately; debris that runs off the basinward edge counts as exported.

Why did it fail? (M2.3, rule changed in M2.7.) Every failure carries one trigger tag, worked out from the weakest column's change over the last 4 steps (20 kyr at 5 kyr steps). Nothing is imposed; the factor of safety falls for physical reasons and the tag says which one did most of it. Each of three terms (steeper sea floor, rising pore pressure, falling sea level) is divided by its own tuned threshold, and the term with the largest ratio wins if that ratio is at least 1: *oversteepening*, *rapid loading* (the pressure term, when the column gained sediment faster than the rapid-loading rate), *overpressure* (the pressure term, when loading was slow) or *lowstand*. If no ratio reaches 1 the tag is *mixed*. The tag does not change the physics; it is a label on the cause, and the list shows all three terms behind it (section 13.4). Failures that move almost nothing are flagged *stalled*, and failures cut by the search depth limit are flagged *window-limited* (section 13.4). The preset *Overpressured slope (MTD-prone)* turns failure on with mud permeability x0.1 and supply 30 m²/yr (both tuned) so there are events to look at. Limits: slopes under 0.5° and slip surfaces shallower than 10 m are not searched.

**Transport and turbidity currents** (all tuned; the form is cited where noted)
| Control | Default (sand / mud) | Note |
|---|---|---|
| **Subaerial diffusivity** (m²/yr) | 50,000 / 100,000 | Fluvial spreading on land. Gives about a 0.3 m/km coastal plain. Two-lithology form: Rivenæs (1992) |
| **Marine diffusivity at shoreline** (m²/yr) | 400 / 2,500 | Wave and current spreading at the shoreline. Form K = Km·exp(-d/dm) + Kg: Kaufman et al. (1991) |
| **Marine diffusivity e-folding depth** (ft) | 32.8 / 131.2 | How fast that spreading dies off with water depth |
| **Deep-marine background diffusivity** (m²/yr) | 100 / 1,000 | Slow gravity creep on the slope; picked to give about 5 to 7° muddy slopes |
| **Max share routed as turbidity currents** | 0.6 | Cap on the share of supply sent down as turbidity currents |
| **Shoreline-to-shelf-edge distance scale** (km) | 8 | Ties turbidity-current share to how close the shoreline is to the shelf edge |
| **Gradient defining the shelf edge** (m/m) | 0.01 | Where the model puts the shelf edge |
| **Turbidite deposition length at reference gradient** (km) | 20 / 400 | How far sand and mud travel before settling |
| **Reference gradient for turbidite length** (m/m) | 0.005 | |
| **Turbidite gradient exponent** | 2 | How strongly slope changes that length |

The turbidite controls are a **transport-length rule, not flow physics**: no flow is simulated. The
slope and coastal-plain diffusivities were tuned by eye, not calibrated to data.

**Compaction and pore pressure**
| Control | Default (sand / mud) | Source |
|---|---|---|
| **Surface porosity** | 0.49 / 0.63 | start. cited: Sclater & Christie (1980) |
| **Compaction coefficient (effective stress)** (1/psi) | 0.000185 / 0.000359 | start. cited: converted from Sclater & Christie's depth coefficients; exponential form after Athy (1930) |
| **Permeability intercept (log10 m^2)** | -14.5 / -22 | tuned. Mud: Yang & Aplin (2010) is the candidate source |
| **Permeability slope vs porosity** | 7 / 8 | tuned. log10 k = intercept + slope × porosity |
| **Mud permeability multiplier** | 1 | tuned. Scales mud permeability: the quickest way to see more or less overpressure |
| **Unloading stiffness (share of loading compressibility)** | 0.05 | start. tuned |

**Temperature** (M1.4c; off by default)
| Control | Default (sand / mud) | Source |
|---|---|---|
| **Temperature on (1) / off (0)** | 0 | start. tuned (on/off switch). Shown as the check box *Temperature on* at the top of the group |
| **Basal heat flow** (mW/m²) | 40 | cited: Jones (2003), to verify. The Gulf of America spans from under 20 to about 100 mW/m² |
| **Grain thermal conductivity** (W/m/K) | 7.7 / 2.5 | to verify (Clauser & Huenges 1995). Mud value is tuned |
| **Pore-water thermal conductivity** (W/m/K) | 0.6 | to verify (Woodside & Messmer 1961) |
| **Deep-water seafloor temperature** (deg F) | 39.2 (4 °C) | to verify. Not checked against a source |
| **Shelf / land surface temperature** (deg F) | 68 (20 °C) | tuned |
| **Seafloor temperature e-folding depth** (ft) | 984 | tuned. Smooth stand-in for the thermocline |

**Quartz cement** (M1.4c; off by default; only runs when Temperature is on)
| Control | Default | Source |
|---|---|---|
| **Quartz cement on (1) / off (0)** | 0 | start. tuned (switch). Shown as the check box *Quartz cement on* at the top of the group. Needs temperature on |
| **Quartz precipitation rate prefactor** (mol/m^2/s) | 1.98e-18 | cited: Walderhaug (1994) |
| **Quartz precipitation temperature coefficient** (1/deg C) | 0.022 | cited: Walderhaug (1994). Walderhaug (1996) varied it from 0.018 to 0.023 |
| **Temperature where cementation starts** (deg F) | 158 (70 °C) | cited: Walderhaug (1996). Below it the rate is zero |
| **Sand grain diameter (cement surface area)** (mm) | 0.2 | tuned. Synthetic |
| **Share of grain surface that is clean quartz** | 0.7 | tuned. Synthetic |

**Grid and numerical settings.** Not geology: these trade speed for accuracy. Change them only to check that a result does not depend on them.
| Control | Default | Source |
|---|---|---|
| **Columns** | 150 | start. Grid size |
| **Column width** (km) | 1 | start. Grid spacing |
| **Transport substeps per record step** | 5 | start. Numerical |
| **Salt substeps per record step** | 5 | start. tuned. Numerical |
| **Deep compaction: full solve every N steps (1 = off)** (steps) | 1 | start. tuned. Speed-up for long runs (section 5) |
| **Deep compaction: age of the always-updated window** (kyr) | 500 | start. tuned. Used only when the line above is more than 1 |
| **Temperature and cement: update every N steps** (steps) | 5 | start. tuned. Speed-up |
| **Most failures per step (rechecks of the scar)** | 5 | tuned |
| **Benchmark mode (constant properties)** | none | start. Switch for the Gibson benchmark. Leave it alone: it is for the Gibson test |

## 4. Reading the section
The big picture is the section: distance in km along the bottom, depth in ft on the left. A note
at the top right gives the vertical exaggeration (the section is much longer than it is deep, so
it is stretched). The shoreline and the shelf edge are marked. Water is pale blue.

Pick a colour mode with the buttons above it. The legend below the picture shows the ramp.
- **Grain size**: share of sand in each layer. Grey-green is mud, yellow is sand. Look for yellow
  tongues out in the basin: sand that bypassed the shelf at a lowstand.
- **Age**: when each layer was laid down, purple oldest, yellow youngest. Lines of constant
  colour are time lines. This is the mode for seeing how the clinoform builds out.
- **Porosity**: from 0.10 (brown) to 0.65 (teal). Deep and sandy layers lose porosity. A porous
  layer buried below a tight one is a candidate for trapped water.
- **Overpressure (λ*)**: the share of the buoyant load that the pore fluid carries. 0 is
  hydrostatic (pale), 1 is at the overburden (dark red). Look for the dark red under the fast
  depocentre in mud.
- **Temperature (°F)**: 32 to 392 °F, blue to red, steady conduction from the basal heat flow.
  It is always available. It does not need the temperature switch (that switch matters for
  cement, section 9).
- **Salt thickness** (only when **Salt layer** is on): the salt is coloured by how thick it is in each column, pale pink for thin to dark plum for 16,404 ft (5,000 m) or more. The scale is fixed, so colours compare across time steps. Sediment is grey, and the older cover (the sediment that lay on the salt before the run) is a shade darker than the sediment the run lays down. In every colour mode a run with salt also shows a magenta line on the top of the salt, a dashed brown line on the top of the older cover, and a heavy dark line labelled *weld* where the salt has been squeezed out. A key under the section explains each, with an (i) button.
- **Factor of safety**: the slope-stability result for every cell, on a log scale from 0.25 to 4 with 1.0
  in the middle. Reds are cells with a factor of safety below 1.2 (below 1 the slab would slide);
  pale to blue is safe. Flat seafloor has nothing pulling the slab down, so it is blue. A black
  dashed line shows the critical slip depth: the cell with the lowest factor of safety in each
  sloping column. Safety is worked out from the model's own pore pressure, so overpressure turns
  cells red.

**MTDs in every colour mode.** Debris-flow deposits (MTDs) are drawn hatched, with the stripes
changing direction from patch to patch, so they stand out over any colour. The hatching marks every
cell in the deposit of a slope-failure event, not only cells where debris is at least half of the
solids. A pink flag marked *headwall #n* shows where a failure started, for three steps after it
(and always for the event picked in the event list; section 13.4). With a picked event, the source columns are
drawn in pink on the seafloor and its deposit is outlined in yellow.

Click anywhere on the section to move the pseudo-well to that column. A vertical line shows where it is.

### The time bar
Under the section: **Play** (or Pause), **Back** and **Forward** (one step), **Start**,
**Present**, a slider to drag to any time, and two speed settings (frames per second, steps per
frame). The readout says which step you are at and its age in Ma (millions of years ago). All
of it is rewind: dragging back gives exactly the state the run had then.

## 5. Run length, presets and time steps
Speed depends on the number of **steps**, not the number of years. The presets balance this
by using longer steps further back in time.

What coarse steps can and cannot show:
- A 100 kyr step cannot show a 20 kyr or 41 kyr glacial cycle. **Individual glacial cycles
  disappear** in the old part of a long run. What survives is the average of sea level over the
  step, and the long trend.
- For 3 Ma to present, the Miocene and Cenozoic presets still use 5 kyr steps, so the glacial
  cycles are resolved there.
- The Miller et al. (2020) record used before 3 Ma is itself smoothed (about 2 Myr), so it has no
  glacial cycles to show even with fine steps.
- To keep long runs fast, the preset runs use **bundled deep compaction**: old layers are
  consolidated once every 10 or 20 steps, with the summed time. This is a numerical saving, not
  physics. It was measured against the full solve (about 0.25 % of the thickness on the Miocene
  preset and 0.8 % on the Cenozoic one; see `docs/physics-references.md`). The layer record still holds every layer.
- Use the long presets to see where sand and mud go over millions of years, not to read
  precise pressures at a fixed depth.

## 6. Sea level: the published curve, the sine, and the splice
**Sea-level source** switches between two:
- **Published curve** (default): a real global record. Younger than about 3 Ma it is Bintanja &
  van de Wal (2008) (ice-volume record, every 300 yr). Older than that it is Miller et al. (2020)
  (smoothed Cenozoic record, 20 kyr, uncertainty about ±10 m).
- **Sine (teaching)**: a plain sine of **Sea-level amplitude (sine only)** and **Sea-level period
  (sine only)**. Good for seeing cause and effect; real sea level is not periodic.

**The splice.** The two published curves meet between 2.8 and 3.0 Ma. Over that 200 kyr window
the model blends them linearly. At 3 Ma they differ by only 3.3 m, so there is no jump (the
largest change over 100 yr in the window is 0.37 m). In the chart, the line **changes colour**
where the record changes, and the line under the chart says which curve is in use at the time on
the slider and gives its citation.

The chart is **Sea level through time**, in ft, with the time axis in Ma (million years ago)
and a black line at the current slider time. A second chart, **Subsidence rate through time**,
shows the two edge rates (green landward, orange basinward) that were applied at each step.

## 7. Branches and compare
A branch is a what-if timeline. It shares the main run's history up to where you forked and
then runs with changed controls.

1. Drag the slider to the moment you want to change things from.
2. Press **Branch from here**. A new branch appears, active.
3. Change a control. Only the active branch changes, from the fork onward. Controls marked
   "start" are locked in a branch.
4. Select **Main run** or another branch with its radio button to look at it.
5. To compare, tick **compare with active** on another branch. A line under the section says how
   far the two surfaces differ at the current time, in ft, or "(identical)".
6. **Delete** removes a branch and its memory. The main run cannot be deleted.

Each branch keeps its own saved states; the list shows the memory a branch needs ("own 7.5 MB").
There can be **at most 8 branches**.

The classic test is the one from the spike: fork at 2 Ma, set **Sea-level offset** to
-164 ft (-50 m), and compare. Everything before 2 Ma is identical. After, the shoreline and shelf
edge sit further basinward at highstands. The effect is modest (the spike measured about 5 % more
basin-floor sand) because the ±40 m cycles already swing the shoreline across the whole shelf.

## 8. The pseudo-well
The **Pseudo-well** panel is a synthetic well at the column you clicked, at the time on the slider.
Depth is TVDSS in ft (below the sea surface). It has four tracks:
1. **Pressure, ppg EMW**: pore pressure (red), overburden (black) and hydrostatic (blue dashed),
   on a 6 to 20 ppg scale. Where red moves right of blue, the well is overpressured. If it
   approaches black, the pore fluid is carrying nearly all the load.
2. **Porosity**, 0 to 0.7.
3. **Temperature, °F**. A purple line marks where **Temperature where cementation starts** is
   crossed, and the depth where it happens is labelled. If cement is off the label says
   "(cement off)".
4. **Grain size**: yellow is sand, grey-green is mud.
   Debris-flow deposits (MTDs) in the column are hatched, labelled *MTD #n* with the event number.
   Hover (or tab to) a hatched interval to read the event: time, cause, source position, scar depth,
   volume and run-out. The same text appears under the plot.

Salt (when **Salt layer** is on) is drawn pink and labelled "salt", with its top and base depths. Salt has no pores and no pore fluid, so the pore-pressure and porosity lines stop at the top of the salt and start again below its base; the overburden line carries on and counts the salt at its own weight (about 18 ppg). If the column is welded, a heavy line marks the weld and a note under the plot gives its age and the salt left.

The temperature in this panel and in the Temperature colour mode is **steady conduction**: it
assumes the heat has had time to reach its balance. Real, fast-buried basins are colder at depth
than this, so deep temperatures read too warm.

### The planned well (M4.3)
The **Planned well** panel draws a well you design, with its pressures. It is a view: it never
changes a run, and it is saved in the scenario file (files without a well open as before).
Press **Plan a well here** to start a vertical well at the column you last clicked, and click the
section to move it. The path is drawn on the section in every colour mode, with a marker at the
total depth, and follows the time slider and the active branch.
- **Surface location**: km from the landward edge of the section.
- **Well shape**: Vertical, or Build and hold (a straight hole, a curve, then a straight tilted
  hold, all in the plane of the section).
- **Total depth**: ft TVDSS, the true vertical depth below the sea surface.
- **Air gap**: ft from the sea surface up to the rig floor (80 ft, tuned). Mud weights are measured from the rig floor.
- **Kickoff depth**: where the hole starts to curve (build and hold only).
- **Build rate**: degrees of inclination gained per 100 ft drilled.
- **Hold angle**: the tilt from vertical where the curve stops.
- **Direction**: toward the basin or toward the land.
- **Fracture-gradient method**: Eaton (1969) or Matthews & Kelly (1967).
- **Remove well** deletes the well from the scenario.

The plot has mud weight (ppg) across and depth (ft TVDSS) down: pore pressure, hydrostatic,
overburden and fracture gradient, with the mud-weight window shaded green, amber where it is tight
and red where there is no window. Salt is pink. Hover the plot, or use the arrow keys, to read
the values and the measured depth. Each line, shade and flag has an (i) that explains it. Tick
other branches under **Compare branches** to draw the same well on up to three branches on the
same axes, with a legend of branch names and a table of the narrowest window on each.

## 9. Burial temperature, quartz cement and changing subsidence
These three arrive with M1.4c. All are **off** by default so the default run is identical to
the spike.

**Changing subsidence.** Set **Subsidence history** to *thermal*: the two edge rates are the
rates at the start of the run and decay as exp(-t/τ) with τ = **Thermal subsidence decay time**,
62.8 Myr (McKenzie 1978). That is the decay law only, not a stretching model, and the rates are
still tuned. It is a start-only control, so change it on the main run.
- Effect on porosity and pressure: subsidence that slows with time gives less room later, so
  late sediment is buried more slowly and has more time to lose its water; fast early
  subsidence buries fast and keeps more water in. That is the direction to expect. The tests
  check the subsidence arithmetic against its closed form, not the size of the pressure effect,
  so judge that by running both and comparing branches or runs.

**Burial temperature.** Tick the **Temperature on** check box at the top of the **Temperature** group. The model computes steady
conduction: temperature = seafloor temperature + heat flow × Σ(thickness / conductivity), where
the bulk conductivity mixes grain and water. On its own it changes nothing in porosity or
pressure. It exists to drive cement. It also feeds the Temperature colour mode and the temperature track.

**Quartz cement.** Tick the **Quartz cement on** check box at the top of the **Quartz cement** group (temperature must also be on).
Above about 158 °F (70 °C) quartz precipitates in sands at Walderhaug's rate, which grows by a
factor of about 4.6 for every 30 °C (54 °F) of heating. What it does:
- It fills pore space in sand, so sand porosity falls and sand permeability follows it down.
- It freezes the sand framework at the stress it had when cementing began, so cemented sand stops
  compacting. Mud keeps compacting by stress as before.
- The silica comes from outside the model. It has its own line, **Quartz cement**, in the mass
  balance panel, so sand and mud still balance on their own.
- Effect on pressure: cemented sand is tighter, so it can be expected to drain less easily. The
  tests check the cement amount (against a hand calculation) and its mass line, not the
  pressure effect. The model has no chemical compaction of mud.

If you change these on the main run you must wait for the run to recompute.

## 10. Panels on the right
**Slope failures** (the list at the top of the right column). One row per failure event: number,
time (Ma), cause (lowstand, oversteepening, rapid loading, overpressure or mixed; section 13.3), source
position (km along the section), scar depth (ft), volume and run-out (km). Volume is the area
removed from this 2D section in km², not a 3D volume. Click a row (or its number) to go to that
event: the time bar moves to just after it, the pseudo-well moves to the middle of its deposit,
and the section marks the headwall, the source columns and the deposit. Click again to clear.
Under each row a grey line gives the three terms behind the cause in words, and a stalled or window-limited event adds a note (section 13.4). The header counts events, stalled events and unresolved columns. Rows after the current time are greyed. With failure off the panel says so.

**Mass balance** (km² of solid in the section; grains only, no pores):
- *supplied*: total delivered at the landward end.
- *stored*: change in the amount in the record since the start.
- *exported*: what left the model at the basin edge.
- *imbalance*: stored − (supplied − exported). Must be zero to rounding (1e-13 or so). Hover it
  for the relative error.
- Rows: **All sediment**, **Sand only**, and **Quartz cement** when cement is on. Sand has its own
  row on purpose: a total can balance while the sand/mud split is wrong.

**Speed**: **Run time**, **Last jump (worker)** (the last seek) and **Draw time**.

**Physics checks**: see section 11.

## 11. The physics checks panel
Press **Run checks**. It runs the benchmarks below in the browser (eleven groups, some with several rows), each against an exact solution or
a hand calculation, takes about 0.5 s and prints **ALL PASS (n/n)** or says what failed. Each row
shows the measured number, its limit and its source.

| Check | What it proves |
|---|---|
| **Consolidation vs Gibson (1958)**, T = 0.1, 1, 10 | The pore-pressure solver reproduces the exact solution for a clay layer that thickens at a constant rate. Limit 0.001 of overburden. Results are of order 1e-4 or less |
| **Drained sand porosity at 2 km vs Sclater & Christie (1980)** and **Drained mud porosity at 2 km ...** | With water free to leave, compaction follows the published porosity-depth curve to within 0.02 porosity |
| **Mass balance, sand only** and **Mass balance, mud only** | Over a 1 Myr coupled run, what is stored equals what was supplied minus what left, per grain size, to 1e-9 |
| **Infinite-slope FS, 6° slope, 25° friction, r_u 0.5** | The engine's factor of safety equals tan 25° / tan 6° × (1 − 0.5) = 2.2183 (hand calculation, relative error under 1e-12) |
| **FS crosses 1 at r_u = 1 − tan β / tan φ** | For 6° and 25° that is r_u = 0.7746. The engine gives FS = 1 there, above 1 just below it and below 1 just above it |
| **Bingham plug thickness** | A debris flow on a 5° slope has a rigid plug of thickness τ_y / (ρ′ g sin θ); a flow thinner than that does not move |
| **Mass balance through a slope failure, sand** and **... mud** | On a steep, overpressured hand-built slope, the sand (and the mud) before the failure equals what is left in the section plus what ran off the end, to 1e-12 |
| **Salt channel-flow decay** | A small bump on a flat salt sheet relaxes at h³ (ρ_salt − ρ_w) g k² / 12η (thin-sheet flow). Within 1 % |
| **Cover bending: fastest-growing wavelength** | With the cover as a viscous plate, the width that grows fastest is λ* = 2π (η_c h_c³ h³ / 18η_s)^(1/6). Within 5 % |
| **Mass balance, salt only** | Salt volume is the same before and after the flow, none clipped; sand and mud are not touched by the salt step |
| **Rewind is bit-identical** | A state restored from a saved state and replayed equals an uninterrupted run exactly. This is why scrubbing and branching can be trusted |

What the checks do **not** prove: that the parameters are right for any real basin, that the
turbidite rule is physical, or that cement and temperature give the right numbers. Those
parameters are labelled tuned or to verify. Cement and temperature have their own tests in the
project (`tests/burial.test.ts`) but not in this panel.

## 12. Save, open and autosave
The four buttons at the top of the controls:
- **Save** downloads a file `*.strata.json`. It stores the recipe: preset, seed, grid, run length,
  time steps, the main run's edited controls, every branch with its edits, and one fingerprint (a
  hash) per branch plus a few summary numbers (total sand and mud, mean surface height, largest
  overpressure, number of slope failures). It does **not** store the computed section.
- **Open…** reads such a file, recomputes everything, and compares the fingerprints. If they
  match you get exactly what was saved. If a fingerprint differs, the app compares the summary
  numbers: the same computer program gives slightly different last digits on a different
  operating system (Windows, Linux, Mac), so a file saved on one machine can open on another with
  a different fingerprint but the same totals. That is accepted without a warning. Only if the
  summary numbers differ too (usually because the engine changed after the file was made), or the
  file has no summary numbers (files from before this was added), a warning banner says the file
  "was made with a different engine version; results differ" and names the branches that differ.
  A file that is not a valid scenario is refused with a plain message and your current work is
  left alone.
- **New** goes back to the default last-3-Myr scenario.
- **Reset** keeps the current preset at full length and puts the controls back to its values.

**Autosave** keeps a copy of the recipe in this browser (local storage) a moment after every
change, and puts it back when you reload the page. It is a safety net, not a save: the line
under the buttons still says **Changes not saved to a file (kept in this browser)** until you
press Save. If the browser blocks local storage the app works but tells you autosave is off.

**Replace warning.** New, Open and Reset ask first if you have changes not saved to a file:
**Save first**, **Replace** or **Cancel**. Changing the preset, the run length or a main-run control
also asks if it would throw away branches.

## 13. Slope failure and MTDs
A mass-transport deposit (MTD) is what a slope failure leaves behind: a slab of slope sediment
slides, breaks up, runs down the slope as a debris flow and stops as a chaotic body. The app does
not draw MTDs on request. It checks every slope column at every step and lets the sediment fail
when the physics says so. Slope failure is **off** by default, so the default run is unchanged.
Turn it on with the check box *Slope failure (MTDs)* at the top of the **Slope failure (MTDs)** group (it restarts the
run, and a branch cannot change it) or choose the preset *Overpressured slope (MTD-prone)*.

### 13.1 What the factor of safety (FS) means
FS is the strength holding a slab of sediment in place divided by the pull of gravity along the
slope. Above 1 the slab stays. Below 1 it would slide. The slab is a thin sheet parallel to the
seafloor. The app tries every layer in the top 984 ft below the seafloor (**Stability search depth
below the seafloor**) in each sloping column and keeps the weakest.
- A steeper seafloor raises the pull, so FS falls.
- Overpressure means the pore water carries part of the weight, so the grains press together less,
  friction is lower and FS falls. The pressure is the model's own, from the compaction solver, so
  fast loading of slow-draining mud lowers FS without any extra setting.
- Friction angle and cohesion (section 3.3) set the strength. With cohesion 0, FS is
  (1 - share of the load carried by the pore fluid) x tan(friction angle) / tan(slope). On a 6°
  slope, mud at 25° (the default) needs the pore fluid to carry about three quarters of the
  buoyant load before FS reaches 1.
- Flat seafloor has no pull along the slope, so it cannot fail.

### 13.2 What happens in a failure
After each step every column with FS below 1 fails. The weakest column and the unstable columns
touching it (at most **Most columns in one failure**) fail together. The sediment above the slip
surface is taken out, runs downslope as a debris flow and stops where its yield strength holds it.
The debris is laid down as an MTD in the layer of that step, and the scar is checked again (at
most **Most failures per step (rechecks of the scar)** times). Sand and mud are each conserved:
removed = deposited + exported, where exported is debris that ran past the basinward edge. The
mass-balance panel counts it under *exported*.

### 13.3 What each trigger means
Each event is tagged with the main reason FS fell, worked out from the weakest column's change
over the last 4 steps (20 kyr at 5 kyr steps). Nothing is forced: the tag is a label on a physical
result. Three terms are measured, each divided by its own threshold (**Slope term that counts as oversteepening**, **Pressure term that counts as
overpressure** and **Sea-level fall that makes an event a lowstand event** in section 3.3, all tuned), and the largest ratio wins if it
is at least 1:
- **oversteepening**: the sea-floor slope got steeper.
- **rapid loading**: pore pressure rose and the column gained sediment faster than
  **Accumulation rate that counts as rapid loading** (0.001 m/yr).
- **overpressure**: pore pressure rose and loading was slow, so the pressure was already there.
- **lowstand**: sea level fell (default threshold 65.6 ft, 20 m, over those steps).
- **mixed**: none of the three reaches its threshold, so no single cause stands out.

The thresholds change the tag only, never the physics. Because the pressure term is measured on
a log scale it can reach tens of times its threshold when the pressure jumps toward the load, so
on the MTD-prone preset most events read rapid loading or oversteepening and few read lowstand.
That is a property of the tuned thresholds, not a finding about the sea level. Read the tag as
"what changed most just before the failure", not as the whole chain of cause. Tap the (i) next to
**Cause** in the list for the same rule in short form.

### 13.4 Reading the Factor of safety colour mode and the event list
- **Factor of safety** (a colour button above the section). Dark red to red is FS below 1, pink is
  1 to 1.2 (close to failing), then pale grey-blue to deep blue is safe (log scale, 0.25 to 4).
  The black dashed line follows the critical slip depth of each sloping column. Scrub the time bar
  and watch the red patches: they appear where overpressure builds or the slope steepens, and a
  failure removes the red above its slip surface. Hatched cells are MTDs and show in every colour
  mode.
- **Slope failures (MTDs)** (the panel at the top of the right column). One row per event: #,
  Time (Ma), Cause, Source (km), Scar (ft), Volume (km²) and Run-out (km). Volume is the area
  removed from this 2D section, not a 3D volume. A run-out of 0.0 means the debris stopped
  inside its own source columns. Click a row: the time bar goes to just after the event, the
  pseudo-well moves into the deposit, and the section shows the pink *headwall #n* flag, the source
  columns and the yellow-outlined deposit. Click again to clear. Rows later than the current time
  are grey. Under each row, a grey line gives the three terms behind the cause in words, for
  example *steepening ×1.2 in the last 4 steps; pressure rise: effective stress fell to 67% of its earlier
  value; sea-level fall 7.0 m*. The ×1.2 is how many times steeper the sea floor became, and the
  percentage is how much of the effective stress (load minus excess pore pressure) was left.
- **Stalled.** A row marked *(stalled)* says *failed but debris stayed: column unresolved*. The slope
  failed, but the debris moved less than 0.5 km, so the columns are still unstable. The model
  does not fail the same columns again in the same step, so they are counted, not hidden: the
  list header gives *N events, M stalled; K unresolved columns*. K adds up the columns of the
  stalled events only. Treat an unresolved column as
  "still unstable, not modelled further in that step". Tap the (i) next to the note. A step that
  hits the limit of rechecks while a column is still unstable is not flagged on any row; the model
  counts it internally (the MTD-prone preset in Node: header 2, internal count 4).
- **Window-limited.** A note *scar depth equals the search window (300 m, tuned)* means the
  scar went as deep as the search allows, so the real failure may be deeper and the scar depth and
  volume are lower bounds.
- **Pseudo-well** (section 8). MTD intervals are hatched and labelled *MTD #n*. Hover one to read
  its event.
- Events in the same step share a place and a time, so their headwall flags overlap in the section.
  Use the list to tell them apart.

### 13.5 The preset *Overpressured slope (MTD-prone)*
The default scenario with **Mud permeability multiplier** 0.1 and **Sediment supply** 30 m²/yr
(both tuned), slope failure on, 3 Myr, 5 kyr steps. Slow draining plus fast loading overpressures
the slope mud. The run is deterministic: the same code in the same runtime gives the same events. It does
**not** give the same events on every platform (section 15). After the M2.7 fixes it gave:
- Node 26 (the tests): 24 events, 16 tagged rapid loading and 8 oversteepening, 2 stalled (header: 2 unresolved columns;
  the engine's own count is 4, because two steps ended at the recheck limit with the slope still unstable and no stalled flag), 3 window-limited (deepest scar 299.3 m of the 300 m window).
- The built app in Chrome 155: 37 events from 2.49 Ma to 0.02 Ma, 32 rapid loading and 5
  oversteepening, 9 stalled, 10 unresolved columns, 1 window-limited. The sources are between km 47 and km 98.
- No event is tagged lowstand, overpressure or mixed. The M2.3 version tagged 32 of 33 events
  lowstand because sea level was tested first with a 5 m threshold; that was a flaw of the rule and
  it is fixed.

The events sit where the pressure is high and the slope is steep, which is what the physics says
should fail first. Whether the places and times
look right for an overpressured slope is your call. Nothing here is calibrated to a basin.

### 13.6 Limits (read before trusting a picture)
- **Infinite slope, 2D only.** The slip surface is a slab parallel to the seafloor. There are no
  rotational slumps (curved slip surfaces) and nothing in the third dimension. Volume is an area.
- **No earthquakes.** Strength is drained only: no shaking, no undrained or cyclic strength loss.
  Earthquakes are a common real trigger, so the model can miss failures.
- **Searched slopes and depths are limited.** Columns gentler than **Gentlest slope checked for
  failure** (0.5°) and slip surfaces shallower than **Shallowest slip surface considered** (32.8 ft)
  are skipped, so failures on very gentle slopes are not modelled at all.
- **The run-out method is simple.** It is a depth-averaged Bingham flow (Imran et al. 2001, written
  from the paper's model description, to verify) in one layer. There is no water entrainment or
  hydroplaning, so run-outs of mud-rich flows are likely too short. The rheology is constant
  and the bed is not eroded. A block slower than 1 mm/s counts as stopped.
- **Tuned parameters.** All the failure and run-out settings are tuned, not measured: yield
  strength, viscosity, flow density, mud porosity in the deposit, the limits above and the trigger
  thresholds. Friction angle and cohesion are "to verify", not tuned, but their values have not been
  checked against the paper. Treat run-out distances as order-of-magnitude.
- **Slope is resolved at column spacing** (1 km), so steep local scarps are smoothed.
- **Salt is never moved** by a failure, and cement in the released cells is dropped with the debris.

## 14. Salt

Salt is off by default, so the default run and every other earlier preset look exactly as before. Turn
it on with the **Salt layer on** check box (section 3.3) or pick the *Gulf-style: wedge over salt (66 Ma)*
preset.

### 14.1 What the model does
- A layer of salt lies on the basement, under an **older cover**: the sediment that was already
  there before the run starts. The salt is weak and light (2,160 kg/m³, against about 2,300 to 2,600
  for compacted sediment), so the weight of the new sediment squeezes it sideways, away from where
  the load is heaviest.
- It flows as a thin sheet of very thick fluid (the same maths as oil between two plates). The
  push comes from differences in the weight of the sediment on top and in the relief of the
  seafloor. Neither a fault nor a dip is needed.
- The sediment above the salt is treated as one stiff plate that resists bending. Without that,
  the narrowest bump would always grow fastest and the structures would come out one to four
  cells wide, whatever the grid. With it, the structure width comes from the cover's thickness and
  stiffness. That stiffness is a tuned number (**Cover effective viscosity as a plate (salt on)**), so the
  widths are a model result, not a measurement.
- **Columns do not move sideways.** They ride up and down on the salt: as salt leaves a column, its
  sediment sinks; where salt arrives, the sediment is lifted. Sediment that sinks forms a
  minibasin, and the sea-floor sag fills with more sediment, which presses harder on the salt.
- Salt is counted separately in the mass balance (salt only), and it is conserved to rounding.
  Salt can never go below zero thickness: when a column runs out of salt the flow out of it is
  cut to what is there, which is how a weld forms.
- Salt has no pores and no pore fluid. It adds its own weight to the load on everything below it
  and, because it conducts heat well, makes the sediment below it cooler (section 8).

### 14.2 The controls
They sit in the **Salt** group (three sections: Starting salt, Flow and cover, Welds and heat); the full table with defaults and sources is in section
3.3. Depths and thicknesses show in ft, distances along the section in km.
- **Salt layer on**: the check box at the top of the **Salt** group. Set at the start of a run.
- **Initial salt thickness**: how thick the salt is basinward of the pinch-out (default 4,921 ft; the Gulf-style
  preset uses 13,123 ft). Set at the start.
- **Salt pinch-out: no salt landward of** and **Salt pinch-out: full thickness basinward of**: the salt
  thins smoothly from nothing to its full thickness between these two distances from the landward
  edge (default 25 and 45 km; the Gulf-style preset uses 10 and 100 km). Set at the start.
- **Salt basin limit: full thickness landward of** and **Salt basin limit: no salt basinward of**: where the
  salt basin ends on the basinward side. Salt starts at full thickness landward of the first distance and
  tapers to nothing at the second (defaults 2,000 and 2,500 km, so they do nothing; the Gulf-style preset uses
  200 and 240 km). Salt can still flow past the limit, but none starts there. Without a limit, salt that is
  pushed basinward piles up against the closed end of the section (section 14.6). Set at the start.
- **Salt viscosity**: how stiff the salt is. Lower flows faster. 1e17 Pa s is the fast end of the
  published range, chosen so something happens in 3 Myr; the preset uses 1e18. Can be changed on a branch.
- **Salt substeps per record step**: a numerical setting; more substeps are slower and steadier. Set at the start.
- **Cover resists bending (1) / not (0) (salt on)** and **Cover effective viscosity as a plate (salt on)**:
  the plate that gives the structures their width. Widths grow with the 1/6 power of the viscosity, so
  ten times stiffer gives about 1.5 times wider. Can be changed on a branch.
- **Thickness of the older cover (salt on)**: the sediment on the salt at the start (default 656 ft;
  the Gulf-style preset uses 984 ft). Set at the start.
- **Unevenness of the older cover (salt on)** and **Seed of the cover unevenness**: a small seeded
  variation in the older cover's thickness. Salt flow needs something to start from; with a perfectly
  flat cover and a flat seafloor nothing grows. The same seed always gives the same pattern. Set at the start.
- **Weld: salt thinner than**: a column counts as welded when its salt, once thicker than this,
  falls below it (default 33 ft; the Gulf-style preset uses 328 ft, 100 m). It only labels the column and
  records when; it does not change the flow.
- **Salt thermal conductivity at 0 deg C (W/m/K)**, **Salt conductivity falls with temperature: a (1/K)**
  and **Salt conductivity falls with temperature: b (W/m/K^2)**: how well salt carries heat. All three
  are marked *to verify*.

The ⓘ button on each control gives its source, and the tag says *cited*, *tuned* or *to verify*.

### 14.3 The presets
*Gulf-style: wedge over salt (66 Ma)* runs the Cenozoic from 66 Ma on 400 columns of 1 km: salt 13,123 ft
(4,000 m) thick basinward of a pinch-out between 10 and 100 km, ending between 200 and 240 km (the basin
limit), a 984 ft (300 m) older cover with 50 % seeded unevenness (seed 2), salt viscosity 1e18 Pa s, cover
viscosity 1e19 Pa s, supply 28 m²/yr, only 10 % of it routed as turbidity currents, a weld threshold of 328 ft
(100 m), and the bundled sea-level curve. A wedge builds out across the salt. It takes about 5 s to run on the
development machine. The values were found by sweeping them against targets written down in advance (decisions
D18 and D19). They are all tuned and not matched to any field. Whether it looks like Gulf salt is for you to
judge, and 14.5 says plainly what it does and does not show.

*Salt: uneven cover (10 Myr)* is a **teaching toy**, not a Gulf section. It runs in under a second and shows
diapirs, minibasins and the cover's bending in one short run. To get that in 10 Myr it uses thin salt, a fast
supply and a thin cover, so the section is over-filled: the surface ends about 3.3 km above sea level, with 3.5
to 6 km of sediment over the salt. Its structures are 1 to 25 km wide and several are only one or two cells
wide, so do not read their widths or depths.

### 14.4 Reading the picture
Salt is pink in every colour mode (never coloured as porosity or pressure). Pick **Salt thickness**
to colour the salt by how thick it is in each column, pale pink for thin to dark plum at 16,404 ft or
more; the sediment turns grey. The scale is fixed so colours compare from step to step.
Under the section, a key shows: *Salt*, *Older cover (before the run)* and *Weld (none yet)*, which
becomes *Weld* once a column has welded. Each has an (i) button.

- **Minibasins** are places where the cover is thick and has sunk into the salt, so the salt below
  is thin or gone. In **Salt thickness** mode they are a pale patch (or none) under a thick grey
  fill; in the section the strata thicken into them. They are the places the sediment piles up.
- **Salt highs** are where the salt is thick between minibasins. In **Salt thickness** mode they
  are the dark columns. Sediment above them is thin or lifted, so look for thinner layers, onlap and
  a raised older-cover line (the dashed line). A **passive diapir** is a salt high whose crest stays
  near the seafloor while the sediment builds up around it. The model does not label diapirs; you
  read them from the section.
- **Welds** are columns where the salt has been squeezed out. They are drawn as a heavy dark line
  labelled *weld*, with white circles. A column becomes welded the first time its salt falls below
  **Weld: salt thinner than**, and keeps its first weld age when it is rewound.
- Lines on the section in every mode: a magenta line on the top of the salt, a dashed brown line
  on the top of the older cover.

In the pseudo-well (section 8), salt is a pink band over the pressure, porosity and temperature
tracks, labelled *salt: no pore fluid* and *no pores*, with its top and base depths in ft. The
overburden line carries on and counts the salt at about 18 ppg. The pore-pressure line stops at the top
of the salt and starts again below its base, because salt has no pore fluid; a note under the plot says so.
A well through a welded column shows the weld, its age and the salt that is left.
Tap the (i) buttons for what each mark means.

### 14.5 What the Gulf-style preset gives
These are numbers from one run on the development machine (Node 26, Windows); they are the model's
output, not data. Another machine can move single structures a little (section 15). At the end of
the run, with structures counted when their relief is at least 300 m (984 ft):
- The wedge keeps building out: the shoreline moves from about 54 km at 56 Ma to over 200 km near the end
  (checked by the tests).
- **Welds** (salt thinner than 100 m where it was thicker before) are real: about 12 to 20 km of weld in total
  in the run and in six repeats with 1-ulp noise, in runs of up to 3 or 4 km, under the shelf and the ramp the
  wedge crossed. **But where they are, and how long each run is, moves with a last-digit change in the maths.**
  Treat the places as examples, not predictions, and do not quote one weld length. The tests ask only for a total
  of 8 km or more and one run of 2 km or more. The thinnest salt left in a weld column is a few tens of metres;
  thin-sheet flow slows as the cube of the thickness, so it never reaches zero.
- **Crests**: two to five salt highs (five in the plain run, between about km 286 and 323) have their tops
  within 2 km of the seafloor and well away from the section edge. The shallowest still has about 4,240 ft
  (1.3 km) of sediment over it, so none reaches the seafloor. They are bumps of 300 to 850 m on a flat salt
  slab about 5 km thick, shaped by the seeded unevenness of the cover. They are not diapirs. The run meets the
  written target (a crest within 2 km of the seafloor) by the letter only. Diapirs that reach the seafloor and
  stay there need new physics (spike S3, then milestone M3b).
- **The salt basin has its own end.** Before the basin limit was added, the salt pushed basinward piled up against
  the closed end of the section, 8 to 9 km thick, and the earlier "crests" were ripples on that pile. Now the
  salt starts out between 10 and 240 km, flows about 115 km past its limit, stops about 45 km short of the end of
  the section and is 5 km thick at most.
- Spacing: the dominant wavelength of the salt thickness is about 13 to 14 km and holds within a few per cent
  when the columns are made narrower. The counts of highs and minibasins and their spacing do **not** hold
  (4 against 5 highs, 16 against 17.6 km spacing at 1,000 and 500 m), so do not trust a count.
- Total salt is conserved to about 1e-14 (relative), with nothing clipped.

If this does not look like Gulf salt to you, that is a finding; say what is wrong. The model has no
canopies, no sideways movement of salt and no faults, which may be the cause (below). The 200 to 240 km limit,
the 4 km start thickness and the 300 m cover are tuned and have no field behind them.

### 14.6 Limits (read before trusting a picture)
- **No canopies, tongues or sheets.** Salt never flows over the seafloor or over younger sediment. It
  stays under the cover, so "salt that reaches the seafloor" is a passive diapir only. Canopies need a
  different solver (backlog).
- **Columns do not move sideways.** There is no tilt of structures, no overhang and no lateral
  shift of a diapir.
- **No dissolution.** Salt that reaches the seafloor is not dissolved away.
- **No faults over salt.** The cover is one plate and does not break, so there are no crestal
  faults, rafts or counter-regional faults.
- **The cover is a viscous plate.** This stands in for real brittle and ductile cover and is the
  main tuned unknown: widths scale with the 1/6 power of its viscosity, and no published value for a
  whole sediment cover is in the references.
- **Runs start at 66 Ma at the earliest.** Salt is already in place when a run starts, under an
  older cover; the model does not deposit salt. Runs from the Jurassic need a redistributable older
  sea-level curve and are in the backlog (D17.4).
- **A finite-amplitude needle is a few cells wide**, and its width is not the same on every machine.
  Check any narrow structure by halving **Column width**.
- **Salt thermal conductivity is unchecked** (to verify). Compaction of the sediment below salt does not yet
  count the weight of the salt; the overburden shown in the views does.
- **Slope failure does not move salt** (section 13.6).
- The Gulf-style preset is tuned to targets, not matched to any field, and not yet judged by a stratigraphic specialist. The weld threshold of 100 m is a tuned label, chosen because thin-sheet flow never gets to 10 m in 66 Myr. The weld is real but its length moves under tiny numerical noise (14.5).
- **Salt against a closed edge.** The end of the section is closed: no salt can leave. Salt that starts all the way to it
  is squeezed basinward and stacks up against it, thick and flat, with ripples on top that are not diapirs. Give the salt
  its own basinward limit (14.2) and leave room beyond it.
- **Diapirs at the seafloor are not in the model yet.** Where a crest gets near the seafloor, thin-sheet flow drains the
  column as fast as sediment loads it, so a crest that is exposed is buried again within a few million years unless salt is
  fed in by hand. That is spike S3; milestone M3b is meant to deal with it (roadmap).
- The structure width of about 13 to 14 km comes from the tuned cover viscosity. It is a model result, not a measurement, and no published minibasin width was used (Pilcher et al. 2011 gives none).

## 15. Known limits
- **Same results on the same machine, not on every machine.** On one browser the same inputs give
  identical results, and rewind and scrubbing are bit-exact. Different platforms (Node against
  Chrome, Windows against Linux) can differ in the last digit of a calculation. Slope failure is a
  threshold process, so a last-digit difference can move an event by whole steps: the same preset gave
  24 events in Node and 37 in Chrome. Compare event lists only on one runtime. A project file opened
  on another machine can show a different list of failures.
- **Slope failure costs run time.** The M2.3 aim of at most 15 % extra is met only on the 3 Myr
  preset and missed elsewhere with failure on. Measured (M2.10, five runs each, best time with
  failure on against best time with it off, noisy machine): 3 Myr +11 %, Miocene +48 % (single runs
  +20 to +73 %; about 3.3 to 4.1 s against 2.2 to 2.9 s), Cenozoic +45 % (+17 to +52 %; about 3.9 to
  4.4 s against 2.7 to 3.4 s), the MTD-prone preset +20 % (+16 to +31 %). Every preset finishes in
  under 5 s. Failure off costs nothing.
- **Turbidites are a transport-length rule, not flow physics.** No turbidity-current flow, no
  channels or levees, slope failure is off by default and limited (section 13.6), no faults or 3D yet, and salt is limited (section 14.6).
- **The slopes are tuned.** Slope and coastal-plain diffusivities were tuned by eye to about 6°
  muddy slopes and a 0.3 m/km coastal plain, not calibrated to data.
- **Default overpressure is mild** (maximum about 14 % of the load, at 20 m²/yr supply). To see
  strong overpressure lower **Mud permeability multiplier** or raise **Sediment supply**.
- **Salt is a draft, and not checked against a field.** Salt flows under the sediment load when
  **Salt layer on** is ticked and the cover resists bending, so a preferred width appears; that
  width depends on a tuned cover viscosity. The limits are in section 14.6. The Gulf-style preset is tuned to targets, for you to judge.
- **Supply and subsidence are tuned**, not taken from a published Gulf of America rate.
- **Temperature is steady conduction.** It ignores the cooling effect of fast burial, so deep
  temperatures read too warm. Several thermal inputs are marked to verify.
- **Cement:** the grain surface area is held at its starting value, which slightly overestimates
  late rates. Mud has no chemical compaction.
- **Long runs are coarse.** Glacial cycles vanish in the old part (section 5).
- **Chaos.** The coupled system is sensitive: a 1e-7 relative change in supply moves the surface
  by about 4 m on a 12 Myr run. A tiny difference between two branches cannot be read as a
  physical effect.
- **Memory.** Measured: the main run needs about 21 MB (3 Myr), 76 MB (Miocene) or 88 MB (66 Myr),
  and a branch forked at 80 % of the run adds about 7, 27 or 38 MB. The cap is 8 branches.
- **Seek speed.** Scrubbing is quick for the default run (median about 30 ms) and slower for
  66 Myr runs (about 110 ms); that was measured on one Windows machine and moves with load.
- **Branches in a reopened file get new internal names** (branch 4 may become 3). Nothing in
  the file depends on them.
- The app has not had a specialist review. Treat the pictures as a thinking aid, not a prediction.

# Strata Lab

A browser app that builds geology by running the physical processes that make it. You set
the boundary conditions (sea level, sediment supply, subsidence, rock properties), then watch
a basin fill. You can fast-forward, rewind, and branch a what-if from any moment.

Owner: John, a geohazards geologist planning deepwater wells, mostly in the Gulf of America.

## Why
- **Learning.** You see cause and effect: why a sea-level fall sends sand to the basin floor,
  why mud that builds fast stays overpressured, why salt pushes minibasins down.
- **Planning.** The same model shows what a well would meet: pore pressure, fracture gradient,
  shallow hazards (MTDs, overpressured sands, salt), and how they change under other scenarios.
- **Grounded.** It is a process model, not a drawing. Mass is conserved, every solver is checked
  against an exact solution, and every parameter has a published source or is labelled as tuned.

## What it is not
- Not a replacement for basin-modelling packages (PetroMod, Dionisos, GPM). It favours speed and
  insight over completeness, so you can drag a slider and watch the result.
- Not calibrated to any real basin, and never fed company data. Examples are synthetic or rebuilt
  from published work with a citation.

## How it works (from spike 001)
- **2D section, columns of layers.** Each column stores one layer per time step: sand and mud
  volumes, maximum effective stress and excess pore pressure. That record is the single source
  of truth. Every view (section by age, grain size, porosity, overpressure; pseudo-well) only reads it.
- **Processes.**
  - Sediment transport: two grain sizes moving by water-depth-dependent diffusion.
  - Turbidity currents: carry sediment past the slope and lay it down where the gradient eases.
  - Subsidence.
  - Compaction coupled to pore pressure: 1D consolidation in each column, Athy-type porosity
    versus effective stress, and permeability that depends on porosity.
- **Time machine.** Runs are deterministic. Snapshots are taken every few steps. To rewind, the
  model restores the nearest snapshot and replays. A branch shares history up to its start time,
  then runs on its own parameters.

## Lessons from spike 001 (2026-10-14)
- **Speed.** A 3 Myr, 150-column run takes about 1.5 s in a browser. Scrubbing to any time takes
  a median of 24 ms. Interactive 2D process modelling is practical.
- **Mass balance needs care.** The first sorting scheme balanced total mass but quietly swapped
  sand for mud (27% of supply). Check mass balance for each grain size, not only the total.
- **Tuned values.** Slope and coastal-plain diffusivities were tuned by eye (about 6° slopes,
  about 0.3 m/km coastal plain). They need sources or calibration.
- **Small sea-level effect.** A −50 m step changed the result only modestly, because ±40 m
  cycles already swing the shoreline across the shelf. Use real sea-level curves before
  judging any sea-level response.
- **A test John can't make.** John found the geology convincing but is not a stratigraphic
  modelling specialist. "Looks right to a geologist" is a necessary test, not a sufficient one.
  Benchmarks and comparisons with published numbers have to carry the rest.

## Relationship to geoblock
geoblock (`C:/Users/John/Projects/geoblock`) is kinematic: you describe the geometry and it draws
it. Strata Lab is process-based: you set conditions and the geometry emerges. They are separate
for now. A later link (for example, exporting a Strata Lab section into geoblock) is in the backlog.

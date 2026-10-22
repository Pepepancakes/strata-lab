# Parameter lineage (LIN-1, D29)

Where each **tuned** or **to verify** physical parameter in `docs/physics-references.md` could get a published source, found by walking the citation lists in OpenAlex (method borrowed from the open-source tool Sediment; method only, no code). Written 2026-10-19 on branch `strata-lab/lin-01-parameter-lineage`.

**These are recommendations, not sources.** No value in the engine, and no row of `physics-references.md`, was changed by this card. A parameter moves from `tuned` to `cited` only when a value is adopted with a page reference from a paper that has been read. Raw traces are in `docs/lineage/<param>.json`; `scripts/lineage/openalex-trace.mjs` regenerates one.

## Summary for John

- 25 physical parameters traced (each has a JSON file). 22 got citation links from OpenAlex; the three that did not are heat flow (a thesis with no list), Poisson's ratio and the stress ratio Ki (Eaton 1969, no list). A citation link shows only a reference relationship, not a value. 6 have **no usable source**: debris-flow density, cover viscosity (only sensitivity studies), cover thickness, subsidence, deep-sea-floor temperature, grain density.
- Values I could actually read: Poisson's ratio and the Matthews and Kelly constant (Eaton 1969, Zhang and Yin 2017 and Traugott 1997, from your notes), the Bingham yield strength (Elverhoi et al. 2005, full text), the salt viscosity range and a salt thickness bound (from your salt notes). Heat flow (40 mW/m2) and the quartz-cement rate range are **abstract only**; the mud permeability equation was abstract only in LIN-1 and has since been read in full (LIN-2). Sediment supply is from partial open-access web text.
- One citation in the ledger does not hold: the salt viscosity range "about 1e17 to 1e19, Hudec and Jackson 2007". Your full-read note says that paper gives no viscosity value. A source that does is Wagner and Jackson 2011, p. 311 (item 12).
- Good news on mud permeability: the engine's mud curve sits inside the band the Yang and Aplin 2010 equation gives for clay fraction 0.5 to 0.7 (my arithmetic; confirmed against the full paper in LIN-2, section 2). The re-fit card (D28.2) needs one decision from you first: where the clay fraction comes from (recommendation in `docs/pp-notes/yang-aplin-2010.md` section 7).
- **LIN-2 update (2026-10-21):** Yang and Aplin 2010 and 2004 have now been **read in full** (your copies; notes in `docs/pp-notes/`). The 2010 equation is confirmed. Neither paper has a free full text online (the earlier "open access" wording was wrong). 2004 gives no unloading value, so `elastic` stays tuned. New finding: in the Gulf preset the Hart mud's compaction curve behaves like a clay fraction of 0.3 to 0.5 while its permeability law behaves like 0.6 to 0.7; the two describe different muds.
- Read first: done for Yang and Aplin 2010 and 2004. Highest value to buy or request now: Imran et al. 2001, Clauser and Huenges 1995, Hampton, Lee and Locat 1996 (see "Papers to get").

## How to read this document

- **Chain** lists papers oldest to newest, ending at the seed. "verified" = the citing paper's OpenAlex reference list contains the cited one. "inferred" = I believe the link from your notes but OpenAlex does not show it. A verified link shows a reference relationship, **not** that a value was taken from there.
- **Read:** *full* = full text read (by me, or through your deep-read notes in `docs/pp-notes/` and `docs/salt-notes/`; the notes are named). *abstract* = abstract only. *partial* = excerpts of an open-access web page, no page numbers. *none* = not read; anything about such a paper is "(to verify; not read)".
- **OA** = open access, so you can read it free. Links are DOIs; OpenAlex IDs are given so the JSON can be matched.
- Values marked "my arithmetic" are calculations from a quoted number, not published numbers.
- The salt notes (`docs/salt-literature.md`, `docs/salt-notes/`) live on branch `strata-lab/docs-01-salt-lit-main`, not yet on main; they are cited as "salt notes".

## Classification of every tuned / to verify item

**Physical** (traced; a paper could give the number). Order follows `physics-references.md`.

| # | Parameter (engine key) | Ledger status | JSON |
|---|---|---|---|
| 1 | sand permeability `kA`, `kB` (sand) | tuned | perm-sand |
| 2 | mud permeability `kA`, `kB` (mud) | tuned | perm-mud |
| 3 | unloading stiffness `elastic` | tuned | unloading-stiffness |
| 4 | diffusivities `Kc`, `Km`, `dm`, `Kg` | tuned | diffusivity |
| 5 | sediment supply `supply` | tuned | sediment-supply |
| 6 | subsidence `subsShelf`, `subsBasin` | tuned | subsidence |
| 7 | friction angle `phiFric` | to verify | friction-angle |
| 8 | cohesion `cohesion` | to verify | cohesion |
| 9 | Bingham yield and viscosity `runYield`, `runViscosity` | tuned | bingham-rheology |
| 10 | run-out density `runDensity` | tuned | runout-density |
| 11 | fresh-deposit mud porosity `mtdPhiMud` | tuned | mtd-porosity |
| 12 | salt viscosity `saltVisc` | tuned (range cited) | salt-viscosity |
| 13 | cover viscosity `coverVisc` | tuned | cover-viscosity |
| 14 | salt thickness `saltThick` | tuned | salt-thickness |
| 15 | cover thickness `coverThick` | tuned | cover-thickness |
| 16 | salt conductivity `saltK0`, `saltKa`, `saltKb` | to verify | salt-conductivity |
| 17 | sand grain conductivity (`kGrain` sand) and the geometric-mean mixing law | to verify | grain-water-conductivity |
| 18 | mud grain conductivity (`kGrain` mud) | tuned | mud-grain-conductivity |
| 19 | heat flow `heatFlow` | cited, to verify | heat-flow |
| 20 | deep seafloor temperature `tSeaDeep` | tuned | sea-floor-temperature |
| 21 | quartz-cement clean-surface share `cemSurf` and the rate law | to verify | quartz-cement-surface |
| 22 | Poisson's ratio `poissonRatio` (0.40) | tuned | poisson-ratio |
| 23 | stress ratio `matthewsKellyKi` (0.60) | tuned | stress-ratio-ki |
| 24 | sea water density `RHO_W` (1025) | to verify | water-density |
| 25 | grain density `RHO_S` (2650) | to verify | grain-density |

**Numerical / set-up** (not traced). Each: no source expected, with the reason.

- `saltOn`, `failOn`, `coverBend`, `fgMethod`: switches; no source expected: on/off choice.
- `nSaltSub`, `failMaxCells`, `failMaxIters`, `bundleEvery`, `bundleAgeYr`: no source expected: iteration counts, caps and bundling for speed or stability.
- `stabMaxDepth`, `failMinDepth`, `failSlopeMin`: no source expected: search limits that trade speed for completeness (the ledger notes the two thin-slide and gentle-slope values as to verify against Hampton et al. 1996; read that paper with item 7).
- `failLowstandDrop`, `failRapidRate`, `failSlopeTerm`, `failPressTerm`, `failStallRunout`, `weldThick`, `tightWindowPpg`: no source expected: thresholds that change a label only, never the physics.
- `saltPinchStart`, `saltPinchEnd`, `saltLimitStart`, `saltLimitEnd`, `coverUneven`, `coverSeed`: no source expected: preset geometry and seeded unevenness.
- `turbidite routing` (share, transport lengths, `tcLambda`, `tcL0`): no source expected: a transport-length rule, not flow physics.
- `kMudMult`, `tSeaShallow`, `tSeaScale`, sine sea level: no source expected: what-if multiplier, and smooth stand-ins or a teaching option.
- `lowerMarginPpg`, `upperMarginPpg`: no source expected: operator safety margins.
- Air gap, 80 ft: no source expected: a rig-specific input, editable per well; a typical floating-rig value, not a property of the Earth. DECISION: classified set-up, not physical.
- Preset start (66 Ma, 400 columns of 1 km): no source expected: set-up.

## Method in one paragraph

For each physical item I chose a concept query and a seed paper (the one named in the ledger where OpenAlex has it), fetched the seed's reference list and the metadata of each reference (up to 60 per seed, most cited first), and for the three parameters that matter most to the Gulf preset (mud permeability, sediment supply, subsidence) walked one more level from five ancestors (up to 15 each). The search quota ran out partway, so a few search candidates were never checked (noted per section).

---

## 1. Sand permeability (`kA` -14.5, `kB` 7)

- **Used in:** `src/engine/params.ts` keys `kA`, `kB` (sand component); log10 k = A + B phi.
- **Chain (verified, one level):** Weyl and Beard 1973 (influence of texture on porosity and permeability of unconsolidated sand) and Burst 1969 (Gulf Coast clayey sediments) are among the 60 kept references; both feed the seed **Ehrenberg and Nadeau 2005**, AAPG Bull. (W2141657015, DOI 10.1306/11230404071; not OA). Read: abstract only.
- **Contribution (abstract):** global plots of porosity against depth and of average permeability against porosity for tens of thousands of siliciclastic and carbonate reservoirs, with a discussion of what controls reservoir quality.
- **Published value:** none read.
- **Recommendation:** *obtain Ehrenberg and Nadeau 2005 then decide.* It is a candidate envelope for a sand permeability line, not a Gulf slope curve.

## 2. Mud permeability (`kA` -22, `kB` 8)

- **Used in:** `src/engine/params.ts` keys `kA`, `kB` (mud); `kMudMult` scales it. The ledger names Yang and Aplin 2010 as the candidate and the Backlog's D28.2 re-fit card is the adoption step.
- **Chain (verified, two levels):** Terzaghi 1943, Skempton 1944, Mesri 1971, Bethke 1985, Neuzil 1994 (*How permeable are clays and shales?*), Burland 1990 and Yang and Aplin 2007 (*Permeability and petrophysical properties of 30 natural mudstones*, OA, W2080246391) are references of the seed **Yang and Aplin 2010**, Mar. Pet. Geol. 27, 1692-1697 (W1995654536, DOI 10.1016/j.marpetgeo.2009.07.001). **LIN-2 (2026-10-21): the paper's own reference list contains Skempton 1944, Burland 1990, Mesri and Olson 1971 (not Mesri 1971 alone), Neuzil 1994, Dugan and Flemings 2000, Bethke 1985 and Yang and Aplin 2007 and 2004, so those links are now verified against the paper itself.** Terzaghi 1943 is cited there too. The "OA copy at the Durham repository" in LIN-1 was wrong: no free full text could be fetched; the full read used John's copy. Five ancestors were walked one level further (Burland 1990, Mesri 1971, Neuzil 1994, Yang and Aplin 2007, Dugan and Flemings 2000): 128 papers, 161 verified edges in `docs/lineage/perm-mud.json`. Read: **full** (LIN-2; `docs/pp-notes/yang-aplin-2010.md`).
- **Contribution:** at a given porosity, mud permeability varies over 2 to 5 orders of magnitude; most of that is explained by clay fraction (CF, mass fraction under 2 microns). From 376 data points from 303 samples (CF 12 to 97 %, porosity 0.04 to 0.78; North Sea and Gulf of Mexico wells plus shallow and reconstituted samples) they fit **bedding-perpendicular** permeability K (m2) against void ratio e = phi/(1 - phi) and CF, with r2 = 0.93 (eq. 4, p. 1695); including CF cuts the spread at one porosity from 2-5 orders to about one, and almost all points are within a factor of 3 of the fit (p. 1696). The equation is in the abstract and eq. 4: ln K = -69.59 - 26.79 CF + 44.07 CF^0.5 + (-53.61 - 80.03 CF + 132.78 CF^0.5) e + (86.61 + 81.91 CF - 163.61 CF^0.5) e^0.5. **LIN-1's transcription was checked on the page image and is correct.**
- **Comparison with the engine (my arithmetic from eq. 4; confirmed in LIN-2):** log10 K in m2, engine mud curve -22 + 8 phi against the equation at three clay fractions.

| phi | engine | CF 0.3 | CF 0.5 | CF 0.7 |
|---|---|---|---|---|
| 0.1 | -21.2 | -20.3 | -20.8 | -21.3 |
| 0.2 | -20.4 | -19.1 | -19.9 | -20.7 |
| 0.3 | -19.6 | -18.0 | -19.1 | -20.1 |
| 0.4 | -18.8 | -17.0 | -18.2 | -19.4 |
| 0.5 | -18.0 | -16.0 | -17.2 | -18.7 |

  The engine's mud line lies between the CF 0.5 and CF 0.7 curves at every porosity shown, so it behaves like a clay-rich mud (CF about 0.5 to 0.7). **LIN-2 refinement:** the slope claim in the first version of this sentence holds only for CF 0.5 and lower: over phi 0.1 to 0.5 eq. 4 has a mean slope of 10.9 (CF 0.3), 8.9 (CF 0.5) and 6.5 (CF 0.7) per unit porosity against the engine's 8. The engine has no clay fraction, so a straight adoption needs a product decision on where CF comes from; LIN-2 lists the options and one recommendation (`docs/pp-notes/yang-aplin-2010.md` section 7).
- **Read-level findings (LIN-2):** eq. 4 is for bedding-perpendicular (vertical) flow, which matches the engine's 1D vertical flow; no anisotropy ratio is given. Valid for CF 12 to 92 % (natural; 97 % is five smectite points) and porosity 0.04 to 0.78, but porosity above 0.55 rests on 24 reconstituted samples and five smectite points, and the data are 99 % marine. Scatter: almost all points within a factor of 3, about one order of magnitude remaining. The count of Gulf of Mexico points is not stated. **Against the Hart mud (Gulf preset):** at its surface porosity 0.40 the engine's K is 10^-18.8; eq. 4 gives 10^-17.0 (CF 0.3), 10^-18.2 (CF 0.5), 10^-19.4 (CF 0.7). So adopting Yang and Aplin does not by itself remove the AUD-6 B-1 overpressure; it depends on the CF chosen (my arithmetic; no run made). **Contradiction with LIN-1:** LIN-1 called the paper open access with a Durham copy; there is none. Nothing else in LIN-1 for this item is contradicted.
- **Recommendation:** *adopt in the D28.2 re-fit, after John decides the clay fraction.* The card can start once that decision is made. Recommended option (John decides): one visible mud clay-fraction input per preset, labelled tuned, starting at about 0.7 for the North Sea default mud and about 0.4 for the Hart mud, chosen so the permeability law and the compaction curve describe the same mud (`docs/pp-notes/yang-aplin-2004.md` section 6). Until then the mud values stay `tuned`, now with a published envelope read from the full paper.

## 3. Unloading stiffness (`elastic` 0.05)

- **Used in:** `src/engine/params.ts` key `elastic`; share of loading compressibility on unloading.
- **Chain (verified, against the paper's own reference list in LIN-2):** Athy 1930 (density, porosity and compaction), Terzaghi 1943, Skempton 1944, Burland 1990, Hottman and Johnson 1965 and Eaton 1975 are references of the seed **Yang and Aplin 2004**, Petrol. Geosci. 10, 153-162 (W2103433309; the copy read carries no DOI, OpenAlex gives 10.1144/1354-079302-567). Not open access: no free full text was found. Read: **full** (LIN-2; `docs/pp-notes/yang-aplin-2004.md`).
- **Contribution:** the soil-mechanics law e = e100 - beta ln(sigma'/100) (eq. 1, p. 153), with e100 = 0.3024 + 1.6867 clay + 1.9505 clay^2 and beta = 0.0407 + 0.2479 clay + 0.3684 clay^2 (eqs 23, 24, p. 157; r2 = 0.92, n = 3847 points from 22 wells, 21 of them North Sea, clay 8 to 90 %, effective stress 0.8 to 40 MPa). Mechanical compaction only. **It gives no unloading value:** it says mudstone is "essentially inelastic" and porosity "only slightly restored" on unloading (pp. 153, 159), so `elastic` 0.05 agrees in direction but gets no number from it.
- **Comparison with the engine (my arithmetic; `yang-aplin-2004.md` section 6):** the North Sea default mud tracks the CF 0.7 curve from 1 to 10 MPa; the Hart mud lies between the CF 0.3 and CF 0.5 curves from 2 to 20 MPa. The laws differ in form (logarithmic against exponential), so adopting eqs 23, 24 would be a change of compaction law, not a new coefficient.
- **Recommendation:** *keep `elastic` tuned; relabel it "tuned, qualitatively consistent with Yang and Aplin 2004 pp. 153, 159".* The compaction law itself is a separate decision for John (not proposed here).

## 4. Diffusivities (`Kc`, `Km`, `dm`, `Kg`)

- **Used in:** `src/engine/params.ts` keys `Kc`, `Km`, `dm`, `Kg`; `src/engine/transport.ts`.
- **Chain (verified):** Meyer-Peter 1948 (bed-load formulas), Vail 1977, Posamentier 1988 and a diffusion textbook (*The mathematics of diffusion*, 1975 edition) are references of the seed **Rivenaes 1992**, Basin Research (W1977840933, DOI 10.1111/j.1365-2117.1992.tb00136.x; not OA). Read: abstract only. The engine already cites this paper and Kaufman 1991 (not searched; see Papers to get).
- **Contribution (abstract):** a dual-lithology (sand and mud) diffusion model with depth-dependent transport coefficients, solved implicitly, in which each lithology has its own coefficient function that "can be tuned" to give realistic sand trapping. Tuning is the method there, not a flaw.
- **Recommendation:** *keep tuned.* These are calibration numbers (the ledger already ties them to a 0.3 m/km coastal plain and about 6 degree muddy slopes). Better to cite those two observational targets than to look for a single published diffusivity.

## 5. Sediment supply (`supply` 20 m2/yr, solid)

- **Used in:** `src/engine/params.ts` key `supply`; Gulf preset.
- **Chain (verified, two levels):** Galloway 1989 (genetic stratigraphic sequences), Galloway and others 2000 (*Cenozoic depositional history of the Gulf of Mexico basin*, W2105082865), Molnar 2004 (late Cenozoic increase in accumulation rates), Syvitski (fluvial sediment delivery to the coastal ocean) and Somme 2009 (source-to-sink) are references of the seed **Galloway, Whiteaker and Ganey-Curry 2011**, Geosphere 7(4), 938-973 (W2021800930, DOI 10.1130/GES00647.1, **OA**). 136 papers, 156 verified edges in `docs/lineage/sediment-supply.json`. Read: **partial** (open-access web excerpts; no page numbers; the PDF could not be fetched automatically).
- **Contribution:** regional mapping of 18 Cenozoic depositional episodes, summed to grain volume with age-dependent compaction factors, giving supply rates from more than 150,000 km3 per Myr at the peak to much lower values (the abstract's low figure is garbled in the copy I read, so I do not quote it).
- **Published values (partial text, no page):** the Lower Wilcox exceeded 150,000 km3/Ma, "the highest seen in any multi-million-year deposode"; the Oligocene Frio/Vicksburg averaged more than 55,000 km3/Ma. Rates vary by as much as an order of magnitude through the Cenozoic.
- **Comparison (my arithmetic):** 50,000 km3/Ma is 5e7 m3/yr. Spread along 1,000 km of margin that is 50 m2/yr; along 2,000 km, 25 m2/yr. The engine's 20 m2/yr is the same order of magnitude as a whole-Gulf Oligocene average for a 2,000 km margin, and below the Wilcox peak (150 m2/yr per 1,000 km). The strike length is my assumption; the paper's per-axis breakdown (Table 1) is needed to choose one.
- **Recommendation:** *obtain the full text (OA) and read Table 1, then decide.* Likely outcome: keep 20 m2/yr as a labelled order of magnitude and cite Galloway 2011 for the range, with per-era presets as a separate product choice.

## 6. Subsidence (`subsShelf` 40, `subsBasin` 150 m/Myr)

- **Used in:** `src/engine/params.ts` keys `subsShelf`, `subsBasin`; thermal decay `subsTau` is already cited (McKenzie 1978).
- **Chain:** the seed chosen, **Galloway and others 2000** (W2105082865; not OA), is a depositional history; its 58 references (Berggren 1995 time scale, Winker 1982 shelf margins, Galloway 1989, Prather 1998) do not give a subsidence rate. Walked one level from five ancestors: 92 papers, 103 verified edges. Read: none.
- **Contribution:** none found for the quantity. DECISION: no good seed exists in what I could search; I did not force one.
- **Recommendation:** *keep tuned.* Needs a Gulf Coast backstripping or tectonic-subsidence paper that I did not find (search quota ended). Candidate lead from the Galloway 2011 section: the paper measures loading and accommodation, which constrains water-loaded subsidence but is not a rate.

## 7. Friction angle (`phiFric` 33 sand, 25 mud) and 8. Cohesion (`cohesion` 0)

- **Used in:** `src/engine/params.ts` keys `phiFric`, `cohesion`; `src/engine/stability.ts`.
- **Chain (verified):** Bagnold 1954 and 1956, Scheidegger 1973, Schofield 1968 (*Critical state soil mechanics*), a 1976 *Fundamentals of soil behavior* textbook and Sloan 2007 (hydrates) are among the 60 kept of 146 references of the seed **Hampton, Lee and Locat 1996**, Rev. Geophys. 34(1), 33-59 (W4210955136, DOI 10.1029/95RG03287; not OA). Read: abstract only.
- **Contribution (abstract):** a review of submarine landslides: where they happen, how large they are (volumes to 20,000 km3, run-outs beyond 140 km), and the stress balance on a rupture surface. The abstract gives no friction or cohesion values.
- **Published value:** none read. The ledger's "muds about 20-30, sands about 30-38 degrees; cohesion near 0" are from general knowledge.
- **Recommendation:** *obtain Hampton, Lee and Locat 1996, then decide* for both. Also check there the `failMinDepth` and `failSlopeMin` limits.

## 9. Debris-flow yield strength and viscosity (`runYield` 5 kPa, `runViscosity` 1000 Pa s)

- **Used in:** `src/engine/params.ts` keys `runYield`, `runViscosity`; `src/engine/runout.ts`.
- **Chain (verified):** Mohrig 1998 (hydroplaning of subaqueous debris flows), Savage 1991 (avalanches of granular materials), Johnson 1972 (*Physical processes in geology*) and Heezen 1952 (turbidity currents and the 1929 Grand Banks slump) are references of the seed found, **Imran, Harff and Parker 2001**, Computers and Geosciences (W2020506809, DOI 10.1016/S0098-3004(00)00124-2; not OA), which is a sister paper of the Imran, Parker, Locat and Lee 2001 model the ledger names (J. Hydraul. Eng. 127(11), 959-968). DECISION: I could not locate the J. Hydraul. Eng. paper before the search quota ended; the trace uses the sister paper. Re-run with the right seed once found. Read: none.
- **Full-text source read:** **Elverhoi and others 2005**, Nat. Hazards Earth Syst. Sci. 5, 633-648 (W2170852390, DOI 10.5194/nhess-5-633-2005, **OA**; chain in `docs/lineage/runout-density.json`). Read: **full** (PDF text).
- **Published values (Elverhoi 2005, pp. 642-643, Storegga slide complex, northern Norway margin, not the Gulf):** yield strength 8 to 10 kPa reproduced the run-out of two typical slides (values the authors call compatible with undisturbed geotechnical strength once clay sensitivity is allowed for); 6 to 8 kPa fitted the run-out ratio best and about 12 kPa the run-out distance; a 5 kPa case with hydroplaning appears in their Fig. 9. They state the Bingham viscosity had a relatively small influence on run-out within geotechnically sensible bounds.
- **Recommendation:** *runYield: keep tuned but cite a range.* 5 kPa sits at the low end of the published fits (5 to 12 kPa), so the ledger can say "tuned; same order as Storegga model fits, Elverhoi et al. 2005 pp. 642-643", nothing stronger (different basin and mud). *runViscosity: keep tuned*, since the same paper says it matters little for run-out; no value was read.

## 10. Debris-flow bulk density (`runDensity` 1800 kg/m3)

- **Used in:** `src/engine/params.ts` key `runDensity`; `src/engine/runout.ts`.
- **Chain:** same as item 9 (Elverhoi 2005 read in full). I searched the text for a bulk-density value and found none.
- **Recommendation:** *keep tuned.* No source found. A bulk density for wet clay slurries can come from porosity and grain density (items 11 and 25) instead of a separate number; that is a design option, not a source.

## 11. Fresh-deposit mud porosity (`mtdPhiMud` 0.55)

- **Used in:** `src/engine/params.ts` key `mtdPhiMud`.
- **Chain (verified):** Archie 1942, Burland 1990, Skempton 1969 (consolidation of clays by gravitational compaction) and Hampton and others 1996 are references of the seed **Dugan 2012**, Marine Geology (W2078879321, DOI 10.1016/j.margeo.2012.05.001; not OA): "Petrophysical and consolidation behavior of mass transport deposits from the northern Gulf of Mexico, IODP Expedition 308". Read: none (no abstract in OpenAlex).
- **Contribution (title only):** measured porosity and consolidation of Gulf mass transport deposits; the nearest published match to the quantity. What porosity it reports is (to verify; not read).
- **Recommendation:** *obtain Dugan 2012 then decide.* Strong candidate: Gulf, deposit type matches.

## 12. Salt viscosity (`saltVisc` 1e17, Gulf preset 1e18 Pa s)

- **Used in:** `src/engine/params.ts` key `saltVisc`; `src/engine/salt.ts`.
- **Chain:** Vendeville and Jackson 1992a (lab-type values p. 333) and Gemmer and others 2004 (Basin Research 16, 199-218; one salt viscosity in their Table 1) feed Wagner and Jackson 2011 (Tectonophysics 510, 309-326) and Gou and Liu 2024 (GJI 239, 621-636). These links are **inferred** (taken from the salt notes, not from OpenAlex data; the four papers are listed in `docs/lineage/salt-viscosity.json` as local entries). The OpenAlex seed is **Hudec and Jackson 2007**, Earth-Sci. Rev. 82, 1-28 (W2032123209, DOI 10.1016/j.earscirev.2007.01.001; not OA); 60 verified edges. Read: **full**, through the salt note `hudec-jackson-2007.md`.
- **Finding:** the ledger cites the range "about 1e17 to 1e19 Pa s" to Hudec and Jackson 2007. The salt note, which records all 28 pages read, says that paper gives no viscosity value ("cannot confirm or reject" 1e18).
- **Published values (salt notes):** Wagner and Jackson 2011 p. 311: 1e12 (minimum, from Ter Heege and others 2005) to 1e20 Pa s from laboratory flow laws, generally 1e17 to 1e20 from field observations. Vendeville and Jackson 1992a p. 333 (citing lab work): about 5e17 Pa s for 5 mm grains at 20 C. Van Keken and others 1993 (abstract only, as quoted in the notes): 1e17 to 1e20 for diapir models. Every source treats viscosity as a model choice.
- **Recommendation:** *adopt the source, not a new number:* change the ledger's citation for the range to Wagner and Jackson 2011 p. 311 (range 1e17 to 1e20). 1e18 (Gulf preset) is inside it; 1e17 (generic default) is at the low end. Both stay `tuned (range cited)`.

## 13. Cover viscosity (`coverVisc` 1e19; Gulf preset 3e20 Pa s)

- **Used in:** `src/engine/params.ts` key `coverVisc`; `src/engine/salt.ts`.
- **Chain:** same local papers and seed as item 12. Read: full, through the salt notes.
- **Published values (salt notes):** Gou and Liu 2024 pp. 624-625, Fig. 3: growth speed is controlled much more by the overburden's viscosity than by the salt's (at overburden 1e19 Pa s a tenfold rise in salt viscosity adds only a few Myr); a stiff roof with a power-law law fails to raise a diapir in 100 Myr unless a plastic yield limit is added (pp. 625-626). Li and Urai 2016 (abstract, as quoted in the notes): long-term rheology "remains controversial". No paper gives a viscosity for a whole sediment cover.
- **Recommendation:** *keep tuned.* The result depends on one tuned number; say so next to the control. There is no cited anchor for the number itself; Gou and Liu support only the sensitivity.

## 14. Salt thickness (`saltThick` 1500 m generic; Gulf preset 4 km)

- **Used in:** `src/engine/params.ts` key `saltThick`; Gulf preset.
- **Chain:** the seed **Hudec, Norton, Jackson and Peel 2013** ("Jurassic evolution of the Gulf of Mexico salt basin", AAPG Bull. 97, 1683-1710; W2134109970, DOI 10.1306/04011312073; not OA). Read: **full**, through the salt note `hudec-etal-2013a.md`. **Data warning:** the OpenAlex reference list for this paper includes unrelated works (Messinian salinity crisis, satellite altimetry), so its 60 kept edges are not trusted. I count this chain as not verified.
- **Published value (salt notes):** original Louann thickness was not obtained; the authors estimate at least 3 to 4 km in the thickest parts, a modelled minimum from salt now in the Sigsbee canopy (p. 1702). Not a basin-wide thickness.
- **Recommendation:** *keep tuned.* The Gulf preset's 4 km sits at the bottom of that bound for the thickest area; the generic 1,500 m is synthetic. This card proposes no change to either and does not suggest adding salt to any run.

## 15. Cover thickness (`coverThick` 200 m generic; 1,000 m Gulf preset)

- **Used in:** `src/engine/params.ts` key `coverThick`.
- **Chain:** same seed and warning as item 14. No paper read gives a basin-wide starting cover for 66 Ma.
- **Recommendation:** *keep tuned*; it is a start-state assumption of the model. Reason to leave it: the Louann salt and its first cover were laid down long before the 66 Ma start, so any number is a model choice.

## 16. Salt thermal conductivity (`saltK0` 6.0, `saltKa` 0.0030, `saltKb` 0.0042)

- **Used in:** `src/engine/params.ts` keys `saltK0`, `saltKa`, `saltKb`; `src/engine/thermal.ts`.
- **Chain (verified):** Horai 1971 (conductivity of rock-forming minerals), Touloukian 1981 (*Physical properties of rocks and minerals*), Woodside and Messmer 1961 part I, and Fecht 1999 are references of the seed **Clauser and Huenges** (AGU Reference Shelf 3, listed in OpenAlex as 2011, DOI 10.1029/RF003p0105; the ledger gives 1995, pp. 105-126; not OA). Read: none.
- **Recommendation:** *obtain Clauser and Huenges 1995 then decide.* It is a compilation; it should give halite at room temperature and a temperature dependence, which are exactly the three numbers (to verify; not read). The same paper serves items 17 and 18.

## 17. Sand grain conductivity and the geometric-mean mixing law

- **Used in:** `src/engine/params.ts` key `kGrain` (sand 7.7 W/m/K); `src/engine/thermal.ts` (bulk k is the geometric mean of grains and water).
- **Chain (verified):** Barrett and others 1951 (pore volume and area distributions), Present 1958, Schaefer 1959 and Blackwell 1956 are references of the seed **Woodside and Messmer 1961 part II** (consolidated rocks), J. Appl. Phys. (W2041559997, DOI 10.1063/1.1728420; not OA); Woodside and Messmer part I (unconsolidated sands) is a verified reference of Clauser and Huenges. Read: none.
- **Recommendation:** *obtain Clauser and Huenges 1995 (quartz about 7.7, water about 0.6 per the ledger) and Woodside and Messmer 1961, then decide.* The geometric mean is a published model but one of several; Midttomme and Roaldset (item 18) discuss how much the choice matters.

## 18. Mud grain conductivity (`kGrain` mud 2.5 W/m/K)

- **Used in:** `src/engine/params.ts` key `kGrain` (mud); the ledger says it was chosen so deep mud gives about 1 F per 100 ft at 40 mW/m2 (tuned in effect).
- **Chain (verified):** Clark 1966 (*Handbook of physical constants*), Johansen 1977 (*Thermal conductivity of soils*), Hashin 1962 and Bechmann 1969 are references of the seed **Midttomme and Roaldset 1999**, Geol. Soc. Spec. Publ. 158 (W1970624446, DOI 10.1144/GSL.SP.1999.158.01.04; not OA). Read: abstract only.
- **Contribution (abstract):** conductivity data for clay-rich rocks are scarce although they make up 70 to 80 % of a basin; in a North Sea Upper Jurassic section two matrix-conductivity estimates under the geometric-mean model differed by 50 degrees C in present-day temperature.
- **Recommendation:** *keep tuned.* The paper supports saying the number is uncertain, not what it is. Because the mud value is tuned against a temperature target, any source value should be adopted together with a re-check of that target.

## 19. Heat flow (`heatFlow` 40 mW/m2)

- **Used in:** `src/engine/params.ts` key `heatFlow`; `src/engine/thermal.ts`.
- **Chain:** the seed **Jones 2003**, M.S. thesis, Texas Tech University (W2145531644; no DOI; not OA). OpenAlex has **no reference list** for it, so no edges. Read: **abstract only**.
- **Published value (abstract):** 55 heat-flow values from 88 wells on the Texas-Louisiana slope (bottom-hole temperatures corrected for drilling, conductivity from logs by the geometric mean law); rapid recent sedimentation suppresses heat flow, isolated salt domes raise it, and the combined data give "a regional background heat flow of around 40 mW/m2". This confirms the ledger's quote.
- **Recommendation:** *keep cited, label "abstract only".* To move it off `to verify`, read the thesis (a university repository copy may exist; none was found by the script). Note the abstract itself says sedimentation rate suppresses surface heat flow, which the engine's constant basal flux does not model.

## 20. Deep seafloor temperature (`tSeaDeep` 4 C)

- **Used in:** `src/engine/params.ts` key `tSeaDeep`.
- **Chain:** the seed tried, **Welsh and Inoue 2000** (Loop Current rings and the deep circulation, JGR; W2055338798, **OA**), is an ocean circulation model and not a source for bottom temperature. Its references include Levitus 1983 (*Climatological atlas of the world ocean*), a plausible lead (verified link, not read). Read: abstract only.
- **Recommendation:** *keep tuned*; no source found. Lead: a hydrographic climatology for the deep Gulf.

## 21. Quartz cement (`cemSurf` 0.7; rate law r = 1.98e-22 x 10^(0.022 T))

- **Used in:** `src/engine/params.ts` key `cemSurf`; `src/engine/cement.ts`.
- **Chain (verified):** Lasaga 1984 (chemical kinetics of water-rock interactions), McKenzie 1978, Bjorlykke 1992 (Brent Group diagenesis) and Walderhaug 1994 (*Temperatures of quartz cementation in Jurassic sandstones*) are among the 10 references of the seed **Walderhaug 1994**, J. Sediment. Res. 64, 324 (W2142688952, DOI 10.2110/jsr.64.324; not OA). Read: abstract only.
- **Published value (abstract):** quartz precipitation rates for 27 Jurassic sandstone samples, 9.8e-21 to 1.9e-18 mol/cm2/s, rising with temperature. **Comparison (my arithmetic):** the engine law gives 6.9e-21 at 70 C (just below that range), 3.1e-20 at 100 C and 2.4e-19 at 140 C (inside it). The abstract also says the surface area was measured in thin section, which is the quantity `cemSurf` stands in for.
- **Recommendation:** *obtain Walderhaug 1994 then decide.* `cemSurf` stays a tuned set-up estimate (synthetic grain size) until the paper's surface-area definition is read.

## 22. Poisson's ratio (`poissonRatio` 0.40) and 23. Stress ratio Ki (`matthewsKellyKi` 0.60)

- **Used in:** `src/engine/wellPressureParams.ts`; `src/engine/wellPressure.ts`.
- **Chain:** OpenAlex has no reference list for **Eaton 1969**, J. Pet. Technol. (W2021328460, DOI 10.2118/2163-PA; not OA), so there are no verified edges. Inferred links (from your notes): Zhang and Yin 2017 restate Eaton's and Matthews and Kelly's methods; Eaton cites Matthews and Kelly 1967 (known only second-hand; not read). Local entries for Traugott 1997 and Zhang and Yin 2017 are in the JSON. Read: **full**, through `docs/pp-notes/eaton1969.md`, `traugott1997.md`, `zhang-yin2017.md`.
- **Published values (pp-notes):**
  - Eaton 1969 Fig. 4 (p. 1356, read from the figure, plus or minus 0.02): Gulf Coast Poisson's ratio rises with depth, for the variable-overburden curve 0.31 / 0.36 / 0.40 / 0.43 / 0.46 / 0.47 / 0.48 / 0.49 / 0.50 at 2 / 4 / 6 / 8 / 10 / 12 / 14 / 16 / 20 thousand ft. So 0.40 is the value near 6,000 ft.
  - Eaton 1969 Fig. 3 (p. 1355, via Matthews and Kelly): Ki rises with depth too; 0.60 matches the Louisiana curve near 6,500 ft read at the normal-pressure equivalent depth.
  - Zhang and Yin 2017 (pdf p. 6): a suggested constant k0 of 0.75 ("most likely") from 229 leak-off tests (nu = 0.43); their depth fit goes the other way, from 0.90 at the mudline to 0.76 at 20,000 ft. The two papers disagree in sign, as the pp-notes record.
  - Traugott 1997 (pdf p. 2): an empirical k that rises with depth below the mudline (0.63 at 3,150 ft of sediment, 0.86 at 10,250 ft by hand calculation in the note).
- **Recommendation:** *adopt as a decision for John, not an automatic change.* Options: (a) keep constant 0.40 and 0.60, relabelled "tuned; mid-depth value, Eaton 1969 Fig. 4 p. 1356", (b) tabulate Eaton's curve as a depth-dependent option, (c) use Zhang and Yin's 0.75 constant. This is the open D21 item; the published sources disagree on the sign of the trend.

## 24. Sea water density (`RHO_W` 1025 kg/m3)

- **Used in:** `src/engine/constants.ts`.
- **Chain (verified):** Bigg 1967 (density of water in SI units) and Millero and others 1980 (high-pressure equation of state) are references of the seed **Millero and Poisson 1981**, Deep-Sea Res. 28A (W2055232078, DOI 10.1016/0198-0149(81)90122-9; not OA). Read: none.
- **Recommendation:** *keep as a typical value.* The pp-literature already notes formation brine is denser than sea water; that matters more than the sea water digit. The equation of state could replace the constant (needs salinity and temperature); low priority.

## 25. Grain density (`RHO_S` 2650 kg/m3)

- **Used in:** `src/engine/constants.ts`.
- **Chain:** the seed found, **Kumari and Mohan 2021** (a general chapter on clay minerals, OA, W3173615624), is not a measurement source. A better lead among its references is Deer and others (*An introduction to the rock-forming minerals*), not read.
- **Recommendation:** *keep as a cited generic value* (quartz). The real Gulf mud mix is somewhat denser; no source found.

---

## Papers to get

Ranked by how many parameters each unlocks, then by cost. "Free" = open access.

1. **Imran, Parker, Locat and Lee 2001**, J. Hydraul. Eng. 127(11), 959-968 (not located in OpenAlex; DOI to find). Unlocks `runYield`, `runViscosity`, `runDensity` (3). Needed before trusting any debris-flow number.
2. **Clauser and Huenges 1995**, AGU Ref. Shelf 3, 105-126. Unlocks salt conductivity (three numbers), sand grain conductivity, and a check on the mixing law (3).
3. **Hampton, Lee and Locat 1996**, Rev. Geophys. 34(1), 33-59. Unlocks `phiFric`, `cohesion` and the thin-slide and gentle-slope search limits (2 to 4).
4. ~~**Yang and Aplin 2010** and **Yang and Aplin 2004**~~ **Read in full (LIN-2, 2026-10-21; John's copies; neither has a free full text online).** Notes: `docs/pp-notes/yang-aplin-2010.md`, `docs/pp-notes/yang-aplin-2004.md`. Mud permeability is ready for the D28.2 re-fit once John decides the clay fraction; unloading stiffness stays tuned (the paper gives no value).
5. **Galloway, Whiteaker and Ganey-Curry 2011** (free). Unlocks sediment supply, and helps with accommodation context for subsidence (1 to 2).
6. **Dugan 2012**, Mar. Geol. Unlocks `mtdPhiMud` (1), and possibly the strength of mass transport deposits.
7. **Woodside and Messmer 1961**, J. Appl. Phys. Mixing law (1).
8. **Walderhaug 1994**, **Ehrenberg and Nadeau 2005**, **Midttomme and Roaldset 1999**, **Jones 2003 thesis**: one parameter each.
9. **Not found yet:** a Gulf subsidence paper; a deep-Gulf temperature climatology; Kaufman 1991 (diffusion form).

## Summary table

| Parameter | Status now | Recommended status | Source (read level) |
|---|---|---|---|
| Sand permeability | tuned | obtain, then decide | Ehrenberg and Nadeau 2005 (abstract) |
| Mud permeability | tuned | adopt in D28.2 after John decides the clay fraction | Yang and Aplin 2010 eq. 4, p. 1695 (full) |
| Unloading stiffness | tuned | keep tuned; qualitatively consistent | Yang and Aplin 2004 pp. 153, 159 (full; no value) |
| Diffusivities | tuned | keep tuned | Rivenaes 1992 (abstract) |
| Sediment supply | tuned | keep, cite range, read Table 1 | Galloway and others 2011, OA (partial) |
| Subsidence | tuned | keep tuned | none found |
| Friction angle | to verify | obtain, then decide | Hampton and others 1996 (abstract) |
| Cohesion | to verify | obtain, then decide | Hampton and others 1996 (abstract) |
| Bingham yield | tuned | keep tuned, cite 5-12 kPa range | Elverhoi and others 2005 pp. 642-643 (full) |
| Bingham viscosity | tuned | keep tuned | Elverhoi and others 2005 (full): small effect |
| Run-out density | tuned | keep tuned | none found |
| Fresh mud porosity | tuned | obtain, then decide | Dugan 2012 (not read) |
| Salt viscosity | tuned (range cited) | fix citation to Wagner and Jackson 2011 p. 311 | salt notes (full) |
| Cover viscosity | tuned | keep tuned | Gou and Liu 2024 pp. 624-625 (sensitivity only) |
| Salt thickness | tuned | keep tuned; bound 3 to 4 km thickest | Hudec and others 2013 p. 1702 (salt notes) |
| Cover thickness | tuned | keep tuned | none found |
| Salt conductivity | to verify | obtain, then decide | Clauser and Huenges 1995 (not read) |
| Sand grain conductivity, mixing law | to verify | obtain, then decide | Clauser and Huenges; Woodside and Messmer (not read) |
| Mud grain conductivity | tuned | keep tuned | Midttomme and Roaldset 1999 (abstract) |
| Heat flow | cited, to verify | keep cited, abstract only | Jones 2003 (abstract) |
| Deep seafloor temperature | tuned | keep tuned | none found |
| Quartz-cement rate and surface | to verify | obtain, then decide | Walderhaug 1994 (abstract) |
| Poisson's ratio | tuned | John decides (options a to c) | Eaton 1969 p. 1356; Zhang and Yin 2017 (full, notes) |
| Stress ratio Ki | tuned | John decides | Eaton 1969 p. 1355; Zhang and Yin 2017 (full, notes) |
| Sea water density | to verify | keep as typical value | Millero and Poisson 1981 (not read) |
| Grain density | to verify | keep as cited generic | none useful |

## Method and limits

- **What a verified link means.** The citing paper's OpenAlex reference list contains the cited paper. That is a reference relationship. It does **not** show the cited paper supplied a number, equation or page, and it says nothing about whether the citing paper agrees with it.
- **What an inferred link means.** I believe the dependence (usually from your deep-read notes) but OpenAlex does not show it. Inferred links are written as such in every JSON.
- **Coverage is thin where this project needs it.** OpenAlex reference lists are often missing or partial for pre-1990 work, theses, conference papers and trade journals (Eaton 1969 and Jones 2003 have none; Traugott 1997 and Matthews and Kelly 1967 are absent). Some lists are wrong: the list for Hudec and others 2013 includes unrelated papers.
- **Truncation.** Each seed keeps at most its 60 most cited references; the five walked ancestors keep 15 each. Citation counts favour old, general texts, so the "top" references are often textbooks.
- **Abstracts.** OpenAlex gives abstracts, not papers. Every value in this file is marked by what was read. Abstracts are paraphrased; the abstract equation in item 2 is a formula, reproduced for checking.
- **Search quota.** The OpenAlex daily search allowance ran out near the end of the work, so a few searches (the Imran J. Hydraul. Eng. paper, Kaufman 1991, Traugott's and Matthews and Kelly's OpenAlex records) were not completed or not run. The script caches responses, so a rerun costs no requests for anything already fetched.
- **Reproduce one trace.** `node scripts/lineage/openalex-trace.mjs --param perm-mud --query "mudstone permeability porosity relationship" --seed W1995654536`. Optional environment variables: `OPENALEX_MAILTO` (polite pool) and `LINEAGE_CACHE_DIR`.

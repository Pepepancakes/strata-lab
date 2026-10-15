// Reference list for the parameter registry. Mirrors docs/physics-references.md.
// Papers themselves are never stored in git (git-ignored References/ folder).
// If you add a source to the docs, add it here with a stable id; params.ts refers to these ids.

export interface Reference {
  id: string
  /** Short form for a tooltip next to a control, e.g. "Sclater & Christie (1980)". */
  short: string
  /** Full citation. */
  full: string
  /** True when the docs say the details have not been checked against the paper. */
  toVerify?: boolean
  /** Bundled data set behind this reference, when the app ships one. */
  dataset?: {
    doi: string
    archiveUrl: string
    licence: string
    accessed: string
    column: string
    file: string
  }
}

export const REFERENCES: readonly Reference[] = [
  {
    id: 'gibson-1958',
    short: 'Gibson (1958)',
    full: 'Gibson, R.E. (1958). The progress of consolidation in a clay layer increasing in thickness with time. Geotechnique 8(4), 171-182.',
  },
  {
    id: 'sclater-christie-1980',
    short: 'Sclater & Christie (1980)',
    full: 'Sclater, J.G. & Christie, P.A.F. (1980). Continental stretching: an explanation of the post-mid-Cretaceous subsidence of the central North Sea Basin. JGR 85(B7), 3711-3739.',
  },
  {
    id: 'athy-1930',
    short: 'Athy (1930)',
    full: 'Athy, L.F. (1930). Density, porosity, and compaction of sedimentary rocks. AAPG Bull. 14, 1-24.',
  },
  {
    id: 'turcotte-schubert',
    short: 'Turcotte & Schubert, Geodynamics',
    full: 'Turcotte, D.L. & Schubert, G. Geodynamics (channel-flow chapter). Viscous channel (Poiseuille/Couette) flow.',
  },
  {
    id: 'kaufman-1991',
    short: 'Kaufman et al. (1991)',
    full: 'Kaufman, P., Grotzinger, J.P. & McCormick, D.S. (1991). Depth-dependent diffusion algorithm for simulation of sedimentation in shallow marine depositional systems. Kansas Geol. Survey Bull. 233.',
  },
  {
    id: 'rivenaes-1992',
    short: 'Rivenaes (1992)',
    full: 'Rivenaes, J.C. (1992). Application of a dual-lithology, depth-dependent diffusion equation in stratigraphic simulation. Basin Research 4, 133-146.',
  },
  {
    id: 'yang-aplin-2010',
    short: 'Yang & Aplin (2010)',
    full: 'Yang, Y. & Aplin, A.C. (2010). A permeability-porosity relationship for mudstones. Mar. Pet. Geol. 27, 1692-1697.',
  },
  {
    id: 'mckenzie-1978',
    short: 'McKenzie (1978)',
    full: 'McKenzie, D. (1978). Some remarks on the development of sedimentary basins. Earth Planet. Sci. Lett. 40, 25-32.',
  },
  {
    id: 'walderhaug-1994',
    short: 'Walderhaug (1994)',
    full: 'Walderhaug, O. (1994). Precipitation rates for quartz cement in sandstones determined by fluid-inclusion microthermometry and temperature-history modeling. J. Sediment. Res. A64(2), 324-333. Rate r = 1.98e-22 x 10^(0.022 T) mol/cm2/s, T in deg C (as quoted in Walderhaug\'s discussion of Osborne & Haszeldine 1993, Mar. Pet. Geol.).',
  },
  {
    id: 'walderhaug-1996',
    short: 'Walderhaug (1996)',
    full: 'Walderhaug, O. (1996). Kinetic modeling of quartz cementation and porosity loss in deeply buried sandstone reservoirs. AAPG Bull. 80(5), 731-745.',
  },
  {
    id: 'jones-2003-gom-heatflow',
    short: 'Jones (2003)',
    full: 'Jones, M. (2003). The regional geothermal heat flow regime of the north-central Gulf of Mexico continental slope. M.S. thesis, Texas Tech University (abstract: regional background heat flow of about 40 mW/m2). See also Nagihara, S. & Smith, M.A. (2008), Regional overview of deep sedimentary thermal gradients of the geopressured zone of the Texas-Louisiana continental shelf, AAPG Bull. (Gulf heat flow from <20 to ~100 mW/m2).',
    toVerify: true,
  },
  {
    id: 'woodside-messmer-1961',
    short: 'Woodside & Messmer (1961)',
    full: 'Woodside, W. & Messmer, J.H. (1961). Thermal conductivity of porous media. J. Appl. Phys. 32, 1688-1706 (geometric-mean mixing of grain and pore-fluid conductivity).',
    toVerify: true,
  },
  {
    id: 'clauser-huenges-1995',
    short: 'Clauser & Huenges (1995)',
    full: 'Clauser, C. & Huenges, E. (1995). Thermal conductivity of rocks and minerals. In: Rock Physics and Phase Relations, AGU Ref. Shelf 3, 105-126 (quartz about 7.7 W/m/K, water about 0.6 W/m/K).',
    toVerify: true,
  },
  {
    id: 'miller-2005',
    short: 'Miller et al. (2005)',
    full: 'Miller, K.G. et al. (2005). The Phanerozoic record of global sea-level change. Science 310, 1293-1298.',
  },
  {
    id: 'bintanja-van-de-wal-2008',
    short: 'Bintanja & van de Wal (2008)',
    full: 'Bintanja, R. & van de Wal, R.S.W. (2008). North American ice-sheet dynamics and the onset of 100,000-year glacial cycles. Nature 454, 869-872. doi:10.1038/nature07158. Data: Bintanja & van de Wal (2011), NOAA/WDS Paleoclimatology, Global 3Ma Temperature, Sea Level, and Ice Volume Reconstructions.',
    dataset: {
      doi: '10.25921/revb-da37',
      archiveUrl: 'https://www.ncei.noaa.gov/pub/data/paleo/contributions_by_author/bintanja2008/bintanja2008.txt',
      licence: 'CC0 1.0 (NOAA NCEI metadata)',
      accessed: '2026-10-14',
      column: 'Column 9, sign reversed (the file labels it sea level but it is ice volume as sea-level equivalent)',
      file: 'src/engine/data/sealevel-bintanja2008.json',
    },
  },
  {
    id: 'miller-2020',
    short: 'Miller et al. (2020)',
    full: 'Miller, K.G., Browning, J.V., Schmelz, W.J., Kopp, R.E., Mountain, G.S. & Wright, J.D. (2020). Cenozoic sea-level and cryospheric evolution from deep-sea geochemical and continental margin records. Science Advances 6(20), eaaz1346. doi:10.1126/sciadv.aaz1346. Data: PANGAEA doi:10.1594/PANGAEA.923139.',
    dataset: {
      doi: '10.1594/PANGAEA.923139',
      archiveUrl: 'https://doi.pangaea.de/10.1594/PANGAEA.923139',
      licence: 'CC-BY 4.0 (PANGAEA data set)',
      accessed: '2026-10-14',
      column: 'Sea lev rel [m], smoothed Cenozoic sea level relative to present',
      file: 'src/engine/data/sealevel-miller2020.json',
    },
  },
  {
    id: 'spratt-lisiecki-2016',
    short: 'Spratt & Lisiecki (2016)',
    full: 'Spratt, R.M. & Lisiecki, L.E. (2016). A Late Pleistocene sea level stack. Clim. Past 12, 1079-1092.',
  },
  {
    id: 'hampton-1996',
    short: 'Hampton et al. (1996)',
    full: 'Hampton, M.A., Lee, H.J. & Locat, J. (1996). Submarine landslides. Rev. Geophys. 34(1), 33-59.',
  },
  {
    id: 'imran-2001',
    short: 'Imran et al. (2001)',
    full: 'Imran, J., Parker, G., Locat, J. & Lee, H. (2001). 1D numerical model of muddy subaqueous and subaerial debris flows. J. Hydraul. Eng. 127(11), 959-968.',
    toVerify: true,
  },
  {
    id: 'hudec-jackson-2007',
    short: 'Hudec & Jackson (2007)',
    full: 'Hudec, M.R. & Jackson, M.P.A. (2007). Terra infirma: understanding salt tectonics. Earth-Sci. Rev. 82, 1-28.',
  },
  {
    id: 'gemmer-2004',
    short: 'Gemmer et al. (2004)',
    full: 'Gemmer, L. et al. (2004). Salt tectonics driven by differential sediment loading. Basin Research 16.',
    toVerify: true,
  },
  {
    id: 'ge-1997',
    short: 'Ge et al. (1997)',
    full: 'Ge, H., Jackson, M.P.A. & Vendeville, B.C. (1997). Kinematics and dynamics of salt tectonics driven by progradation. AAPG Bull. 81(3).',
    toVerify: true,
  },
  {
    id: 'eaton-1969',
    short: 'Eaton (1969)',
    full: 'Eaton, B.A. (1969). Fracture gradient prediction and its application in oilfield operations. JPT 21(10).',
  },
  {
    id: 'matthews-kelly-1967',
    short: 'Matthews & Kelly (1967)',
    full: 'Matthews, W.R. & Kelly, J. (1967). How to predict formation pressure and fracture gradient. Oil & Gas J.',
  },
]

const BY_ID = new Map(REFERENCES.map((r) => [r.id, r]))

export function getReference(id: string): Reference | undefined {
  return BY_ID.get(id)
}

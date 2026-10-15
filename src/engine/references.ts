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
    id: 'miller-2005',
    short: 'Miller et al. (2005)',
    full: 'Miller, K.G. et al. (2005). The Phanerozoic record of global sea-level change. Science 310, 1293-1298.',
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

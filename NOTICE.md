# Notices: third-party data and code

Strata Lab's own code is under the MIT licence (`LICENSE`). The items below are by others and keep
their own licences. If you redistribute Strata Lab, or a build of it, keep this file with it.

## Bundled data

Both files were fetched once at development time by `scripts/fetch-sealevel.mjs` (accessed
2026-10-14). The app never downloads anything. Full details: `docs/physics-references.md`,
"Sea-level data".

### Bintanja & van de Wal (2008) sea level, 0 to 3 Ma
- File: `src/engine/data/sealevel-bintanja2008.json`
- Source: Bintanja, R. & van de Wal, R.S.W. (2008). North American ice-sheet dynamics and the
  onset of 100,000-year glacial cycles. *Nature* 454, 869–872. doi:10.1038/nature07158
- Archive: NOAA NCEI / WDS Paleoclimatology, doi:10.25921/revb-da37
- Licence: CC0 1.0 (public domain dedication), per the NOAA metadata record. Please cite the paper.
- Changes: column 9 only, sign reversed (ice volume as sea-level equivalent to sea level), every
  3rd row of the 100-year series kept, converted to JSON.

### Miller et al. (2020) Cenozoic sea level, about 1 to 65 Ma
- File: `src/engine/data/sealevel-miller2020.json`
- Source: Miller, K.G., Browning, J.V., Schmelz, W.J., Kopp, R.E., Mountain, G.S. & Wright, J.D.
  (2020). Cenozoic sea-level and cryospheric evolution from deep-sea geochemical and continental
  margin records. *Science Advances* 6(20), eaaz1346. doi:10.1126/sciadv.aaz1346
- Data set: PANGAEA, "Smoothed Cenozoic sea-level relative to modern from deep-sea geochemical
  and continental margin records", doi:10.1594/PANGAEA.923139
- Licence: Creative Commons Attribution 4.0 International (CC BY 4.0),
  https://creativecommons.org/licenses/by/4.0/
- Changes: the smoothed sea-level column only, ages converted from ka to years, converted to JSON.
  All rows kept.

## Code in the built file

`npm run build` inlines these runtime libraries into `dist/strata-lab.html`:

- React and React DOM (MIT licence), Copyright (c) Meta Platforms, Inc. and affiliates.
  https://github.com/facebook/react/blob/main/LICENSE
- scheduler (MIT licence), Copyright (c) Meta Platforms, Inc. and affiliates.

Development tools (Vite, Vitest, TypeScript, ESLint and their dependencies) are not shipped in the
built file. They are under permissive licences (MIT, Apache-2.0, BSD, ISC and similar); the full
list as of the M1 review is in `docs/reviews/m1-review-results.json`.

## Papers

Copyrighted papers and figures used while building the model are kept out of the repository
(`References/` is git-ignored). `docs/physics-references.md` cites each one.

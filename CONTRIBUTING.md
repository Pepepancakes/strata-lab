# Contributing

Strata Lab is a personal project, shared so others can try it, learn from it and build on it.
Issues and pull requests are welcome; replies may be slow.

## Issues

Useful reports include:
- what you did (preset, the controls you changed, or the `*.strata.json` scenario file from **Save**);
- what you expected and what you saw (a screenshot helps);
- your browser and operating system, and your display scaling if the layout looks wrong.

Geology and physics critiques are especially welcome: a wrong equation, a parameter outside its
published range, or a result that contradicts a published example. Please cite the source.

## Pull requests

Read [`docs/agent-guide.md`](docs/agent-guide.md) first. It is written for AI agents and people
alike, and its principles are firm:

- **Physics honesty.** A new process comes with a benchmark test (an exact solution or a hand
  calculation) and a mass-balance test per grain size, before it reaches the UI.
- **Every parameter cited or labelled tuned** in `src/engine/params.ts` and
  `docs/physics-references.md`. `tests/docs.test.ts` fails if they drift apart.
- **Deterministic engine.** No `Math.random`, clock reads or unordered iteration in `src/engine/`
  (lint enforces it).
- **Offline.** No runtime network requests; `npm run check:offline` must pass on the build.
- **Data.** Synthetic, or published with a full citation and a licence that allows redistribution.
  Never company, well, lease or seismic data, and never copyrighted papers or figures.
- **Permissive licences only** for dependencies (MIT, Apache-2.0, BSD, ISC).

Before opening a pull request, run:

```sh
npm run check
npm run build
npm run check:offline
```

Use conventional commit messages (`feat(engine): ...`, `fix(section): ...`, `docs: ...`). If you
change a control's label, update `docs/user-guide.md` in the same pull request.

By contributing you agree that your contribution is licensed under the MIT licence of this
project (`LICENSE`).

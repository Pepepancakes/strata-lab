# Strata Lab

Agent and developer context lives in **docs/agent-guide.md**. Read it first; it is the source of truth for principles, stack, commands, glossary and working rules. Background: PROJECT.md. Plan: docs/roadmap.md. Decisions: docs/decisions.md. Physics sources: docs/physics-references.md.

If you are picking this project up on a new machine, or without the Hermes kanban board, read **docs/handover.md** next.

Non-negotiables, in short:
- Physics honesty: mass conserved (per grain size), every solver benchmarked against an exact solution or hand calculation, every parameter cited or labelled "tuned".
- Deterministic engine: same inputs give bit-identical results (rewind depends on it).
- One stratigraphic record, many views.
- Synthetic data, or published examples with a citation. Never company or confidential data. The repo is public: never commit secrets, local paths or personal data.
- No runtime network requests; works offline from a single file. Permissive licences only.
- Agents never push, merge to main, or deploy.

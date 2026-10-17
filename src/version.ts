// Versions written into scenario files (src/app/scenarioFile.ts).
//
// APP_VERSION follows package.json. ENGINE_VERSION is a whole number that is raised BY HAND
// whenever a change to src/engine alters results (the golden files in tests/golden then change
// too). A scenario file records both; opening a file whose stored hashes do not match the
// recomputed ones is what actually warns John, these numbers only explain why.
export const APP_VERSION = '0.1.0'
export const ENGINE_VERSION = 2

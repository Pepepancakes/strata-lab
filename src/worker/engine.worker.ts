// Worker entry. Loaded as a normal module worker by `vite dev`; the one-file build inlines it
// (see vite.config.ts). Keep this file thin: logic goes in handler.ts.
// Typed arrays in answers are TRANSFERRED (moved, not copied): see transferListOf.
import { handleRequest } from './handler'
import { transferListOf, type EngineRequest, type EngineResponse } from './protocol'

const send = (r: EngineResponse) => self.postMessage(r, transferListOf(r))

self.onmessage = (e: MessageEvent<EngineRequest>) => {
  send(handleRequest(e.data, send))
}

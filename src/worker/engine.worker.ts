// Worker entry. Loaded as a normal module worker by `vite dev`; the one-file build inlines it
// (see vite.config.ts). Keep this file thin: logic goes in handler.ts.
import { handleRequest } from './handler'
import type { EngineRequest } from './protocol'

self.onmessage = (e: MessageEvent<EngineRequest>) => {
  self.postMessage(handleRequest(e.data))
}

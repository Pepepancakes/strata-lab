// Pure request -> response function. The worker entry only wires it to postMessage,
// so it can be unit-tested without a worker.
import { sumFloat64 } from '../engine/sum'
import type { EngineRequest, EngineResponse } from './protocol'

export function handleRequest(req: EngineRequest): EngineResponse {
  switch (req.kind) {
    case 'ping':
      return { id: req.id, kind: 'pong', payload: req.payload }
    case 'sum':
      return { id: req.id, kind: 'sum', total: sumFloat64(req.values) }
    default:
      return { id: (req as { id: number }).id, kind: 'error', message: 'unknown request kind' }
  }
}

// Message protocol between the app and the engine worker. Plain data only (structured clone).
// Later cards add request kinds here (init, step, snapshot, ...).
export type EngineRequest =
  | { id: number; kind: 'ping'; payload: string }
  | { id: number; kind: 'sum'; values: Float64Array }

export type EngineResponse =
  | { id: number; kind: 'pong'; payload: string }
  | { id: number; kind: 'sum'; total: number }
  | { id: number; kind: 'error'; message: string }

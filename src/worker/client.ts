// App-side handle on the engine worker: request/response matched by id.
import EngineWorker from './engine.worker?worker'
import type { EngineRequest, EngineResponse } from './protocol'

type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never

export class EngineClient {
  private worker: Worker
  private nextId = 1
  private pending = new Map<number, { resolve: (r: EngineResponse) => void; reject: (e: Error) => void }>()

  constructor(worker: Worker = new EngineWorker()) {
    this.worker = worker
    this.worker.onmessage = (e: MessageEvent<EngineResponse>) => {
      const p = this.pending.get(e.data.id)
      this.pending.delete(e.data.id)
      p?.resolve(e.data)
    }
    this.worker.onerror = (ev) => {
      for (const p of this.pending.values()) p.reject(new Error(ev.message || 'engine worker error'))
      this.pending.clear()
    }
  }

  request(req: WithoutId<EngineRequest>): Promise<EngineResponse> {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.worker.postMessage({ ...req, id })
    })
  }

  terminate(): void {
    this.worker.terminate()
  }
}

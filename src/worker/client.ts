// App-side handle on the engine worker: request/response matched by id.
// Progress messages (kind 'progress') belong to a request that is still running; they go to the
// onProgress callback and do not settle the promise.
import EngineWorker from './engine.worker?worker'
import type { EngineRequest, EngineResponse } from './protocol'

type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never
export type ProgressMessage = Extract<EngineResponse, { kind: 'progress' }>

interface Pending {
  resolve: (r: EngineResponse) => void
  reject: (e: Error) => void
  onProgress?: (p: ProgressMessage) => void
}

export class EngineClient {
  private worker: Worker
  private nextId = 1
  private pending = new Map<number, Pending>()

  constructor(worker: Worker = new EngineWorker()) {
    this.worker = worker
    this.worker.onmessage = (e: MessageEvent<EngineResponse>) => {
      const p = this.pending.get(e.data.id)
      if (e.data.kind === 'progress') {
        p?.onProgress?.(e.data)
        return
      }
      this.pending.delete(e.data.id)
      p?.resolve(e.data)
    }
    this.worker.onerror = (ev) => {
      for (const p of this.pending.values()) p.reject(new Error(ev.message || 'engine worker error'))
      this.pending.clear()
    }
  }

  request(req: WithoutId<EngineRequest>, onProgress?: (p: ProgressMessage) => void): Promise<EngineResponse> {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress })
      this.worker.postMessage({ ...req, id })
    })
  }

  terminate(): void {
    this.worker.terminate()
  }
}

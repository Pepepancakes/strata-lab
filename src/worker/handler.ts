// Request -> response logic of the engine worker. The worker entry only wires it to postMessage,
// so it can be unit-tested without a worker.
//
// EngineHost keeps the time machine (the one working engine and the saved states of every branch).
// It handles one request at a time; a long request (run, branch) reports progress through `emit`
// while it runs. Failures come back as { kind: 'error', message } in plain language.
import { sumFloat64 } from '../engine/sum'
import { runChecks } from './checks'
import type { EngineRequest, EngineResponse } from './protocol'
import { replayScenario } from './scenarioReplay'
import { TimeMachine } from './timeMachine'

/** Millisecond clock for reporting (worker code, not engine code). */
const now = (): number => performance.now()

export class EngineHost {
  private tm = new TimeMachine()
  private hasRun = false

  constructor(private emit: (r: EngineResponse) => void = () => {}) {}

  setEmitter(emit: (r: EngineResponse) => void): void {
    this.emit = emit
  }

  handle(req: EngineRequest): EngineResponse {
    const id = (req as { id: number }).id
    try {
      return this.dispatch(req)
    } catch (e) {
      return { id, kind: 'error', message: e instanceof Error ? e.message : String(e) }
    }
  }

  private needRun(): void {
    if (!this.hasRun) throw new Error('Nothing has been run yet. Start a run first.')
  }

  private dispatch(req: EngineRequest): EngineResponse {
    const id = req.id
    const progress = (branchId: string, step: number, nSteps: number) => this.emit({ id, kind: 'progress', branchId, step, nSteps })
    switch (req.kind) {
      case 'ping':
        return { id, kind: 'pong', payload: req.payload }
      case 'sum':
        return { id, kind: 'sum', total: sumFloat64(req.values) }
      case 'run': {
        const t0 = now()
        this.hasRun = false
        const info = this.tm.run(req.spec, req.seed, progress)
        this.hasRun = true
        return { id, kind: 'runDone', info, branches: this.tm.list(), ms: now() - t0 }
      }
      case 'seek': {
        this.needRun()
        const t0 = now()
        const view = this.tm.seek(req.branchId, req.step, req.fields, req.withHash)
        return { id, kind: 'view', view, ms: now() - t0 }
      }
      case 'branch': {
        this.needRun()
        const t0 = now()
        const branch = this.tm.branch(req.parentId, req.step, req.edits, req.label, progress)
        return { id, kind: 'branched', branch, branches: this.tm.list(), ms: now() - t0 }
      }
      case 'deleteBranch': {
        this.needRun()
        const { freedBytes } = this.tm.deleteBranch(req.branchId)
        return { id, kind: 'deleted', branchId: req.branchId, freedBytes, branches: this.tm.list() }
      }
      case 'compare': {
        this.needRun()
        const t0 = now()
        const { a, b, diff } = this.tm.compare(req.a, req.b, req.step, req.fields)
        return { id, kind: 'compared', a, b, diff, ms: now() - t0 }
      }
      case 'branches':
        this.needRun()
        return { id, kind: 'branchList', branches: this.tm.list(), liveBytes: this.tm.liveBytes() }
      case 'runChecks': {
        const t0 = now()
        const results = runChecks()
        return { id, kind: 'checks', results, allPass: results.every((r) => r.pass), ms: now() - t0 }
      }
      case 'well': {
        this.needRun()
        const t0 = now()
        return { id, kind: 'wellColumn', well: this.tm.wellColumn(req.branchId, req.step, req.column), ms: now() - t0 }
      }
      case 'sampleWell': {
        this.needRun()
        const t0 = now()
        return { id, kind: 'wellSamples', samples: this.tm.sampleWell(req.branchId, req.step, req.well), ms: now() - t0 }
      }
      case 'series': {
        this.needRun()
        const t0 = now()
        return { id, kind: 'seriesData', series: this.tm.series(req.branchId), ms: now() - t0 }
      }
      case 'events': {
        this.needRun()
        const t0 = now()
        return { id, kind: 'eventList', branchId: req.branchId, events: this.tm.eventsAt(req.branchId, this.tm.nSteps), ms: now() - t0 }
      }
      case 'hashes': {
        this.needRun()
        const t0 = now()
        return { id, kind: 'hashList', hashes: this.tm.hashes(), summaries: this.tm.summaries(), ms: now() - t0 }
      }
      case 'openScenario': {
        const t0 = now()
        this.hasRun = false
        const r = replayScenario(this.tm, req.file, progress)
        this.hasRun = true
        return { id, kind: 'scenarioOpened', info: r.info, branches: r.branches, idMap: r.idMap, hashes: r.hashes, summaries: r.summaries, ms: now() - t0 }
      }
      default:
        return { id: (req as { id: number }).id, kind: 'error', message: 'unknown request kind' }
    }
  }
}

// One shared host, so callers of handleRequest (and the worker entry) keep one time machine.
const shared = new EngineHost()

export function handleRequest(req: EngineRequest, emit?: (r: EngineResponse) => void): EngineResponse {
  if (emit) shared.setEmitter(emit)
  return shared.handle(req)
}

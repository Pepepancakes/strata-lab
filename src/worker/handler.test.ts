import { describe, it, expect } from 'vitest'
import { handleRequest } from './handler'
import { sumFloat64 } from '../engine/sum'
import { EngineClient } from './client'
import type { EngineRequest } from './protocol'

describe('worker protocol', () => {
  it('echoes ping', () => {
    expect(handleRequest({ id: 7, kind: 'ping', payload: 'hi' })).toEqual({ id: 7, kind: 'pong', payload: 'hi' })
  })
  it('sums a Float64Array', () => {
    expect(handleRequest({ id: 1, kind: 'sum', values: new Float64Array([1, 2, 3.5]) })).toEqual({ id: 1, kind: 'sum', total: 6.5 })
    expect(sumFloat64(new Float64Array(0))).toBe(0)
  })
  it('answers unknown kinds with an error and keeps the id', () => {
    const r = handleRequest({ id: 9, kind: 'nope' } as unknown as EngineRequest)
    expect(r).toMatchObject({ id: 9, kind: 'error' })
  })
  it('client matches responses to requests by id', async () => {
    const fake = {
      onmessage: null as ((e: MessageEvent) => void) | null,
      onerror: null,
      postMessage(m: EngineRequest) {
        setTimeout(() => this.onmessage?.({ data: handleRequest(m) } as MessageEvent), 0)
      },
      terminate() {},
    }
    const c = new EngineClient(fake as unknown as Worker)
    const [a, b] = await Promise.all([
      c.request({ kind: 'ping', payload: 'a' }),
      c.request({ kind: 'sum', values: new Float64Array([4, 5]) }),
    ])
    expect(a).toMatchObject({ kind: 'pong', payload: 'a' })
    expect(b).toMatchObject({ kind: 'sum', total: 9 })
  })
})

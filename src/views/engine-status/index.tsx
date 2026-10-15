import { useEffect, useState } from 'react'
import { EngineClient } from '../../worker/client'
import type { ViewDefinition } from '../types'

function EngineStatus() {
  const [status, setStatus] = useState('checking...')
  useEffect(() => {
    const client = new EngineClient()
    const values = new Float64Array([1, 2, 3.5])
    client
      .request({ kind: 'ping', payload: 'strata' })
      .then((p) =>
        p.kind === 'pong' && p.payload === 'strata' ? client.request({ kind: 'sum', values }) : Promise.reject(new Error('bad ping')),
      )
      .then((s) => setStatus(s.kind === 'sum' && s.total === 6.5 ? 'OK' : 'FAILED (wrong sum)'))
      .catch((e: Error) => setStatus(`FAILED (${e.message})`))
    return () => client.terminate()
  }, [])
  return <p data-testid="engine-status">Engine worker: {status}</p>
}

const view: ViewDefinition = { id: 'engine-status', title: 'Engine', region: 'controls', order: 0, component: EngineStatus }
export default view

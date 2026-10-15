import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { EngineClient } from './worker/client'
import './app/styles.css'

// Handle for scripts/perf-built.mjs, which times the built file in headless Chrome. It only
// exposes the existing worker client; nothing here reaches the network.
;(window as unknown as { __strata: { EngineClient: typeof EngineClient } }).__strata = { EngineClient }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

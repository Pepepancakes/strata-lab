import { useRef } from 'react'
import { store, useAppState } from '../../app/store'
import type { ViewDefinition } from '../types'

function FileView() {
  const s = useAppState()
  const input = useRef<HTMLInputElement>(null)
  const busy = !!s.busy
  const onPicked = async (f: File | undefined) => {
    if (!f) return
    // read the text here; the store checks it and leaves the current work alone if it is no good
    let text: string
    try {
      text = await f.text()
    } catch {
      store.fail('That file could not be read.')
      return
    }
    await store.openText(text)
  }
  return (
    <div className="filebar">
      <div className="row">
        <button disabled={busy} onClick={() => store.requestNew()}>New</button>
        <button disabled={busy} onClick={() => store.requestOpen(() => input.current?.click())}>Open{'\u2026'}</button>
        <button disabled={busy || !s.info} onClick={() => void store.saveFile()}>Save</button>
        <button disabled={busy} onClick={() => store.requestReset()} title="Controls back to the preset's values">Reset</button>
        <input
          ref={input} type="file" accept=".json,.strata.json,application/json" hidden data-testid="open-file"
          aria-label="Open a scenario file"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = '' // the same file can be chosen again
            void onPicked(f)
          }}
        />
      </div>
      <div className="muted small" data-testid="save-state">
        {s.dirty ? 'Changes not saved to a file (kept in this browser).' : 'Nothing unsaved.'}
        {s.autosaveProblem ? <span className="fail"> {s.autosaveProblem}</span> : null}
      </div>
    </div>
  )
}

const def: ViewDefinition = { id: 'file', title: 'Scenario file', region: 'controls', order: -1, component: FileView }
export default def

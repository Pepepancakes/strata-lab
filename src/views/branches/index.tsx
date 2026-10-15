import { store, useAppState } from '../../app/store'
import type { ViewDefinition } from '../types'

function BranchesView() {
  const s = useAppState()
  const busy = !!s.busy
  const mb = (b: number) => `${(b / 1e6).toFixed(1)} MB`
  return (
    <div>
      <h2>Branches</h2>
      <button disabled={busy || !s.info} onClick={() => void store.branchHere()}>Branch from here</button>
      <span className="muted small"> at step {s.step}</span>
      <ul className="branches">
        {s.branches.map((b) => {
          const root = !b.parentId
          return (
            <li key={b.id} className={b.id === s.activeId ? 'active' : ''}>
              <label>
                <input type="radio" name="active" checked={b.id === s.activeId} disabled={busy} onChange={() => store.setActive(b.id)} />
                {root ? 'Main run' : b.label}
              </label>
              <div className="muted small">
                {Object.keys(b.edits).length ? `edits: ${Object.keys(b.edits).join(', ')}; ` : ''}own {mb(b.ownBytes)}
              </div>
              <div className="row">
                {b.id !== s.activeId ? (
                  <label className="small">
                    <input type="checkbox" checked={s.compareId === b.id} disabled={busy} onChange={(e) => store.setCompare(e.target.checked ? b.id : null)} /> compare with active
                  </label>
                ) : null}
                {!root ? <button disabled={busy} onClick={() => void store.deleteBranch(b.id)} aria-label={`Delete ${b.label}`}>Delete</button> : null}
              </div>
            </li>
          )
        })}
      </ul>
      <p className="muted small">At most {s.info?.maxBranches ?? 8} branches. Edit a control while a branch is active to change only that branch.</p>
    </div>
  )
}

const def: ViewDefinition = { id: 'branches', title: 'Branches', region: 'right', order: 0, component: BranchesView }
export default def

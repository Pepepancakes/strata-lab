import { useAppState } from '../../app/store'
import type { ViewDefinition } from '../types'

function SpeedView() {
  const s = useAppState()
  const ms = (v: number) => (v > 0 ? `${Math.round(v)} ms` : '\u2014')
  return (
    <div>
      <h2>Speed</h2>
      <table className="num">
        <tbody>
          <tr><th scope="row">Run time</th><td data-testid="run-ms">{ms(s.perf.runMs)}</td></tr>
          <tr><th scope="row">Last jump (worker)</th><td>{ms(s.perf.jumpMs)}</td></tr>
          <tr><th scope="row">Draw time</th><td>{s.perf.drawMs > 0 ? `${s.perf.drawMs.toFixed(1)} ms` : '\u2014'}</td></tr>
        </tbody>
      </table>
    </div>
  )
}

const def: ViewDefinition = { id: 'speed', title: 'Speed', region: 'right', order: 2, component: SpeedView }
export default def

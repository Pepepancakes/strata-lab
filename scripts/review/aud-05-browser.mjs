// AUD-5 measurement, built file in headless Chrome (CDP): run time and memory of the long presets bundled (preset value)
// and full (bundleEvery = 1), and the pore pressure at about 10,000 ft below the sea floor in a few columns.
// Usage: npm run build && node scripts/review/aud-05-browser.mjs [presetId ...]   (CHROME=path to override; Gulf full takes minutes)
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const FILE = resolve('dist/strata-lab.html')
if (!existsSync(FILE)) throw new Error('dist/strata-lab.html missing: run npm run build first')
const chrome = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find((p) => existsSync(p))
if (!chrome) throw new Error('No Chrome found; set CHROME=path')
const COLS = { miocene: [80, 100], cenozoic: [80, 100], gulf: [80, 100, 250] }
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['miocene', 'cenozoic', 'gulf']

const port = 9300 + Math.floor(Math.random() * 500)
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'strata-aud5-'))}`, '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const page = (presetId, full, cols) => `(async () => {
  const { EngineClient } = window.__strata
  const c = new EngineClient()
  const spec = { presetId: ${JSON.stringify(presetId)}${full ? ', overrides: { bundleEvery: 1 }' : ''} }
  const t0 = performance.now()
  const run = await c.request({ kind: 'run', spec, seed: 1 })
  const runMs = performance.now() - t0
  if (run.kind !== 'runDone') return JSON.stringify({ error: JSON.stringify(run).slice(0, 200) })
  const list = await c.request({ kind: 'branches' })
  const out = { steps: run.info.nSteps, runMs, workerMs: run.ms, liveMB: list.liveBytes / 1e6, jsHeapMB: performance.memory ? performance.memory.usedJSHeapSize / 1e6 : null, cols: {} }
  for (const j of ${JSON.stringify(cols)}) {
    const r = await c.request({ kind: 'well', branchId: run.info.rootId, step: run.info.nSteps, column: j })
    const w = r.well
    const wd = Math.max(0, w.seaLevelM - w.H)
    let depth = wd, best = null
    for (let l = w.nLayers - 1; l >= 0; l--) {
      if (w.sand[l] + w.mud[l] <= 1e-9) continue
      const mid = depth + 0.5 * w.thick[l]
      depth += w.thick[l]
      if (w.material[l] === 1) continue
      best = { ft: (mid - wd) / 0.3048, ppg: (1025 * 9.81 * mid + w.u[l]) / (9.81 * mid) / 119.826 }
      if (mid - wd > 10000 * 0.3048) break
    }
    out.cols[j] = best
  }
  c.terminate()
  return JSON.stringify(out)
})()`

let failed = true
try {
  let target
  for (let i = 0; i < 50 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page') } catch { /* starting */ }
    if (!target) await sleep(200)
  }
  if (!target) throw new Error('could not reach Chrome DevTools')
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)))
  let seq = 0
  const waiting = new Map()
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && waiting.has(m.id)) waiting.get(m.id)(m) }
  const send = (method, params = {}) => new Promise((r) => { const id = ++seq; waiting.set(id, r); ws.send(JSON.stringify({ id, method, params })) })
  await send('Page.enable')
  await send('Page.navigate', { url: pathToFileURL(FILE).href })
  await sleep(1500)
  const ua = await send('Runtime.evaluate', { expression: 'navigator.userAgent', returnByValue: true })
  console.log(ua.result.result.value, process.platform, process.version)
  for (const id of ids) {
    for (const full of [false, true]) {
      const r = await send('Runtime.evaluate', { expression: page(id, full, COLS[id] ?? []), awaitPromise: true, returnByValue: true })
      if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 500))
      const v = JSON.parse(r.result.result.value)
      console.log(`${id} ${full ? 'full' : 'fast'}: ${v.error ?? `steps ${v.steps}, run ${(v.runMs / 1000).toFixed(1)} s (worker ${(v.workerMs / 1000).toFixed(1)} s), record ${v.liveMB.toFixed(1)} MB, js heap ${v.jsHeapMB?.toFixed(0)} MB, ` +
        Object.entries(v.cols).map(([j, b]) => `col ${j}: ${b ? b.ppg.toFixed(2) + ' ppg at ' + b.ft.toFixed(0) + ' ft' : 'n/a'}`).join('; ')}`)
    }
  }
  failed = false
  ws.close()
} catch (e) {
  console.error(e)
} finally {
  proc.kill()
}
process.exit(failed ? 1 : 0)

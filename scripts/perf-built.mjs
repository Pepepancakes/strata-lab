// Times the BUILT dist/strata-lab.html in headless Chrome (CDP): run time per preset, longest
// main-thread task during the run, random seek, dragging backward, branch. Prints one table.
// Needs Node 22+ and a Chrome/Edge install (CHROME=path to override). Run npm run build first.
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const FILE = resolve('dist/strata-lab.html')
if (!existsSync(FILE)) throw new Error('dist/strata-lab.html missing: run npm run build first')
const candidates = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean)
const chrome = candidates.find((p) => existsSync(p))
if (!chrome) throw new Error('No Chrome/Edge found; set CHROME=path')

const port = 9300 + Math.floor(Math.random() * 500)
const profile = mkdtempSync(join(tmpdir(), 'strata-perf-'))
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Runs inside the page. Seeded pseudo-random (mulberry32) so the seek steps are the same every time.
const PAGE = `(async () => {
  const { EngineClient } = window.__strata
  const longTasks = []
  new PerformanceObserver((l) => { for (const e of l.getEntries()) longTasks.push(e.duration) }).observe({ entryTypes: ['longtask'] })
  let seed = 12345
  const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }
  const out = {}
  for (const presetId of ['last3', 'miocene', 'cenozoic']) {
    const c = new EngineClient()
    longTasks.length = 0
    const t0 = performance.now()
    const run = await c.request({ kind: 'run', spec: { presetId }, seed: 1 })
    const runMs = performance.now() - t0
    if (run.kind !== 'runDone') { out[presetId] = { error: JSON.stringify(run).slice(0, 200) }; continue }
    const n = run.info.nSteps
    const maxTask = Math.max(0, ...longTasks)
    const seeks = []
    for (let i = 0; i < 40; i++) {
      const s = 1 + Math.floor(rnd() * n)
      const t = performance.now()
      await c.request({ kind: 'seek', branchId: run.info.rootId, step: s })
      seeks.push(performance.now() - t)
    }
    const drag = []
    let s = Math.floor(n * 0.8)
    await c.request({ kind: 'seek', branchId: run.info.rootId, step: s })
    for (let i = 0; i < 40; i++) {
      s -= 1
      const t = performance.now()
      await c.request({ kind: 'seek', branchId: run.info.rootId, step: s })
      drag.push(performance.now() - t)
    }
    const tb = performance.now()
    const br = await c.request({ kind: 'branch', parentId: run.info.rootId, step: Math.floor(n * 0.8), edits: { slShift: -50 } })
    const branchMs = performance.now() - tb
    const list = await c.request({ kind: 'branches' })
    out[presetId] = { steps: n, runMs, workerRunMs: run.ms, maxMainTaskMs: maxTask, seekMedian: med(seeks), seekMax: Math.max(...seeks), dragMedian: med(drag), dragMax: Math.max(...drag), branchMs, branchOwnMB: br.branch.ownBytes / 1e6, mainReachableMB: list.branches[0].reachableBytes / 1e6, keyframeEvery: run.info.keyframeEvery }
    c.terminate()
  }
  return JSON.stringify(out)
})()`

let failed = true
try {
  let target
  for (let i = 0; i < 50 && !target; i++) {
    try {
      target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page')
    } catch {
      /* starting */
    }
    if (!target) await sleep(200)
  }
  if (!target) throw new Error('could not reach Chrome DevTools')
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)))
  let seq = 0
  const waiting = new Map()
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && waiting.has(m.id)) waiting.get(m.id)(m)
  }
  const send = (method, params = {}) => new Promise((r) => { const id = ++seq; waiting.set(id, r); ws.send(JSON.stringify({ id, method, params })) })
  await send('Page.enable')
  await send('Page.navigate', { url: pathToFileURL(FILE).href })
  await sleep(1500)
  const r = await send('Runtime.evaluate', { expression: PAGE, awaitPromise: true, returnByValue: true })
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 500))
  const res = JSON.parse(r.result.result.value)
  console.log('preset     steps  run ms  maxTask  seek med/max  drag med/max  branch ms  branch MB  main MB  kf every')
  for (const [k, v] of Object.entries(res)) {
    if (v.error) { console.log(k, v.error); continue }
    console.log(
      `${k.padEnd(10)} ${String(v.steps).padStart(5)} ${v.runMs.toFixed(0).padStart(7)} ${v.maxMainTaskMs.toFixed(0).padStart(8)}  ${v.seekMedian.toFixed(0).padStart(6)}/${v.seekMax.toFixed(0).padEnd(5)}  ${v.dragMedian.toFixed(0).padStart(6)}/${v.dragMax.toFixed(0).padEnd(5)} ${v.branchMs.toFixed(0).padStart(9)} ${v.branchOwnMB.toFixed(1).padStart(10)} ${v.mainReachableMB.toFixed(1).padStart(8)} ${String(v.keyframeEvery).padStart(8)}`,
    )
  }
  failed = false
  ws.close()
} catch (e) {
  console.error(e)
} finally {
  proc.kill()
}
process.exit(failed ? 1 : 0)

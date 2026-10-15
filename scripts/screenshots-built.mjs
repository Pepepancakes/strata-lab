// Drives the BUILT dist/strata-lab.html in headless Chrome (CDP, separate profile) and records
// what M1.6 promises: screenshots of every colour mode for the default run and the Miocene preset,
// each with the published sea-level curve and with the teaching sine; the same sine views from
// spike 001's built file for comparison; console errors; network requests; the source label on
// every control; and the physics checks panel.
//
//   npm run build && node scripts/screenshots-built.mjs [outDir]
//
// Needs Node 22+ (global WebSocket) and Chrome/Edge (CHROME=path to override). Section canvases
// are saved from canvas.toDataURL() as well as the page screenshot, because a headless screenshot
// may not show 2D canvases. Writes a report.json next to the images.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const OUT = resolve(process.argv[2] ?? 'docs/screenshots/m1-06')
const APP = resolve('dist/strata-lab.html')
const SPIKE = resolve('spikes/001-shelf-to-basin/dist/strata-spike-001.html')
for (const f of [APP, SPIKE]) if (!existsSync(f)) throw new Error(`${f} missing`)
mkdirSync(OUT, { recursive: true })

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
const profile = mkdtempSync(join(tmpdir(), 'strata-shots-'))
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu', '--window-size=1440,1000', 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const report = { errors: [], externalRequests: [], controls: {}, checks: null, files: [] }
let failed = true
try {
  let target
  for (let i = 0; i < 50 && !target; i++) {
    try {
      target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page')
    } catch { /* starting */ }
    if (!target) await sleep(200)
  }
  if (!target) throw new Error('could not reach Chrome DevTools')
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)))
  let seq = 0
  const waiting = new Map()
  let page = 'app'
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && waiting.has(m.id)) return waiting.get(m.id)(m)
    if (m.method === 'Runtime.exceptionThrown') report.errors.push(`${page}: ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`)
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) report.errors.push(`${page}: console.${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description).join(' ')}`)
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') report.errors.push(`${page}: ${m.params.entry.text} ${m.params.entry.url ?? ''}`)
    if (m.method === 'Network.requestWillBeSent') {
      const u = m.params.request.url
      if (!/^(file:|data:|blob:|about:)/.test(u)) report.externalRequests.push(`${page}: ${u}`)
    }
  }
  const send = (method, params = {}) => new Promise((r) => { const id = ++seq; waiting.set(id, r); ws.send(JSON.stringify({ id, method, params })) })
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'evaluate failed')
    return r.result?.result?.value
  }
  const until = async (expr, what, ms = 120000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < ms) { if (await ev(expr)) return; await sleep(150) }
    throw new Error(`timeout waiting for ${what}; errors=${JSON.stringify(report.errors.slice(0, 5))}; text=${JSON.stringify((await ev('document.body.innerText')).slice(0, 600))}`)
  }
  const save = (name, b64) => { writeFileSync(join(OUT, name), Buffer.from(b64, 'base64')); report.files.push(name) }
  const shot = async (name) => save(name, (await send('Page.captureScreenshot', { format: 'png' })).result.data)
  const canvasPng = async (id, name) => save(name, (await ev(`document.getElementById('${id}').toDataURL('image/png')`)).split(',')[1])

  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable'); await send('Network.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })

  // ---------------- the M1 app ----------------
  const appReady = `!document.querySelector('.busy') && !!document.getElementById('section-canvas') && document.body.innerText.includes('Mass balance') && !!document.querySelector('[data-testid=sea-credit]')`
  const setSelect = (label, value) => ev(`(() => { const s = document.querySelector('select[aria-label="${label}"]'); if (!s) throw new Error('no select ${label}'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, '${value}'); s.dispatchEvent(new Event('change', { bubbles: true })); return true })()`)
  const clickText = (text) => ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(text)}); if (!b) throw new Error('no button ' + ${JSON.stringify(text)}); b.click(); return true })()`)
  const settle = async () => { await sleep(500); await until(appReady, 'the app to finish running') ; await sleep(700) }
  const modes = [['grain', 'Grain size'], ['age', 'Age'], ['phi', 'Porosity'], ['op', 'Overpressure (\u03bb*)'], ['temp', 'Temperature (\u00b0F)']]

  await send('Page.navigate', { url: pathToFileURL(APP).href })
  await settle()

  // every control carries a source tag
  report.controls = JSON.parse(await ev(`JSON.stringify((() => { const all = [...document.querySelectorAll('.control')]; const bad = all.filter((c) => !c.querySelector('[data-testid=source-tag]') && !c.querySelector('.tag')).map((c) => c.dataset.param); const tags = {}; for (const c of all) { const t = c.querySelector('.tag')?.textContent; tags[t] = (tags[t] ?? 0) + 1 } return { total: all.length, withoutSource: bad, tags, schedule: document.querySelector('[data-testid=schedule]')?.innerText } })())`))
  // open one info button and read its text, to prove the words are there
  report.infoSample = await ev(`(() => { const b = document.querySelector('.control[data-param=supply] button.info'); b.click(); return document.querySelector('.control[data-param=supply] .srctext')?.textContent })()`)

  for (const preset of ['last3', 'miocene']) {
    await setSelect('Scenario preset', preset)
    await settle()
    for (const curve of ['curve', 'sine']) {
      await setSelect('Sea-level source', curve)
      await settle()
      for (const [id, label] of modes) {
        await clickText(label)
        await sleep(300)
        await until(`document.getElementById('section-canvas').dataset.drawnMode === '${id}' && !document.querySelector('.busy')`, `mode ${id} drawn`)
        await sleep(300)
        const base = `m1-${preset}-${curve}-${id}`
        await canvasPng('section-canvas', `${base}-canvas.png`)
        if (id === 'grain') await shot(`${base}-page.png`)
      }
      report[`${preset}-${curve}`] = { seaCredit: await ev(`document.querySelector('[data-testid=sea-credit]').innerText`), runMs: await ev(`document.querySelector('[data-testid=run-ms]').innerText`), balance: await ev(`document.querySelector('table.num').innerText`) }
    }
  }

  // physics checks panel (back on the default preset)
  await setSelect('Scenario preset', 'last3'); await settle()
  await clickText('Run checks')
  await until(`!!document.querySelector('[data-testid=checks-summary]')`, 'checks')
  report.checks = await ev(`JSON.stringify({ summary: document.querySelector('[data-testid=checks-summary]').innerText, rows: [...document.querySelectorAll('[data-testid=check-row]')].map((r) => r.innerText.replace(/\\n+/g, ' | ')) })`)
  await shot('m1-checks-page.png')

  // branch from the middle, then edit a control in it
  await ev(`(() => { const r = document.querySelector('input[type=range]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(r, '300'); r.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
  await sleep(800)
  await clickText('Branch from here')
  await until(`document.querySelectorAll('ul.branches li').length === 2 && !document.querySelector('.busy')`, 'branch')
  await sleep(800)
  report.branchState = await ev(`JSON.stringify({ lis: [...document.querySelectorAll('ul.branches li')].map((l) => l.innerText.replace(/\\n+/g, ' | ')), lockedStartOnly: [...document.querySelectorAll('.control')].filter((c) => c.querySelector('input:disabled,select:disabled')).length })`)
  await shot('m1-branch-page.png')

  // ---------------- spike 001 (sine only) ----------------
  page = 'spike'
  await send('Page.navigate', { url: pathToFileURL(SPIKE).href })
  await until(`!!document.getElementById('sec') && getComputedStyle(document.getElementById('busy')).display === 'none'`, 'spike')
  await sleep(1000)
  for (const [id] of modes.slice(0, 4)) {
    await ev(`document.querySelector('[data-mode=${id}]').click()`)
    await sleep(600)
    await canvasPng('sec', `spike-last3-sine-${id}-canvas.png`)
    if (id === 'grain') await shot(`spike-last3-sine-${id}-page.png`)
  }

  failed = report.errors.length > 0 || report.externalRequests.length > 0 || report.controls.withoutSource.length > 0
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ ...report, files: report.files.length }, null, 2))
  console.log(failed ? 'SCREENSHOTS: PROBLEMS FOUND' : `SCREENSHOTS OK: ${report.files.length} files in ${OUT}`)
  ws.close()
} catch (e) {
  console.error(e)
} finally {
  proc.kill()
}
process.exit(failed ? 1 : 0)

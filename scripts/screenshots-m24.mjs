// Drives the BUILT dist/strata-lab.html in headless Chrome (CDP, separate profile) and records
// what M2.4 promises: the MTD-prone preset at the end in every colour mode (MTD texture), the
// factor-of-safety mode, an event picked in the list (seek, source and deposit highlighted), the
// pseudo-well with MTD intervals and its hover text, the failure toggle, the source tag on every
// control, console errors and network requests.
//
//   npm run build && node scripts/screenshots-m24.mjs [outDir]
//
// Needs Node 22+ (global WebSocket) and Chrome/Edge (CHROME=path to override). Section canvases are
// also saved from canvas.toDataURL(). Writes report.json next to the images.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const OUT = resolve(process.argv[2] ?? 'docs/screenshots/m2-04')
const APP = resolve('dist/strata-lab.html')
if (!existsSync(APP)) throw new Error(`${APP} missing (npm run build first)`)
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
const profile = mkdtempSync(join(tmpdir(), 'strata-m24-'))
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu', '--window-size=1440,1600', 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const report = { errors: [], externalRequests: [], checks: {}, files: [] }
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
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && waiting.has(m.id)) return waiting.get(m.id)(m)
    if (m.method === 'Runtime.exceptionThrown') report.errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text)
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) report.errors.push(`console.${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description).join(' ')}`)
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') report.errors.push(`${m.params.entry.text} ${m.params.entry.url ?? ''}`)
    if (m.method === 'Network.requestWillBeSent') {
      const u = m.params.request.url
      if (!/^(file:|data:|blob:|about:)/.test(u)) report.externalRequests.push(u)
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
  const canvasPng = async (name) => save(name, (await ev(`document.getElementById('section-canvas').toDataURL('image/png')`)).split(',')[1])

  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable'); await send('Network.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1600, deviceScaleFactor: 1, mobile: false })

  const appReady = `!document.querySelector('.busy') && !!document.getElementById('section-canvas') && document.body.innerText.includes('Mass balance') && !!document.querySelector('[data-testid=sea-credit]')`
  const setSelect = (label, value) => ev(`(() => { const s = document.querySelector('select[aria-label="${label}"]'); if (!s) throw new Error('no select ${label}'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, '${value}'); s.dispatchEvent(new Event('change', { bubbles: true })); return true })()`)
  const clickText = (text) => ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(text)}); if (!b) throw new Error('no button ' + ${JSON.stringify(text)}); b.click(); return true })()`)
  const settle = async () => { await sleep(500); await until(appReady, 'the app to finish running'); await sleep(700) }
  const modes = [['grain', 'Grain size'], ['age', 'Age'], ['phi', 'Porosity'], ['op', 'Overpressure (\u03bb*)'], ['temp', 'Temperature (\u00b0F)'], ['fs', 'Factor of safety']]
  const showMode = async (id, label) => {
    await clickText(label)
    await until(`document.getElementById('section-canvas').dataset.drawnMode === '${id}' && !document.querySelector('.busy')`, `mode ${id} drawn`)
    await sleep(400)
  }
  const slider = (v) => ev(`(() => { const r = document.querySelector('input[type=range]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(r, '${v}'); r.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)

  await send('Page.navigate', { url: pathToFileURL(APP).href })
  await settle()

  // the preset list and the failure toggle
  report.checks.presetOptions = await ev(`[...document.querySelectorAll('select[aria-label="Scenario preset"] option')].map((o) => o.textContent)`)
  report.checks.toggleOffAtStart = await ev(`document.querySelector('input[aria-label="Slope failure (MTDs) on"]').checked === false`)
  report.checks.noEventsMessageWhenOff = await ev(`document.querySelector('[data-testid=no-events]')?.innerText`)

  await setSelect('Scenario preset', 'mtd')
  await settle()
  await until(`!!document.querySelector('[data-testid=event-list]')`, 'the event list')
  report.checks.toggleOnForPreset = await ev(`document.querySelector('input[aria-label="Slope failure (MTDs) on"]').checked === true`)
  report.checks.eventRows = await ev(`[...document.querySelectorAll('[data-testid=event-list] tbody tr')].map((r) => r.innerText.replace(/\\s+/g, ' ').trim())`)
  const nSteps = Number(await ev(`document.querySelector('input[type=range]').max`))
  report.checks.nSteps = nSteps

  // every control carries a source tag, including the new registry rows
  report.checks.controls = JSON.parse(await ev(`JSON.stringify((() => { const all = [...document.querySelectorAll('.control')]; const bad = all.filter((c) => !c.querySelector('.tag')).map((c) => c.dataset.param); return { total: all.length, withoutSource: bad, hasNew: ['failMinDepth', 'failSlopeMin', 'failLowstandDrop', 'failRapidRate', 'mtdPhiMud'].map((k) => [k, !!document.querySelector('.control[data-param=' + k + '] .tag')]) } })())`))

  // end of the run, every colour mode
  for (const [id, label] of modes) {
    await showMode(id, label)
    await canvasPng(`mtd-end-${id}-canvas.png`)
    if (['grain', 'fs', 'op'].includes(id)) await shot(`mtd-end-${id}-page.png`)
  }
  report.checks.legendFs = await ev(`document.querySelector('.legend')?.innerText`)

  // event picked: seeks and highlights
  await showMode('grain', 'Grain size')
  const first = await ev(`Number(document.querySelector('[data-testid=event-list] tbody tr').dataset.event)`)
  const ageOfFirst = report.checks.eventRows[0]
  await ev(`document.querySelector('[data-testid=event-list] tbody tr[data-event="${first}"] button.evbtn').click()`)
  await sleep(600)
  await until(`!document.querySelector('.busy') && !!document.querySelector('[data-testid=event-list] tr.sel')`, 'event selected')
  await sleep(600)
  report.checks.afterPick = JSON.parse(await ev(`JSON.stringify({ step: Number(document.querySelector('input[type=range]').value), selectedRow: document.querySelector('[data-testid=event-list] tr.sel')?.innerText.replace(/\\s+/g, ' '), timeText: document.body.innerText.match(/step \\d+[^\\n]*/)?.[0] ?? null, wellTitle: document.querySelector('.well h2')?.innerText, wellMtd: document.querySelectorAll('[data-testid=well-mtd]').length })`))
  report.checks.eventFirst = { id: first, row: ageOfFirst }
  await canvasPng('mtd-event-selected-grain-canvas.png')
  await shot('mtd-event-selected-page.png')
  await showMode('fs', 'Factor of safety')
  await canvasPng('mtd-event-selected-fs-canvas.png')

  // scrubbing: the headwall flag shows only around the event time
  await slider(String(Math.max(0, report.checks.afterPick.step - 1)))
  await sleep(700)
  report.checks.scrubBefore = { step: Number(await ev(`document.querySelector('input[type=range]').value`)) }
  await canvasPng('mtd-scrub-before-event-canvas.png')

  // pseudo-well with MTDs: back to the end of the run, well in the deposit of the first event, hover it
  await ev(`document.querySelector('[data-testid=event-list] tbody tr[data-event="${first}"] button.evbtn').click()`)
  await sleep(500)
  await slider(String(nSteps))
  await sleep(900)
  await until(`document.querySelectorAll('[data-testid=well-mtd]').length > 0`, 'MTD intervals in the pseudo-well')
  await ev(`document.querySelector('[data-testid=well-mtd]').scrollIntoView({ block: 'center' })`)
  const rect = JSON.parse(await ev(`JSON.stringify(document.querySelector('[data-testid=well-mtd] rect').getBoundingClientRect())`))
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 })
  await sleep(400)
  report.checks.wellHover = await ev(`document.querySelector('[data-testid=mtd-tip]').innerText`)
  report.checks.wellMtdLabels = await ev(`[...document.querySelectorAll('[data-testid=well-mtd] text')].map((t) => t.textContent)`)
  await shot('mtd-pseudo-well-page.png')
  await ev(`window.scrollTo(0, 0)`)

  // the failure toggle turns events off (and back on)
  await ev(`document.querySelector('input[aria-label="Slope failure (MTDs) on"]').click()`)
  await settle()
  await until(`!!document.querySelector('[data-testid=no-events]')`, 'events gone')
  report.checks.afterToggleOff = await ev(`document.querySelector('[data-testid=no-events]').innerText`)
  await shot('mtd-failure-off-page.png')

  failed = report.errors.length > 0 || report.externalRequests.length > 0 || report.checks.controls.withoutSource.length > 0
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

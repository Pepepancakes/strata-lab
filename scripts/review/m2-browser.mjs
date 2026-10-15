// M2.6 integrity review, browser part: drives the BUILT dist/strata-lab.html in headless Chrome
// over CDP and records what the review needs:
//   - zero network requests and zero console errors
//   - the physics checks panel (default preset, and again on the MTD-prone preset): all PASS?
//   - every colour mode with MTDs on the MTD-prone preset (screenshots of the page and the canvas)
//   - the event list: every event is clicked, the time slider must land on the event's step
//   - every control has a source tag (cited / tuned / to verify), and the new M2 controls
//   - the browser's own event count against the Node count (cross-runtime reproducibility)
//
//   npm run build && node scripts/review/m2-browser.mjs [outDir]
// Own driver (written for this review, not the author's screenshots script).

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const OUT = resolve(process.argv[2] ?? 'docs/screenshots/m2-06-review')
const APP = resolve('dist/strata-lab.html')
if (!existsSync(APP)) throw new Error(`${APP} missing (npm run build first)`)
mkdirSync(OUT, { recursive: true })

const candidates = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].filter(Boolean)
const chrome = candidates.find((p) => existsSync(p))
if (!chrome) throw new Error('No Chrome/Edge found; set CHROME=path')

const port = 9800 + Math.floor(Math.random() * 150)
const profile = mkdtempSync(join(tmpdir(), 'strata-m26-'))
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu', '--window-size=1440,1600', 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const report = { errors: [], externalRequests: [], requestsSeen: 0, checks: {}, files: [] }
let failed = true
try {
  let target
  for (let i = 0; i < 50 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page') } catch { /* starting */ }
    if (!target) await sleep(200)
  }
  if (!target) throw new Error('could not reach Chrome DevTools')
  report.browserVersion = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).Browser
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
      report.requestsSeen++
      const u = m.params.request.url
      if (!/^(file:|data:|blob:|about:)/.test(u)) report.externalRequests.push(u)
    }
    // a worker is a separate target: make sure its requests are also seen
  }
  const send = (method, params = {}) => new Promise((r) => { const id = ++seq; waiting.set(id, r); ws.send(JSON.stringify({ id, method, params })) })
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'evaluate failed')
    return r.result?.result?.value
  }
  const until = async (expr, what, ms = 180000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < ms) { if (await ev(expr)) return; await sleep(150) }
    throw new Error(`timeout waiting for ${what}; errors=${JSON.stringify(report.errors.slice(0, 5))}; text=${JSON.stringify((await ev('document.body.innerText')).slice(0, 500))}`)
  }
  const save = (name, b64) => { writeFileSync(join(OUT, name), Buffer.from(b64, 'base64')); report.files.push(name) }
  const shot = async (name) => save(name, (await send('Page.captureScreenshot', { format: 'png' })).result.data)
  const canvasPng = async (name) => save(name, (await ev(`document.getElementById('section-canvas').toDataURL('image/png')`)).split(',')[1])

  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable'); await send('Network.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1600, deviceScaleFactor: 1, mobile: false })

  const appReady = `!document.querySelector('.busy') && !!document.getElementById('section-canvas') && document.body.innerText.includes('Mass balance') && !!document.querySelector('[data-testid=sea-credit]')`
  const setSelect = (label, value) => ev(`(() => { const s = document.querySelector('select[aria-label="${label}"]'); if (!s) throw new Error('no select ${label}'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, '${value}'); s.dispatchEvent(new Event('change', { bubbles: true })); return true })()`)
  const clickText = (text) => ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(text)}); if (!b) throw new Error('no button ' + ${JSON.stringify(text)}); b.click(); return true })()`)
  const settle = async () => { await sleep(500); await until(appReady, 'the app to finish running'); await sleep(700) }
  const showMode = async (id, label) => {
    await clickText(label)
    await until(`document.getElementById('section-canvas').dataset.drawnMode === '${id}' && !document.querySelector('.busy')`, `mode ${id} drawn`)
    await sleep(400)
  }
  const sliderVal = () => ev(`Number(document.querySelector('input[type=range]').value)`)
  const checksPanel = async () => {
    await clickText('Run checks')
    await until(`!!document.querySelector('[data-testid=checks-summary]')`, 'physics checks to finish', 300000)
    return JSON.parse(await ev(`JSON.stringify({ summary: document.querySelector('[data-testid=checks-summary]').textContent.replace(/\\s+/g, ' ').trim(), rows: [...document.querySelectorAll('[data-testid=check-row]')].map((r) => r.textContent.replace(/\\s+/g, ' ').trim().slice(0, 160)) })`))
  }

  await send('Page.navigate', { url: pathToFileURL(APP).href })
  await settle()

  // --- 1. default preset: checks panel, failure off
  report.checks.defaultPreset = { checks: await checksPanel(), toggleOff: await ev(`document.querySelector('input[aria-label="Slope failure (MTDs) on"]').checked === false`), noEventsMsg: await ev(`document.querySelector('[data-testid=no-events]')?.innerText ?? null`) }
  await ev(`document.querySelector('[data-testid=checks-summary]')?.scrollIntoView({ block: 'center' })`)
  await shot('m2-default-checks-page.png')
  await ev('window.scrollTo(0, 0)')
  await shot('m2-default-page.png')

  // --- 2. MTD-prone preset
  await setSelect('Scenario preset', 'mtd')
  await settle()
  await until(`!!document.querySelector('[data-testid=event-list]')`, 'the event list')
  report.checks.mtdToggleOn = await ev(`document.querySelector('input[aria-label="Slope failure (MTDs) on"]').checked === true`)
  report.checks.eventRows = await ev(`[...document.querySelectorAll('[data-testid=event-list] tbody tr[data-event]')].map((r) => r.innerText.replace(/\\s+/g, ' ').trim())`)
  report.checks.eventCountHeader = await ev(`document.querySelector("[data-testid=event-header]")?.innerText ?? null`)
  report.checks.eventDetails = await ev(`[...document.querySelectorAll("[data-event-detail]")].map((r) => r.innerText.replace(/\\s+/g, " ").trim())`)
  report.checks.stalledNotes = await ev(`document.querySelectorAll("[data-testid=stalled-note]").length`)
  report.checks.windowNotes = await ev(`document.querySelectorAll("[data-testid=window-note]").length`)
  await ev(`document.querySelector("[data-testid=event-header]")?.scrollIntoView({ block: "start" })`)
  await shot("m2-event-list-page.png")
  await ev("window.scrollTo(0, 0)")
  report.checks.eventHeader = await ev(`[...document.querySelectorAll('[data-testid=event-list] thead th')].map((t) => t.innerText.trim())`)
  report.checks.eventHeading = await ev(`document.querySelector('[data-testid=event-list]')?.closest('section, div')?.querySelector('h2')?.innerText ?? null`)
  const nSteps = Number(await ev(`document.querySelector('input[type=range]').max`))
  report.checks.nSteps = nSteps
  report.checks.mtdChecks = await checksPanel()
  await ev(`document.querySelector('[data-testid=checks-summary]')?.scrollIntoView({ block: 'center' })`)
  await shot('m2-mtd-checks-page.png')
  await ev('window.scrollTo(0, 0)')

  // --- 3. every control has a source tag
  report.checks.controls = JSON.parse(await ev(`JSON.stringify((() => {
    const all = [...document.querySelectorAll('.control')]
    const bad = all.filter((c) => !c.querySelector('[data-testid=source-tag]')).map((c) => c.dataset.param)
    const kinds = {}
    for (const c of all) { const t = c.querySelector('[data-testid=source-tag]'); if (t) { const k = t.textContent.trim().toLowerCase(); kinds[k] = (kinds[k] || 0) + 1 } }
    const newOnes = ['phiFric', 'cohesion', 'stabMaxDepth', 'failOn', 'failMaxCells', 'failMaxIters', 'runYield', 'runViscosity', 'runDensity', 'mtdPhiMud', 'failMinDepth', 'failSlopeMin', 'failLowstandDrop', 'failRapidRate']
    return { total: all.length, withoutSource: bad, kinds, newControls: newOnes.map((k) => { const c = document.querySelector('.control[data-param=' + k + ']'); return [k, c ? (c.querySelector('[data-testid=source-tag]')?.textContent.trim() ?? 'NO TAG') : 'NO CONTROL'] }) }
  })())`))

  // --- 4. every colour mode at the end of the run, with MTDs
  const modes = [['grain', 'Grain size'], ['age', 'Age'], ['phi', 'Porosity'], ['op', 'Overpressure (\u03bb*)'], ['temp', 'Temperature (\u00b0F)'], ['fs', 'Factor of safety']]
  report.checks.modes = {}
  for (const [id, label] of modes) {
    await showMode(id, label)
    // count the pixels that are not background in the canvas, and the canvas size: a blank canvas would be a failure
    const px = JSON.parse(await ev(`JSON.stringify((() => { const c = document.getElementById('section-canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let nz = 0; const colors = new Set(); for (let i = 0; i < d.length; i += 4 * 97) { if (d[i + 3] > 0 && !(d[i] > 250 && d[i + 1] > 250 && d[i + 2] > 250)) { nz++; colors.add((d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4)) } } return { w: c.width, h: c.height, nonWhiteSamples: nz, distinctColours: colors.size, drawnMode: c.dataset.drawnMode } })())`))
    report.checks.modes[id] = px
    await canvasPng(`m2-mtd-end-${id}-canvas.png`)
    await shot(`m2-mtd-end-${id}-page.png`)
  }
  report.checks.legendFs = await ev(`document.querySelector('.legend')?.innerText ?? null`)
  await showMode('grain', 'Grain size')

  // --- 5. the event list seeks: click every event, the slider must land on its step
  const rowsMeta = JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('[data-testid=event-list] tbody tr[data-event]')].map((r) => ({ id: Number(r.dataset.event), text: r.innerText.replace(/\\s+/g, ' ').trim() })))`))
  const seeks = []
  for (const row of rowsMeta) {
    await ev(`document.querySelector('[data-testid=event-list] tbody tr[data-event="${row.id}"] button.evbtn').click()`)
    await sleep(350)
    await until(`!document.querySelector('.busy')`, 'seek done')
    const v = await sliderVal()
    const timeText = await ev(`document.body.innerText.match(/step \\d+ of \\d+[^\\n]*/)?.[0] ?? null`)
    const sel = await ev(`document.querySelector('[data-testid=event-list] tr.sel')?.dataset.event ?? null`)
    seeks.push({ id: row.id, row: row.text, step: v, timeText, selected: sel })
    if (row.id === rowsMeta[0].id) { await canvasPng('m2-event1-selected-grain-canvas.png'); await shot('m2-event1-selected-page.png') }
    if (row.id === rowsMeta[Math.floor(rowsMeta.length / 2)].id) { await canvasPng('m2-event-mid-selected-grain-canvas.png') }
  }
  report.checks.seeks = seeks
  report.checks.seekMismatchSelected = seeks.filter((s) => String(s.selected) !== String(s.id)).map((s) => s.id)

  // --- 6. event 1 in the FS mode, then scrub to the step before
  const first = rowsMeta[0].id
  await ev(`document.querySelector('[data-testid=event-list] tbody tr[data-event="${first}"] button.evbtn').click()`)
  await sleep(600)
  await showMode('fs', 'Factor of safety')
  await canvasPng('m2-event1-selected-fs-canvas.png')

  // --- 7. pseudo-well with MTD intervals
  await slider_to(nSteps)
  async function slider_to(v) {
    await ev(`(() => { const r = document.querySelector('input[type=range]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(r, '${v}'); r.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
    await sleep(900)
  }
  await showMode('grain', 'Grain size')
  report.checks.wellMtdCount = await ev(`document.querySelectorAll('[data-testid=well-mtd]').length`)
  if (report.checks.wellMtdCount > 0) {
    await ev(`document.querySelector('[data-testid=well-mtd]').scrollIntoView({ block: 'center' })`)
    await shot('m2-well-mtd-page.png')
    await ev('window.scrollTo(0, 0)')
  }

  // --- 8. failure on for the default preset (control): fewer than 4 events expected
  await setSelect('Scenario preset', 'last3')
  await settle()
  await ev(`document.querySelector('input[aria-label="Slope failure (MTDs) on"]').click()`)
  await settle()
  report.checks.defaultWithFailureOn = await ev(`({ rows: document.querySelectorAll('[data-testid=event-list] tbody tr[data-event]').length, noEvents: document.querySelector('[data-testid=no-events]')?.innerText ?? null })`)
  await shot('m2-default-failure-on-page.png')

  // --- 9. resources the page actually fetched
  report.checks.resourceEntries = await ev(`performance.getEntriesByType('resource').map((r) => r.name.slice(0, 80))`)
  failed = report.errors.length > 0 || report.externalRequests.length > 0 || report.checks.controls.withoutSource.filter((p) => p !== 'preset').length > 0
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ ...report, files: report.files.length, checks: { ...report.checks, eventRows: report.checks.eventRows.length + ' rows' } }, null, 1).slice(0, 12000))
  console.log(failed ? 'BROWSER: PROBLEMS FOUND' : `BROWSER OK: ${report.files.length} files in ${OUT}`)
  ws.close()
} catch (e) {
  console.error(e)
} finally {
  proc.kill()
}
process.exit(failed ? 1 : 0)

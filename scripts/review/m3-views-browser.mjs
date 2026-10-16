// M3.5 browser pass: drives the BUILT dist/strata-lab.html from file:// in headless Chrome (CDP,
// own --user-data-dir, fresh state) and records what the salt views promise:
//   - default run (salt off), the Gulf preset at the end and mid-run, every colour mode
//   - pseudo-wells through a minibasin, a diapir or a weld (found by scanning columns)
//   - scrub / rewind / branch / compare with salt (salt pixel counts per step)
//   - controls: source badges and start-only marking on the salt controls; preset selector
//   - the physics checks panel with the M3 rows
//   - 100 %, 125 % and 150 % display scaling: canvas size before/after redraws, panel tops
//
//   npm run build && node scripts/review/m3-views-browser.mjs <outDir>
// Needs Node 22+ (global WebSocket) and Chrome/Edge (CHROME=path to override). 2D canvases are
// saved from canvas.toDataURL() because a headless screenshot may not show them.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const OUT = resolve(process.argv[2] ?? 'm3-views-out')
const APP = resolve('dist/strata-lab.html')
if (!existsSync(APP)) throw new Error(`${APP} missing (npm run build first)`)
mkdirSync(OUT, { recursive: true })
const chrome = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find((p) => existsSync(p))
if (!chrome) throw new Error('No Chrome/Edge found; set CHROME=path')

const port = 9200 + Math.floor(Math.random() * 500)
const profile = mkdtempSync(join(tmpdir(), 'strata-m35-'))
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu', '--window-size=1440,1700', 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const report = { errors: [], externalRequests: [], files: [] }
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
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.id && waiting.has(m.id)) return waiting.get(m.id)(m)
    if (m.method === 'Runtime.exceptionThrown') report.errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text)
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) report.errors.push(`console.${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description).join(' ')}`)
    if (m.method === 'Network.requestWillBeSent' && !/^(file:|data:|blob:|about:)/.test(m.params.request.url)) report.externalRequests.push(m.params.request.url)
  }
  const send = (method, params = {}) => new Promise((r) => { const id = ++seq; waiting.set(id, r); ws.send(JSON.stringify({ id, method, params })) })
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'evaluate failed')
    return r.result?.result?.value
  }
  const until = async (expr, what, ms = 240000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < ms) { if (await ev(expr)) return; await sleep(150) }
    throw new Error(`timeout waiting for ${what}; errors=${JSON.stringify(report.errors.slice(0, 3))}`)
  }
  const save = (name, b64) => { writeFileSync(join(OUT, name), Buffer.from(b64, 'base64')); report.files.push(name) }
  const shot = async (name) => save(name, (await send('Page.captureScreenshot', { format: 'png' })).result.data)
  const canvasPng = async (name) => save(name, (await ev(`document.getElementById('section-canvas').toDataURL('image/png')`)).split(',')[1])
  const metrics = (dpr) => send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1700, deviceScaleFactor: dpr, mobile: false })

  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable')
  await metrics(1)

  const appReady = `!document.querySelector('.busy') && !!document.getElementById('section-canvas') && document.body.innerText.includes('Mass balance')`
  const setSelect = (label, value) => ev(`(() => { const s = document.querySelector('select[aria-label="${label}"]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, '${value}'); s.dispatchEvent(new Event('change', { bubbles: true })); return true })()`)
  const clickText = (t) => ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(t)}); if (!b) throw new Error('no button ' + ${JSON.stringify(t)}); b.click(); return true })()`)
  const settle = async () => { await sleep(600); await ev(`[...document.querySelectorAll('[data-testid=replace-warning] button')].find((b) => b.textContent.trim() === 'Replace')?.click()`); await sleep(400); await until(appReady, 'the app to finish running'); await sleep(800) }
  const showMode = async (id, label) => {
    await clickText(label)
    await until(`document.getElementById('section-canvas').dataset.drawnMode === '${id}' && !document.querySelector('.busy')`, `mode ${id}`)
    await sleep(300)
  }
  const sliderTo = async (v) => {
    await ev(`(() => { const r = document.querySelector('input[type=range]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(r, '${v}'); r.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
    await sleep(500); await until(`!document.querySelector('.busy')`, 'scrub'); await sleep(600)
  }
  const sliderMax = async () => Number(await ev(`document.querySelector('input[type=range]').max`))
  const clickCanvasFrac = async (f) => {
    const r = JSON.parse(await ev(`JSON.stringify(document.getElementById('section-canvas').getBoundingClientRect())`))
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.left + r.width * f, y: r.top + r.height / 2, button: 'left', clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.left + r.width * f, y: r.top + r.height / 2, button: 'left', clickCount: 1 })
    await sleep(500)
  }
  // pink-ish pixels (salt, either salt colour or the ramp), counted on a coarse grid
  const hash = () => ev(`(() => { const c = document.getElementById('section-canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 2166136261; for (let i = 0; i < d.length; i += 4) { h = Math.imul(h ^ d[i] ^ (d[i+1] << 8) ^ (d[i+2] << 16), 16777619) >>> 0 } return h })()`)
  const saltPixels = () => ev(`(() => { const c = document.getElementById('section-canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0, tot = 0; for (let i = 0; i < d.length; i += 4 * 7) { tot++; if (d[i] > 150 && d[i] - d[i + 1] > 55 && d[i + 2] > d[i + 1]) n++ } return { n, tot, w: c.width, h: c.height, cssW: c.clientWidth, cssH: c.clientHeight, mode: c.dataset.drawnMode } })()`)
  const tops = () => ev(`(() => { const top = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top + scrollY), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) } }; return { section: top('#section-canvas'), well: top('section.well svg'), wellRegion: top('section.well'), controls: top('section.controls'), right: top('section.right'), docH: document.documentElement.scrollHeight } })()`)
  const wellState = () => ev(`(() => ({ km: document.querySelector('section.well h2')?.innerText, salt: [...document.querySelectorAll('[data-testid=well-salt]')].length, weld: !!document.querySelector('[data-testid=well-weld]'), note: document.querySelector('[data-testid=well-salt-note]')?.innerText ?? null, svgText: [...document.querySelectorAll('section.well svg text')].map((t) => t.textContent).filter((t) => /salt|weld|top|base|pores/.test(t)) }))()`)

  await send('Page.navigate', { url: pathToFileURL(APP).href })
  await settle()

  // --- 1. default run, salt off
  report.default = { saltPx: await saltPixels(), buttons: await ev(`[...document.querySelectorAll('.modes button, button[aria-pressed]')].map((b) => b.textContent.trim())`), saltLegend: await ev(`!!document.querySelector('[data-testid=salt-legend]')`), wellSalt: (await wellState()).salt }
  await canvasPng('default-canvas.png'); await shot('default-page.png')
  report.presetOptions = await ev(`[...document.querySelector('select[aria-label="Scenario preset"]').options].map((o) => o.value + ' | ' + o.text)`)

  // --- 2. Gulf preset: end of run
  await setSelect('Scenario preset', 'gulf')
  await settle()
  const nSteps = await sliderMax()
  report.nSteps = nSteps
  await clickCanvasFrac(0.5)
  report.gulfEnd = { saltPx: await saltPixels(), saltLegend: await ev(`document.querySelector('[data-testid=salt-legend]')?.innerText ?? null`), buttons: await ev(`[...document.querySelectorAll('button[aria-pressed]')].map((b) => b.textContent.trim())`) }
  await canvasPng('gulf-end-grain-canvas.png'); await shot('gulf-end-page.png')

  // --- 3. every colour mode over salt, at the end
  report.gulfModes = {}
  for (const [id, label] of [['grain', 'Grain size'], ['age', 'Age'], ['phi', 'Porosity'], ['op', 'Overpressure (\u03bb*)'], ['temp', 'Temperature (\u00b0F)'], ['fs', 'Factor of safety'], ['salt', 'Salt thickness']]) {
    try { await showMode(id, label) } catch (e) { report.gulfModes[id] = { error: String(e).slice(0, 120) }; continue }
    report.gulfModes[id] = { ...(await saltPixels()), legend: await ev(`document.querySelector('.legend')?.innerText?.replace(/\\s+/g, ' ') ?? null`) }
    await canvasPng(`gulf-end-${id}-canvas.png`)
  }
  await shot('gulf-end-salt-mode-page.png')
  // the (i) buttons present on the salt views
  report.infoButtons = await ev(`[...document.querySelectorAll('button[aria-label^="What"]')].map((b) => b.getAttribute('aria-label'))`)
  // open one (i) and read its text
  report.infoOpened = await ev(`(() => { const b = document.querySelector('button[aria-label^="What"]'); if (!b) return null; b.click(); return b.getAttribute('aria-label') })()`)
  await sleep(300)
  report.infoText = await ev(`document.querySelector('[role=note], .whatitmeans, .info-pop, [data-testid=info]')?.innerText ?? null`)
  await shot('gulf-info-open-page.png')
  await showMode('grain', 'Grain size')

  // --- 4. mid-run
  await sliderTo(Math.round(nSteps / 2))
  report.gulfMid = { step: Math.round(nSteps / 2), ...(await saltPixels()) }
  await canvasPng('gulf-mid-grain-canvas.png')
  await showMode('salt', 'Salt thickness'); await canvasPng('gulf-mid-salt-canvas.png')
  await shot('gulf-mid-salt-page.png')

  // --- 5. time machine: salt pixels per step while scrubbing (grain mode), then back to the end
  await showMode('grain', 'Grain size')
  report.scrub = {}; report.scrubHash = {}
  for (const f of [0, 0.1, 0.25, 0.5, 0.75, 1]) { await sliderTo(Math.round(nSteps * f)); const p = await saltPixels(); report.scrub[f] = p.n; report.scrubHash[f] = await hash(); if (f === 0) await canvasPng('gulf-step0-canvas.png') }
  await sliderTo(nSteps); report.scrub.endAgain = (await saltPixels()).n; report.scrubHash.endAgain = await hash()

  // --- 6. pseudo-well scan: find a minibasin, a diapir and a weld by clicking columns
  report.wells = {}
  const found = {}
  for (let f = 0.12; f <= 0.98; f += 0.04) {
    await clickCanvasFrac(f)
    const w = await wellState()
    const thick = (w.note ?? '').match(/\((\d[\d,]*) ft thick\)/)?.[1]
    const row = { f: Number(f.toFixed(2)), km: w.km, saltIntervals: w.salt, weld: w.weld, thickFt: thick ? Number(thick.replace(/,/g, '')) : 0 }
    report.wells[row.f] = row
    if (!found.diapir || row.thickFt > found.diapir.thickFt) found.diapir = row
    if (row.saltIntervals && f >= 0.2 && (!found.minibasin || row.thickFt < found.minibasin.thickFt)) found.minibasin = row
    if (row.weld && !found.weld) found.weld = row
    if (!row.saltIntervals && !found.none) found.none = row
  }
  report.wellPicks = found
  let i = 0
  for (const [name, row] of Object.entries(found)) {
    if (!row) continue
    await clickCanvasFrac(row.f)
    report.wells[`pick-${name}`] = await wellState()
    await ev(`document.querySelector('section.well svg')?.scrollIntoView({ block: 'center' })`)
    await shot(`well-${name}-page.png`)
    await ev('window.scrollTo(0, 0)')
    i++
  }

  // --- 7. rewind / branch / compare with salt
  await sliderTo(Math.round(nSteps * 0.6))
  await clickText('Branch from here')
  await sleep(800); await until(`!document.querySelector('.busy')`, 'branch'); await sleep(800)
  report.branch = { list: await ev(`[...document.querySelectorAll('ul.branches li')].map((l) => l.innerText.replace(/\\s+/g, ' ').trim())`) }
  report.branch.saltAtBranch = (await saltPixels()).n
  await sliderTo(nSteps); report.branch.saltBranchEnd = (await saltPixels()).n
  await canvasPng('branch-end-canvas.png')
  // start-only controls locked on the branch
  report.branch.startOnlyNote = await ev(`[...document.querySelectorAll('.control')].filter((c) => /Set at the start of the run/.test(c.textContent)).map((c) => c.dataset.param).slice(0, 40)`)
  // compare with the main run
  report.branch.compareOnAfterBranch = await ev(`document.querySelector('ul.branches input[type=checkbox]')?.checked`)
  if (!report.branch.compareOnAfterBranch) await ev(`document.querySelector('ul.branches input[type=checkbox]')?.click()`)
  await sleep(900); await until(`!document.querySelector('.busy')`, 'compare'); await sleep(600)
  report.branch.compare = { ...(await saltPixels()), text: String(await ev(`document.querySelector('section.section')?.innerText ?? ''`)).split(/\r?\n/).find((l) => l.startsWith('Comparing')) ?? null }
  await canvasPng('compare-canvas.png'); await shot('compare-page.png')
  await ev(`document.querySelector('ul.branches input[type=checkbox]')?.click()`)
  await sleep(500)
  // back to the main run, rewind to step 0 and forward again: same salt pixels as before
  await ev(`document.querySelector('ul.branches input[type=radio]')?.click()`)
  await sleep(900); await until(`!document.querySelector('.busy')`, 'main'); await sleep(500)
  await clickCanvasFrac(0.5)
  await sliderTo(0); report.branch.mainStep0 = (await saltPixels()).n; report.branch.mainStep0Hash = await hash()
  await sliderTo(nSteps); report.branch.mainEndAgain = (await saltPixels()).n; report.branch.mainEndHash = await hash()
  report.branch.mainEndEqualsFirstEnd = report.branch.mainEndHash === report.scrubHash[1]
  report.branch.step0EqualsFirstStep0 = report.branch.mainStep0Hash === report.scrubHash[0]

  // --- 8. controls: salt controls, badges, start-only marking
  report.saltControls = JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('.control')].filter((c) => /^(salt|weld|cover|nSalt)/.test(c.dataset.param)).map((c) => ({ param: c.dataset.param, label: c.querySelector('label, .label, span')?.innerText?.trim().slice(0, 70), tag: c.querySelector('[data-testid=source-tag]')?.textContent.trim() ?? 'NO TAG', startOnlyNote: /Set at the start/.test(c.textContent) })))`))
  await ev(`document.querySelectorAll('section.controls details').forEach((d) => { d.open = true })`)
  report.controlsWithoutTag = await ev(`[...document.querySelectorAll('.control')].filter((c) => !c.querySelector('[data-testid=source-tag]')).map((c) => c.dataset.param)`)
  await ev(`document.querySelector('section.controls')?.scrollIntoView({ block: 'start' })`)
  await shot('controls-salt-page.png'); await ev('window.scrollTo(0, 0)')

  // --- 9. physics checks panel (back on the main run, salt preset)
  await clickText('Run checks')
  await until(`!!document.querySelector('[data-testid=checks-summary]')`, 'checks', 600000)
  report.checks = JSON.parse(await ev(`JSON.stringify({ summary: document.querySelector('[data-testid=checks-summary]').textContent.replace(/\\s+/g, ' ').trim(), rows: [...document.querySelectorAll('[data-testid=check-row]')].map((r) => r.textContent.replace(/\\s+/g, ' ').trim().slice(0, 200)) })`))
  await ev(`document.querySelector('[data-testid=checks-summary]')?.scrollIntoView({ block: 'center' })`)
  await shot('checks-page.png'); await ev('window.scrollTo(0, 0)')

  // --- 9b. weld hunt: a fresh Gulf run with the fastest salt the registry allows and double supply (welds one column; found in a
  // Node run first, see the handoff). Scan the end of the run.
  await setSelect('Scenario preset', 'last3'); await settle(); await setSelect('Scenario preset', 'gulf'); await settle()
  const setCtl = (param, v) => ev(`(() => { const i = document.querySelector('.control[data-param="${param}"] input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, '${v}'); i.focus(); i.blur(); return true })()`)
  await setCtl('saltVisc', '1e17'); await sleep(1500); await settle()
  await setCtl('supply', '646'); await sleep(1500); await settle()
  report.weldHunt = { supplyShown: await ev(`document.querySelector('.control[data-param="supply"] input')?.value`), viscShown: await ev(`document.querySelector('.control[data-param="saltVisc"] input')?.value`), legend: await ev(`document.querySelector('[data-testid=salt-legend]')?.innerText ?? null`), rows: [] }
  await sliderTo(await sliderMax())
  for (let j = 60; j <= 140 && !report.weldHunt.first; j++) { const f = (j + 0.5) / 400
    await clickCanvasFrac(f)
    const w = await wellState()
    const t = (w.note ?? '').match(/\((\d[\d,]*) ft thick\)/)?.[1]
    const row = { f: Number(f.toFixed(2)), salt: w.salt, weld: w.weld, thickFt: t ? Number(t.replace(/,/g, '')) : 0, note: w.weld ? w.note : undefined }
    if (row.weld) report.weldHunt.rows.push(row)
    if (row.weld && !report.weldHunt.first) { report.weldHunt.first = row; await ev(`document.querySelector('section.well svg')?.scrollIntoView({ block: 'center' })`); await shot('well-weld-page.png'); await ev('window.scrollTo(0, 0)') }
  }
  await canvasPng('thin-salt-end-canvas.png'); await shot('thin-salt-end-page.png')
  report.weldHunt.nWeldColumns = report.weldHunt.rows.length

  // --- 10. display scaling: 100 / 125 / 150 %, redraw (mode change + scrub) must not grow the canvas
  report.scaling = {}
  await setSelect('Scenario preset', 'last3'); await settle(); await setSelect('Scenario preset', 'gulf'); await settle()
  const nS = await sliderMax()
  for (const dpr of [1, 1.25, 1.5]) {
    await metrics(dpr); await sleep(700)
    const before = await saltPixels(); const t0 = await tops()
    for (let k = 0; k < 3; k++) { await showMode('age', 'Age'); await showMode('salt', 'Salt thickness'); await sliderTo(Math.round(nS * (0.3 + 0.2 * k))); await showMode('grain', 'Grain size') }
    const after = await saltPixels(); const t1 = await tops()
    report.scaling[dpr] = { canvasBefore: [before.w, before.h, before.cssW, before.cssH], canvasAfter: [after.w, after.h, after.cssW, after.cssH], grew: after.cssH !== before.cssH || after.cssW !== before.cssW, tops: t0, topsAfter: t1 }
    await shot(`scale-${String(dpr).replace('.', '')}-page.png`)
  }
  await metrics(1)

  // --- 11. the old 3 Myr / miocene presets without salt look the same: salt legend and salt button are absent
  await setSelect('Scenario preset', 'last3'); await settle()
  report.backToDefault = { saltPx: (await saltPixels()).n, saltButton: await ev(`!![...document.querySelectorAll('button[aria-pressed]')].find((b) => b.textContent.trim() === 'Salt thickness')`), wellSalt: (await wellState()).salt }

  failed = false
} catch (e) {
  report.fatal = String(e && e.stack ? e.stack : e)
} finally {
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1))
  proc.kill()
  console.log(JSON.stringify(report, null, 1).slice(0, 14000))
  process.exit(failed ? 1 : 0)
}

// M3.9 browser re-review (derived from m3-views-browser.mjs): drives dist/strata-lab.html from file:// in headless Chrome
// (CDP, own --user-data-dir). Records: text of every salt-related (i) button, the Gulf preset at mid-run and end,
// pseudo-wells through a weld, a minibasin and a diapir (columns chosen from the independent engine run in
// m3-rereview.mjs), rewind/branch with salt on, and canvas/panel tops at 100/125/150 % scaling.
//   npm run build && node scripts/review/m3-rereview-browser.mjs <outDir>   (outDir: a scratch dir, not the repo)
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
  const bands = () => ev(`(() => { const c = document.getElementById("section-canvas"); const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; const out = []; for (let by = 0; by < 4; by++) { const row = []; for (let bx = 0; bx < 8; bx++) { let h = 2166136261; for (let y = Math.floor(by * c.height / 4); y < Math.floor((by + 1) * c.height / 4); y++) for (let x = Math.floor(bx * c.width / 8); x < Math.floor((bx + 1) * c.width / 8); x++) { const i = (y * c.width + x) * 4; h = Math.imul(h ^ d[i] ^ (d[i + 1] << 8) ^ (d[i + 2] << 16), 16777619) } row.push((h >>> 0).toString(36)) } out.push(row.join(" ")) } return out })()`)
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
  // click EVERY salt-related (i) one at a time: open, read the role=note text next to it, close
  report.infoTexts = []
  const nInfo = await ev(`document.querySelectorAll('button[aria-label^="What"]').length`)
  for (let i = 0; i < nInfo; i++) {
    const row = await ev(`(() => { const b = document.querySelectorAll('button[aria-label^="What"]')[${i}]; const label = b.getAttribute('aria-label'); if (!/salt|older|cover|weld|pressure/i.test(label)) return { label, skipped: true }; b.click(); return { label, where: (b.closest('section') || b.parentElement).className } })()`)
    await sleep(250)
    if (!row.skipped) {
      row.text = await ev(`(() => { const b = document.querySelectorAll('button[aria-label^="What"]')[${i}]; return { expanded: b.getAttribute('aria-expanded'), text: b.parentElement.querySelector('[role=note]')?.innerText ?? null } })()`)
      if (i === 0) await shot('gulf-info-open-page.png')
      await ev(`document.querySelectorAll('button[aria-label^="What"]')[${i}].click()`)
      await sleep(100)
    }
    report.infoTexts.push(row)
  }
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
  for (const f of [0, 0.1, 0.25, 0.5, 0.75, 1]) { await sliderTo(Math.round(nSteps * f)); const p = await saltPixels(); report.scrub[f] = p.n; report.scrubHash[f] = await hash(); if (f === 0) { await canvasPng("gulf-step0-canvas.png"); report.step0Bands = await bands(); await ev(`(() => { const c = document.getElementById("section-canvas"); window.__a = new Uint8ClampedArray(c.getContext("2d").getImageData(0, 0, c.width, c.height).data); return 1 })()`); report.step0Well = await ev(`document.querySelector("section.well h2")?.innerText`) } }
  await sliderTo(nSteps); report.scrub.endAgain = (await saltPixels()).n; report.scrubHash.endAgain = await hash()
  { const pd = () => ev(`(() => { const c = document.getElementById("section-canvas"); const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; const a = window.__a; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] !== a[i] || d[i + 1] !== a[i + 1] || d[i + 2] !== a[i + 2]) n++; return n })()`); await sliderTo(0); report.step0Again = await pd(); { const u = await ev(`(() => { const c = document.getElementById("section-canvas"); const ctx = c.getContext("2d"); const d = ctx.getImageData(0, 0, c.width, c.height); const a = window.__a; const o = document.createElement("canvas"); o.width = c.width; o.height = c.height; const oc = o.getContext("2d"); const out = oc.createImageData(c.width, c.height); for (let i = 0; i < d.data.length; i += 4) { const df = d.data[i] !== a[i] || d.data[i + 1] !== a[i + 1] || d.data[i + 2] !== a[i + 2]; out.data[i] = df ? 255 : 255; out.data[i + 1] = df ? 0 : 255; out.data[i + 2] = df ? 0 : 255; out.data[i + 3] = 255 } oc.putImageData(out, 0, 0); return o.toDataURL("image/png") })()`); writeFileSync(join(OUT, "step0-diff.png"), Buffer.from(u.split(",")[1], "base64")); await canvasPng("step0-again-canvas.png") } await sliderTo(0); report.step0Again2 = await pd(); await sliderTo(nSteps) }

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
  // explicit columns from the independent engine run (m3-rereview.mjs gulf): weld 35-37 km, diapir crest 32.5 and 47.5 km, minibasin 44.5 km
  for (const [name, km0] of [['weldcol', 36.5], ['diapircol', 32.5], ['diapir2col', 47.5], ['minibasincol', 75.5], ['pilecol', 354.5]]) {
    found[name] = { f: (km0 - 0.5 + 0.5) / 400 + 0 }
  }
  for (const [name, row] of Object.entries(found)) {
    if (!row) continue
    await clickCanvasFrac(row.f)
    report.wells[`pick-${name}`] = await wellState()
    await ev(`document.querySelector('section.well svg')?.scrollIntoView({ block: 'center' })`)
    await shot(`well-${name}-page.png`)
    await ev('window.scrollTo(0, 0)')
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
  await sliderTo(0); report.branch.mainStep0 = (await saltPixels()).n; report.branch.mainStep0Hash = await hash(); report.branch.mainStep0Bands = await bands(); report.branch.pixelDiff = await ev(`(() => { const c = document.getElementById("section-canvas"); const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; const a = window.__a; let n = 0, mx = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; for (let i = 0; i < d.length; i += 4) { const df = Math.max(Math.abs(d[i] - a[i]), Math.abs(d[i + 1] - a[i + 1]), Math.abs(d[i + 2] - a[i + 2])); if (df) { n++; mx = Math.max(mx, df); const p = i / 4, x = p % c.width, y = Math.floor(p / c.width); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) } } return { n, mx, box: [x0, y0, x1, y1], total: d.length / 4 } })()`); report.branch.selectedWell = await ev(`document.querySelector("section.well h2")?.innerText`); await canvasPng("main-step0-after-branch-canvas.png")
  await sliderTo(nSteps); report.branch.mainEndAgain = (await saltPixels()).n; report.branch.mainEndHash = await hash()
  report.branch.mainEndEqualsFirstEnd = report.branch.mainEndHash === report.scrubHash[1]
  report.branch.step0EqualsFirstStep0 = report.branch.mainStep0Hash === report.scrubHash[0]

  // --- 8. controls: salt controls, badges, start-only marking
  report.saltControls = JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('.control')].filter((c) => /^(salt|weld|cover|nSalt)/.test(c.dataset.param)).map((c) => ({ param: c.dataset.param, label: c.querySelector('label, .label, span')?.innerText?.trim().slice(0, 70), tag: c.querySelector('[data-testid=source-tag]')?.textContent.trim() ?? 'NO TAG', startOnlyNote: /Set at the start/.test(c.textContent) })))`))
  await ev(`document.querySelectorAll('section.controls details').forEach((d) => { d.open = true })`)
  report.controlsWithoutTag = await ev(`[...document.querySelectorAll('.control')].filter((c) => !c.querySelector('[data-testid=source-tag]')).map((c) => c.dataset.param)`)
  await ev(`document.querySelector('section.controls')?.scrollIntoView({ block: 'start' })`)
  await shot('controls-salt-page.png'); await ev('window.scrollTo(0, 0)')

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

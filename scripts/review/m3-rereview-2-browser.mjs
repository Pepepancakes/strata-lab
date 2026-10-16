// M3.12 browser re-review 2 (derived from m3-rereview-browser.mjs): built dist/strata-lab.html from file:// in headless Chrome (CDP, own
// --user-data-dir). Gulf preset at the end at 100/125/150 % scaling, pseudo-wells through the basinward salt limit, console errors and external requests.
//   npm run build && node scripts/review/m3-rereview-2-browser.mjs <outDir>   (outDir: a scratch dir, not the repo)
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
  const saltPixels = () => ev(`(() => { const c = document.getElementById('section-canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0, tot = 0; for (let i = 0; i < d.length; i += 4 * 7) { tot++; if (d[i] > 150 && d[i] - d[i + 1] > 55 && d[i + 2] > d[i + 1]) n++ } return { n, tot, w: c.width, h: c.height, cssW: c.clientWidth, cssH: c.clientHeight, mode: c.dataset.drawnMode } })()`)
  const tops = () => ev(`(() => { const top = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top + scrollY), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) } }; return { section: top('#section-canvas'), well: top('section.well svg'), wellRegion: top('section.well'), controls: top('section.controls'), right: top('section.right'), docH: document.documentElement.scrollHeight } })()`)
  const wellState = () => ev(`(() => ({ km: document.querySelector('section.well h2')?.innerText, salt: [...document.querySelectorAll('[data-testid=well-salt]')].length, weld: !!document.querySelector('[data-testid=well-weld]'), note: document.querySelector('[data-testid=well-salt-note]')?.innerText ?? null, svgText: [...document.querySelectorAll('section.well svg text')].map((t) => t.textContent).filter((t) => /salt|weld|top|base|pores/.test(t)) }))()`)

  await send('Page.navigate', { url: pathToFileURL(APP).href })
  await settle()

  // --- 1. Gulf preset, end of run
  await setSelect('Scenario preset', 'gulf')
  await settle()
  const nSteps = await sliderMax()
  report.nSteps = nSteps
  await clickCanvasFrac(0.5)
  report.gulfEnd = { saltPx: await saltPixels(), buttons: await ev(`[...document.querySelectorAll('button[aria-pressed]')].map((b) => b.textContent.trim())`) }
  await canvasPng('gulf-end-grain-canvas.png'); await shot('gulf-end-page.png')
  await showMode('salt', 'Salt thickness')
  report.gulfSaltMode = await saltPixels()
  report.saltLegend = await ev(`document.querySelector('[data-testid=salt-legend]')?.innerText ?? null`)
  await canvasPng('gulf-end-salt-canvas.png'); await shot('gulf-end-salt-page.png')
  await showMode('grain', 'Grain size')

  // --- 2. pseudo-wells through the basinward salt limit (km along the section; the canvas spans the 400 km section)
  report.wells = {}
  for (const km0 of [150, 200, 220, 235, 245, 270, 286.5, 320, 340, 350, 356, 360, 380, 395]) {
    await clickCanvasFrac(km0 / 400)
    const w = await wellState()
    const thick = (w.note ?? '').match(/\((\d[\d,]*) ft thick\)/)?.[1]
    report.wells[km0] = { km: w.km, saltIntervals: w.salt, weld: w.weld, thickFt: thick ? Number(thick.replace(/,/g, '')) : 0, note: w.note }
    if ([235, 286.5, 356, 380].includes(km0)) {
      await ev(`document.querySelector('section.well svg')?.scrollIntoView({ block: 'center' })`)
      await shot(`well-${km0}-page.png`)
      await ev('window.scrollTo(0, 0)')
    }
  }

  // --- 3. display scaling 100 / 125 / 150 %, Gulf at the end, redraw must not grow the canvas
  report.scaling = {}
  await setSelect('Scenario preset', 'last3'); await settle(); await setSelect('Scenario preset', 'gulf'); await settle()
  const nS = await sliderMax()
  for (const dpr of [1, 1.25, 1.5]) {
    await metrics(dpr); await sleep(700)
    await sliderTo(nS)
    const before = await saltPixels(); const t0 = await tops()
    for (let k = 0; k < 3; k++) { await showMode('age', 'Age'); await showMode('salt', 'Salt thickness'); await sliderTo(Math.round(nS * (0.3 + 0.2 * k))); await showMode('grain', 'Grain size') }
    await sliderTo(nS)
    const after = await saltPixels(); const t1 = await tops()
    report.scaling[dpr] = { canvasBefore: [before.w, before.h, before.cssW, before.cssH], canvasAfter: [after.w, after.h, after.cssW, after.cssH], grew: after.cssH !== before.cssH || after.cssW !== before.cssW, saltPx: after.n, tops: t0, topsAfter: t1 }
    await canvasPng(`scale-${String(dpr).replace('.', '')}-canvas.png`)
    await shot(`scale-${String(dpr).replace('.', '')}-page.png`)
  }
  await metrics(1)

  // --- 4. the salt-off default has no salt button, legend or well salt
  await setSelect('Scenario preset', 'last3'); await settle()
  report.backToDefault = { saltButton: await ev(`!![...document.querySelectorAll('button[aria-pressed]')].find((b) => b.textContent.trim() === 'Salt thickness')`), wellSalt: (await wellState()).salt, saltLegend: await ev(`!!document.querySelector('[data-testid=salt-legend]')`) }

  failed = false
} catch (e) {
  report.fatal = String(e && e.stack ? e.stack : e)
} finally {
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1))
  proc.kill()
  console.log(JSON.stringify(report, null, 1).slice(0, 14000))
  process.exit(failed ? 1 : 0)
}

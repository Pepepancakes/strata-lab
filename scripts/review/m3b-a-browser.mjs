// M3b.4 browser pass: drives the BUILT dist/strata-lab.html from file:// in headless Chrome over CDP (own profile,
// fresh state) at 100 %, 125 % and 150 % display scaling (deviceScaleFactor, handover trap "canvas size at display
// scaling"). On the Gulf preset it clicks the row of one crest and records:
//   - the table row of that crest (F, A, F - A, A/F, label) as shown
//   - the marker of that crest: label letter, position against the canvas (x from the column, y from the seafloor
//     pixel found in the canvas), size of the hit target
//   - the two CSV exports (captured from the Blob, not from disk), the crest's row in each, to compare with the table
//   - console errors and warnings, external requests, canvas backing/css size before and after a redraw
//
//   npm run build && node scripts/review/m3b-a-browser.mjs <outDir> [crestId]
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createServer } from 'vite'

const OUT = resolve(process.argv[2] ?? 'm3b-a-browser-out')
let CREST = Number(process.argv[3] ?? 5) // 0 = take the first crest in the table (ids move when the physics does)
const APP = resolve('dist/strata-lab.html')
if (!existsSync(APP)) throw new Error(`${APP} missing (npm run build first)`)
mkdirSync(OUT, { recursive: true })

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const vs = await createServer({ root, configFile: false, appType: 'custom', logLevel: 'error', server: { middlewareMode: true, hmr: false, watch: null, fs: { strict: false } }, optimizeDeps: { noDiscovery: true, include: [] } })
const GP = (await vs.ssrLoadModule('/src/engine/presets.ts')).presetParams('gulf')
await vs.close()
const NX = GP.nx

const chrome = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find((p) => existsSync(p))
if (!chrome) throw new Error('No Chrome/Edge found; set CHROME=path')
const port = 9200 + Math.floor(Math.random() * 500)
const profile = mkdtempSync(join(tmpdir(), 'strata-m3ba-'))
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu', '--window-size=1440,1700', 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const report = { nx: NX, errors: [], externalRequests: [], perDpr: {} }
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
  const save = (name, b64) => writeFileSync(join(OUT, name), Buffer.from(b64, 'base64'))
  const shot = async (name) => save(name, (await send('Page.captureScreenshot', { format: 'png' })).result.data)
  const canvasPng = async (name) => save(name, (await ev(`document.getElementById('section-canvas').toDataURL('image/png')`)).split(',')[1])
  const metrics = (dpr) => send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1700, deviceScaleFactor: dpr, mobile: false })
  const appReady = `!document.querySelector('.busy') && !!document.getElementById('section-canvas') && document.body.innerText.includes('Mass balance')`
  const setSelect = (label, value) => ev(`(() => { const s = document.querySelector('select[aria-label="${label}"]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, '${value}'); s.dispatchEvent(new Event('change', { bubbles: true })); return true })()`)
  const settle = async () => { await sleep(600); await ev(`[...document.querySelectorAll('[data-testid=replace-warning] button')].find((b) => b.textContent.trim() === 'Replace')?.click()`); await sleep(400); await until(appReady, 'the app to finish running'); await sleep(800) }
  const canvasInfo = () => ev(`(() => { const c = document.getElementById('section-canvas'); const r = c.getBoundingClientRect(); return { w: c.width, h: c.height, cssW: c.clientWidth, cssH: c.clientHeight, left: r.left, top: r.top } })()`)

  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable')
  for (const dpr of [1, 1.25, 1.5]) {
    await metrics(dpr)
    await send('Page.navigate', { url: pathToFileURL(APP).href })
    await settle()
    await setSelect('Scenario preset', 'gulf')
    await settle()
    const before = await canvasInfo()
    if (!CREST) CREST = Number(await ev(`/Go to crest (\\d+),/.exec(document.querySelector('button[aria-label^="Go to crest "]').getAttribute('aria-label'))[1]`))
    report.allRows ??= await ev(`[...document.querySelectorAll('[data-crest-row]')].map((tr) => [...tr.children].map((td) => td.innerText.replace(/\\s+/g, ' ').trim()))`)
    // capture the CSV blobs
    await ev(`(() => { window.__csv = []; const o = URL.createObjectURL.bind(URL); URL.createObjectURL = (b) => { b.text().then((t) => window.__csv.push(t)); return o(b) }; return true })()`)
    const tableText = await ev(`!!document.querySelector('[data-testid=crest-table]')`)
    if (!tableText) throw new Error('no crest table in the built file')
    // go to the crest's last record by clicking its row button
    await ev(`document.querySelector('button[aria-label^="Go to crest ${CREST},"]').click()`)
    await sleep(800); await until(`!document.querySelector('.busy')`, 'go to crest'); await sleep(800)
    const row = await ev(`(() => { const tr = document.querySelector('[data-crest-row="${CREST}"]'); return tr ? [...tr.children].map((td) => td.innerText.replace(/\\s+/g, ' ').trim()) : null })()`)
    const marker = await ev(`(() => { const b = document.querySelector('[data-crest="${CREST}"]'); if (!b) return null; const r = b.getBoundingClientRect(); const svg = b.querySelector('svg'); const sr = svg.getBoundingClientRect(); return { label: b.dataset.label, letter: b.querySelector('text')?.textContent, ariaLabel: b.getAttribute('aria-label'), title: b.title, hit: { w: r.width, h: r.height }, glyph: { left: sr.left, right: sr.right, top: sr.top, bottom: sr.bottom }, pressed: b.getAttribute('aria-pressed') } })()`)
    // every marker: its glyph bottom against the dark pixel at its own column (km from its aria-label)
    const allMarkers = await ev(`(() => { const c = document.getElementById('section-canvas'); const cr = c.getBoundingClientRect(); const ctx = c.getContext('2d'); return [...document.querySelectorAll('[data-crest]')].map((b) => { const km = Number(/x ([0-9.]+) km/.exec(b.title)[1]); const gr = b.querySelector('svg').getBoundingClientRect(); const x = Math.round(((gr.left + gr.right) / 2 - cr.left) * (c.width / c.clientWidth)); const col = Math.round((x / c.width) * ${NX} - 0.5); const d = ctx.getImageData(x, 0, 1, c.height).data; let y = -1; for (let i = 0; i < c.height; i++) { const o = i * 4; if (d[o] + d[o+1] + d[o+2] < 480) { y = i; break } } const g = b.querySelector('svg').getBoundingClientRect(); return { id: b.dataset.crest, label: b.dataset.label, letter: b.querySelector('text')?.textContent, km, glyphBottomCss: g.bottom, seafloorCss: cr.top + y / (c.height / c.clientHeight), gapCss: g.bottom - (cr.top + y / (c.height / c.clientHeight)) } }) })()`)
    const key = await ev(`document.querySelector('[data-testid=crest-key]')?.innerText ?? null`)
    const ci = await canvasInfo()
    // seafloor pixel in the canvas at the crest's column: first non-white pixel from the top; the crest's column from its km
    const km = Number(row?.[1]) || 0 // the list has no km column since UI-2 (D25); the seafloor-gap fields below are only meaningful for the marker rows
    const col = Math.round((km * 1000) / GP.dx - 0.5)
    const px = await ev(`(() => { const c = document.getElementById('section-canvas'); const x = Math.round(((${col} + 0.5) / ${NX}) * c.width); const d = c.getContext('2d').getImageData(x, 0, 1, c.height).data; let y = -1; for (let i = 0; i < c.height; i++) { const o = i * 4; if (d[o] + d[o+1] + d[o+2] < 480) { y = i; break } } /* water is light blue (sum > 600); sediment and salt are darker */ return { x, y, scaleY: c.height / c.clientHeight, scaleX: c.width / c.clientWidth } })()`)
    const seafloorCssY = ci.top + px.y / px.scaleY
    const expectX = ci.left + ((col + 0.5) / NX) * ci.cssW
    const markerCx = marker ? (marker.glyph.left + marker.glyph.right) / 2 : null
    // exports
    await ev(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Export crests (CSV)').click()`); await sleep(500)
    await ev(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Export crest records (CSV)').click()`); await sleep(500)
    const csv = await ev(`window.__csv`)
    const parse = (t) => { const lines = t.split('\n').filter((l) => l && !l.startsWith('#')); const h = lines[0].split(','); return lines.slice(1).map((l) => Object.fromEntries(l.split(',').map((v, i) => [h[i], v]))) }
    const all1 = csv[0] ? parse(csv[0]) : []
    const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2 }
    const chromeSummary = { n: all1.length, tabular: all1.filter((r) => r.label === 'tabular').length, tapered: all1.filter((r) => r.label === 'tapered').length, unresolved: all1.filter((r) => r.label === 'unresolved').length, medFminusA_ftMyr: med(all1.map((r) => Number(r.F_minus_A_near_ft_per_myr))), medA_ftMyr: med(all1.map((r) => Number(r.A_near_ft_per_myr))) }
    console.log(`dpr ${dpr} Chrome crest CSV summary: ${JSON.stringify(chromeSummary)}`)
    const t1 = csv[0] ? parse(csv[0]).find((r) => r.crest_id === String(CREST)) : null
    const nRec = csv[1] ? parse(csv[1]).filter((r) => r.crest_id === String(CREST)).length : null
    // redraw: change the step and back, then compare canvas size
    await ev(`(() => { const r = document.querySelector('input[type=range]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; const v = r.value; set.call(r, String(Math.max(0, Number(v) - 20))); r.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
    await sleep(1200)
    const after = await canvasInfo()
    await canvasPng(`canvas-dpr${dpr}.png`); await shot(`page-dpr${dpr}.png`)
    report.perDpr[dpr] = {
      canvasBefore: before, canvasAtCrest: ci, canvasAfterRedraw: after,
      tableRow: row, marker, allMarkers, key,
      markerVsCanvas: { col, expectXcss: expectX, markerCentreXcss: markerCx, dxCss: markerCx === null ? null : markerCx - expectX, seafloorCssY, glyphBottomCss: marker?.glyph.bottom, dyCss: marker ? marker.glyph.bottom - seafloorCssY : null },
      csvTableRow: t1, csvRecordRows: nRec, csvFiles: csv.length,
    }
  }
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1))
  for (const [d, p] of Object.entries(report.perDpr)) {
    console.log(`dpr ${d}: canvas ${p.canvasBefore.w}x${p.canvasBefore.h} (css ${p.canvasBefore.cssW}x${p.canvasBefore.cssH}) after redraw ${p.canvasAfterRedraw.w}x${p.canvasAfterRedraw.h}; table row ${p.tableRow?.join(' | ')}; csv row F ${p.csvTableRow?.F_near_ft_per_myr} A ${p.csvTableRow?.A_near_ft_per_myr} F-A ${p.csvTableRow?.F_minus_A_near_ft_per_myr} label ${p.csvTableRow?.label}; records ${p.csvRecordRows}`)
    console.log(`   marker of crest ${CREST}: ${p.marker?.letter} ${p.marker?.label} hit ${p.marker?.hit.w}x${p.marker?.hit.h}; x offset ${p.markerVsCanvas.dxCss} css px`)
    for (const m of p.allMarkers) console.log(`   marker ${m.id} ${m.letter} ${m.label} km ${m.km}: glyph bottom ${m.glyphBottomCss.toFixed(1)}, seafloor ${m.seafloorCss.toFixed(1)}, gap ${m.gapCss.toFixed(1)} css px`)
  }
  console.log(`errors: ${report.errors.length}, external requests: ${report.externalRequests.length}`)
  failed = false
  ws.close()
} catch (e) {
  console.error(String(e?.stack ?? e))
} finally {
  proc.kill()
  process.exit(failed ? 1 : 0)
}

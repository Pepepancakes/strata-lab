// M4.6 integrity review, browser part: drives the BUILT file (dist/strata-lab.html) from file:// in headless Chrome
// and saves what the hand-calculation script (m4-review.mjs) checks. Own code; nothing from src/ is imported.
//   1. For the default (last3) and Gulf presets: plan a well with the panel's own controls, export the CSV for three wells
//      (vertical; build-and-hold toward the basin; build-and-hold toward the land) and, for the vertical well, a second CSV with
//      Matthews & Kelly selected. The CSVs are the app's output; m4-review.mjs recomputes every station from the record.
//   2. At 100, 125 and 150 % display scaling (deviceScaleFactor 1, 1.25, 1.5), default preset, vertical well: the positions of the
//      panels, the section canvas backing size before and after a redraw (it must not grow), the PNG and CSV downloads (bytes,
//      PNG magic, pixel size), console errors and external requests.
// Usage: npm run build && node scripts/review/m4-review-browser.mjs <outDir>
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const APP = resolve('dist/strata-lab.html')
if (!existsSync(APP)) throw new Error('dist/strata-lab.html missing: run npm run build first')
const outDir = resolve(process.argv[2] || 'm4-review-out')
mkdirSync(outDir, { recursive: true })
const chrome = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find((p) => existsSync(p))
if (!chrome) throw new Error('No Chrome/Edge found; set CHROME=path')

const port = 9400 + Math.floor(Math.random() * 400)
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${join(outDir, 'profile')}`, '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const report = { errors: [], externalRequests: [], checks: [], scaling: {}, csv: {} }
let fails = 0
const check = (name, ok, detail = '') => { report.checks.push({ name, ok: !!ok, detail }); if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`) }

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
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && waiting.has(m.id)) return waiting.get(m.id)(m)
    if (m.method === 'Runtime.exceptionThrown') report.errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text)
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) report.errors.push(`console.${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description).join(' ')}`)
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') report.errors.push(`${m.params.entry.text} ${m.params.entry.url ?? ''}`)
    if (m.method === 'Network.requestWillBeSent') { const u = m.params.request.url; if (!/^(file:|data:|blob:|about:)/.test(u)) report.externalRequests.push(u) }
  }
  const send = (method, params = {}) => new Promise((r) => { const id = ++seq; waiting.set(id, r); ws.send(JSON.stringify({ id, method, params })) })
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'evaluate failed')
    return r.result?.result?.value
  }
  const until = async (expr, what, ms = 300000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < ms) { if (await ev(expr)) return; await sleep(150) }
    throw new Error(`timeout waiting for ${what}; errors=${JSON.stringify(report.errors.slice(0, 3))}; text=${JSON.stringify((await ev('document.body.innerText')).slice(0, 400))}`)
  }
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable'); await send('Network.enable'); await send('DOM.enable')
  const idle = `!document.querySelector('.busy')`
  const ready = `${idle} && !!document.getElementById('section-canvas') && document.body.innerText.includes('Mass balance') && document.querySelectorAll('ul.branches li').length > 0`
  const clickText = (text) => ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(text)}); if (!b) throw new Error('no button ' + ${JSON.stringify(text)}); b.click(); return true })()`)
  const setSelectByOption = (optionText, value) => ev(`(() => { const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.textContent.trim() === ${JSON.stringify(optionText)})); if (!sel) throw new Error('no select with option ' + ${JSON.stringify(optionText)}); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, ${JSON.stringify(value)}); sel.dispatchEvent(new Event('change', { bubbles: true })); return true })()`)
  const plotReady = `!!document.querySelector('[data-testid=pressure-plot]') && !!document.querySelector('[data-testid=well-export]') && !document.querySelector('[data-testid=well-problems]') && ${idle}`
  const waitFile = async (dir, ext) => {
    for (let i = 0; i < 200; i++) { const f = readdirSync(dir).find((n) => n.endsWith(ext)); if (f) { await sleep(400); return join(dir, f) } await sleep(150) }
    throw new Error(`no ${ext} file was downloaded to ${dir}`)
  }
  let dlSeq = 0
  const download = async (button, ext, keepAs) => {
    const dir = join(outDir, 'dl', String(++dlSeq))
    mkdirSync(dir, { recursive: true })
    await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir, eventsEnabled: true })
    await clickText(button)
    const f = await waitFile(dir, ext)
    const dest = join(outDir, keepAs)
    copyFileSync(f, dest)
    return dest
  }
  const metrics = (dpr) => send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1800, deviceScaleFactor: dpr, mobile: false })
  const openFresh = async (dpr) => {
    await metrics(dpr)
    await send('Page.navigate', { url: pathToFileURL(APP).href })
    await sleep(500)
    await ev('localStorage.clear()')
    await send('Page.navigate', { url: pathToFileURL(APP).href })
    await sleep(500)
    await until(ready, 'the app to finish the default run')
    await sleep(300)
  }
  const choosePreset = async (id) => {
    await ev(`(() => { const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === ${JSON.stringify(id)})); if (!sel) throw new Error('no preset select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, ${JSON.stringify(id)}); sel.dispatchEvent(new Event('change', { bubbles: true })); return true })()`)
    await sleep(1500) // the run starts (busy) after the change
    await until(`${ready} && document.querySelector('select[aria-label="Scenario preset"]').value === ${JSON.stringify(id)}`, `preset ${id} to run`)
    await sleep(500)
  }
  const wellText = () => ev(`document.querySelector('[data-testid=well-flags]')?.innerText ?? ''`)
  const tops = () => ev(`(() => { const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top + scrollY), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) } }; const c = document.getElementById('section-canvas'); return { section: box('#section-canvas'), controls: box('section.controls'), right: box('section.right'), wellRegion: box('section.well'), plot: box('[data-testid=pressure-plot]'), wellPlan: box('[data-testid=well-plan]'), docH: document.documentElement.scrollHeight, canvas: c ? { w: c.width, h: c.height, cssW: c.clientWidth, cssH: c.clientHeight } : null, dpr: devicePixelRatio } })()`)

  // ---- 1. the six wells (100 %), CSVs for the hand calculation --------------------------------------------------------
  await openFresh(1)
  for (const preset of ['last3', 'gulf']) {
    if (preset !== 'last3') await choosePreset(preset)
    await clickText('Plan a well here')
    await until(plotReady, 'the pressure plot')
    await sleep(300)
    const wells = [
      { tag: 'vertical', setup: async () => {} },
      { tag: 'j-basinward', setup: async () => { await setSelectByOption('Build and hold', 'build-and-hold'); await sleep(200); await setSelectByOption('Toward the basin', 'basinward') } },
      { tag: 'j-landward', setup: async () => { await setSelectByOption('Build and hold', 'build-and-hold'); await sleep(200); await setSelectByOption('Toward the land', 'landward') } },
    ]
    for (const w of wells) {
      await w.setup()
      await sleep(400)
      await until(plotReady, `${preset} ${w.tag} plot`)
      await sleep(400)
      const methods = w.tag === 'vertical' ? [['eaton', 'Eaton (1969)'], ['matthews-kelly', 'Matthews & Kelly (1967)']] : [['eaton', 'Eaton (1969)']]
      for (const [m, name] of methods) {
        await setSelectByOption('Eaton (1969)', m)
        await sleep(400)
        await until(plotReady, `${preset} ${w.tag} ${m} plot`)
        const f = await download('Export stations (CSV)', '.csv', `${preset}-${w.tag}-${m}.csv`)
        const text = readFileSync(f, 'utf8')
        const n = text.split(/\r?\n/).filter((l) => l !== '' && !l.startsWith('#')).length - 1
        report.csv[`${preset}-${w.tag}-${m}`] = { file: f, rows: n, bytes: text.length, flags: await wellText(), wellLine: text.split('\n').find((l) => l.startsWith('# well:')) }
        check(`${preset} ${w.tag} ${m}: CSV downloaded with ${n} rows and the method in the header`, n > 100 && text.includes(name), `${f}`)
      }
      await setSelectByOption('Eaton (1969)', 'eaton')
      await sleep(300)
    }
    await clickText('Remove well')
    await sleep(300)
    await until(`${idle} && !document.querySelector('[data-testid=pressure-plot]')`, 'well removed')
  }
  check('six wells: 0 console errors so far', report.errors.length === 0, report.errors.slice(0, 3).join(' | '))

  // ---- 2. display scaling 100 / 125 / 150 %, default preset, vertical well ---------------------------------------------
  const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  for (const dpr of [1, 1.25, 1.5]) {
    const tag = `${Math.round(dpr * 100)}%`
    const errBefore = report.errors.length
    await openFresh(dpr)
    const t0 = await tops()
    await clickText('Plan a well here')
    await until(plotReady, `${tag} plot`)
    await sleep(400)
    const t1 = await tops()
    // force redraws: move the time slider and back, then read the canvas again
    await ev(`(() => { const el = document.querySelector('input[type=range][aria-label=Time]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, String(Math.max(0, Number(el.max) - 5))); el.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
    await sleep(600); await until(idle, 'redraw')
    await ev(`(() => { const el = document.querySelector('input[type=range][aria-label=Time]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, el.max); el.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
    await sleep(600); await until(idle, 'redraw')
    const t2 = await tops()
    const png = await download('Export plot (PNG)', '.png', `scale-${Math.round(dpr * 100)}.png`)
    const pb = readFileSync(png)
    const csv = await download('Export stations (CSV)', '.csv', `scale-${Math.round(dpr * 100)}.csv`)
    const ct = readFileSync(csv, 'utf8')
    const t3 = await tops()
    report.scaling[tag] = { dpr: t1.dpr, before: t0, afterWell: t1, afterRedraw: t2, afterExport: t3, png: { bytes: pb.length, w: pb.readUInt32BE(16), h: pb.readUInt32BE(20) }, csv: { bytes: ct.length, rows: ct.split(/\r?\n/).filter((l) => l !== '' && !l.startsWith('#')).length - 1 }, errors: report.errors.slice(errBefore) }
    check(`${tag}: devicePixelRatio reported ${t1.dpr}`, Math.abs(t1.dpr - dpr) < 1e-9)
    check(`${tag}: canvas backing size does not grow across redraws and exports`, t1.canvas.w === t2.canvas.w && t1.canvas.h === t2.canvas.h && t2.canvas.w === t3.canvas.w && t2.canvas.h === t3.canvas.h && t1.canvas.cssH === t3.canvas.cssH, `${JSON.stringify(t1.canvas)} -> ${JSON.stringify(t3.canvas)}`)
    check(`${tag}: canvas backing = css size x dpr (within 2 px)`, Math.abs(t1.canvas.w - t1.canvas.cssW * dpr) <= 2 && Math.abs(t1.canvas.h - t1.canvas.cssH * dpr) <= 2, JSON.stringify(t1.canvas))
    check(`${tag}: section canvas and controls stay where they were after the well is planned`, t0.section.top === t1.section.top && t0.section.left === t1.section.left && t0.controls?.top === t1.controls?.top, `section ${JSON.stringify(t0.section)} -> ${JSON.stringify(t1.section)}; controls ${JSON.stringify(t0.controls)} -> ${JSON.stringify(t1.controls)}`)
    check(`${tag}: plot and panels are inside the 1440 px viewport width`, [t1.plot, t1.section, t1.wellPlan].every((b) => b && b.left >= 0 && b.left + b.w <= 1440 + 1), `plot ${JSON.stringify(t1.plot)} wellPlan ${JSON.stringify(t1.wellPlan)}`)
    check(`${tag}: PNG magic bytes, IEND, over 10 KB`, pb.subarray(0, 8).equals(PNG_MAGIC) && pb.subarray(pb.length - 8, pb.length - 4).toString('latin1') === 'IEND' && pb.length > 10240, `${pb.length} bytes, ${pb.readUInt32BE(16)}x${pb.readUInt32BE(20)}`)
    check(`${tag}: CSV has header, 14 columns and rows, no NaN`, /^# Strata Lab planned well/.test(ct) && ct.includes('md_ft,tvd_rkb_ft,tvdss_ft,x_km,material,porosity,pore_pressure_psi,pore_pressure_ppg,hydrostatic_ppg,overburden_ppg,fracture_gradient_ppg,window_ppg,temperature_f,branch') && !/NaN|undefined|Infinity/.test(ct), `${ct.length} bytes`)
    check(`${tag}: 0 console errors at this scaling`, report.errors.length === errBefore, report.errors.slice(errBefore, errBefore + 3).join(' | '))
  }
  const s = report.scaling
  check('PNG pixel size is the same at 100, 125 and 150 %', s['100%'].png.w === s['125%'].png.w && s['125%'].png.w === s['150%'].png.w && s['100%'].png.h === s['125%'].png.h && s['125%'].png.h === s['150%'].png.h, JSON.stringify([s['100%'].png, s['125%'].png, s['150%'].png]))
  check('CSV bytes are the same at 100, 125 and 150 % (the export does not depend on the display)', s['100%'].csv.bytes === s['125%'].csv.bytes && s['125%'].csv.bytes === s['150%'].csv.bytes, JSON.stringify([s['100%'].csv, s['125%'].csv, s['150%'].csv]))
  const a = readFileSync(join(outDir, 'scale-100.csv'), 'utf8'), b = readFileSync(join(outDir, 'scale-150.csv'), 'utf8')
  check('CSV text identical at 100 and 150 %', a === b)
  check('no console errors in the whole session', report.errors.length === 0, report.errors.slice(0, 5).join(' | '))
  check('no external requests', report.externalRequests.length === 0, report.externalRequests.slice(0, 3).join(' | '))
  ws.close()
} catch (e) {
  console.error(e)
  fails++
  report.fatal = String(e && e.stack || e)
} finally {
  proc.kill()
}
writeFileSync(join(outDir, 'browser-report.json'), JSON.stringify(report, null, 2))
console.log(`${fails ? 'BROWSER CHECKS FAILED' : 'BROWSER CHECKS OK'}: ${report.checks.length} checks, ${fails} failed; files in ${outDir}`)
process.exit(fails ? 1 : 0)

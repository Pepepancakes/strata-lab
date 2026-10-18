// AUD-4 browser pass: the BUILT dist/strata-lab.html from file:// in headless Chrome over CDP (own profile), Gulf
// preset, at 1920 x 1080 with 100 %, 125 % and 150 % scaling (CSS viewport = screen / scale, minus 130 px of
// browser chrome) and 2560 x 1440 at 125 % and 150 %. Records, with no edits to the app:
//   - the crest table (every row as shown), the crest count note, the CSV summary (count, labels, median F - A)
//   - the markers visible at the END of the run (the guide says there are none) and after moving back to 30 Ma
//   - a row click: selected row, the pseudo-well heading before and after (it must move to the crest's km)
//   - layout: top and bottom of the section canvas and of the crest panel, page scroll width (no horizontal scroll)
//   - the salt at the basinward toe as the app reports it: the pseudo-well moved to 335 km by a click on the section
//   - console errors and warnings, external requests
//   npm run build && node scripts/review/aud-04-browser.mjs <outDir>
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const OUT = resolve(process.argv[2] ?? 'aud-04-browser-out')
const APP = resolve('dist/strata-lab.html')
if (!existsSync(APP)) throw new Error(`${APP} missing (npm run build first)`)
mkdirSync(OUT, { recursive: true })
const chrome = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find((p) => existsSync(p))
if (!chrome) throw new Error('No Chrome/Edge found; set CHROME=path')
const port = 9200 + Math.floor(Math.random() * 500)
const profile = mkdtempSync(join(tmpdir(), 'strata-aud04-'))
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu', '--window-size=1920,1080', 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const report = { errors: [], externalRequests: [], screens: {} }
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
  const until = async (expr, what, ms = 300000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < ms) { if (await ev(expr)) return; await sleep(150) }
    throw new Error(`timeout waiting for ${what}; errors=${JSON.stringify(report.errors.slice(0, 3))}`)
  }
  const shot = async (name) => writeFileSync(join(OUT, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'))
  const appReady = `!document.querySelector('.busy') && !!document.getElementById('section-canvas') && document.body.innerText.includes('Mass balance')`
  const setSelect = (label, value) => ev(`(() => { const s = document.querySelector('select[aria-label="${label}"]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, '${value}'); s.dispatchEvent(new Event('change', { bubbles: true })); return true })()`)
  const settle = async () => { await sleep(600); await ev(`[...document.querySelectorAll('[data-testid=replace-warning] button')].find((b) => b.textContent.trim() === 'Replace')?.click()`); await sleep(400); await until(appReady, 'the app to finish running'); await sleep(800) }
  const rect = (sel) => ev(`(() => { const e = document.querySelector('${sel}'); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top + window.scrollY), bottom: Math.round(r.bottom + window.scrollY), left: Math.round(r.left), right: Math.round(r.right) } })()`)
  const markers = () => ev(`[...document.querySelectorAll('[data-crest]')].map((b) => ({ id: b.dataset.crest, label: b.dataset.label, letter: b.querySelector('text')?.textContent, title: b.title }))`)
  const rows = () => ev(`[...document.querySelectorAll('[data-crest-row]')].map((tr) => [...tr.children].map((td) => td.innerText.replace(/\\s+/g, ' ').trim()))`)
  const wellHead = () => ev(`[...document.querySelectorAll('h2')].map((h) => h.textContent).find((t) => t.startsWith('Pseudo-well')) ?? null`)
  const setStepTo = async (frac) => { await ev(`(() => { const r = document.querySelector('input[type=range]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(r, String(Math.round(Number(r.max) * ${frac}))); r.dispatchEvent(new Event('input', { bubbles: true })); return true })()`); await sleep(1200) }

  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable')
  const screens = [[1920, 1080, 1], [1920, 1080, 1.25], [1920, 1080, 1.5], [2560, 1440, 1.25], [2560, 1440, 1.5]]
  let csvDone = false
  for (const [sw, sh, dpr] of screens) {
    const w = Math.round(sw / dpr), h = Math.round(sh / dpr) - 130
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: false })
    await send('Page.navigate', { url: pathToFileURL(APP).href })
    await settle()
    await setSelect('Scenario preset', 'gulf')
    await settle()
    const key = `${sw}x${sh}@${dpr}`
    const r = { viewport: { w, h }, scrollWidth: await ev('document.documentElement.scrollWidth'), scrollHeight: await ev('document.documentElement.scrollHeight') }
    r.section = await rect('#section-canvas')
    r.crestPanel = await rect('[data-testid=crest-panel]')
    r.crestTable = await rect('[data-testid=crest-table]')
    r.note = await ev(`document.querySelector('[data-testid=crest-explain]')?.innerText ?? document.querySelector('[data-testid=crest-none]')?.innerText ?? null`)
    r.rowsAtEnd = await rows()
    r.markersAtEnd = await markers()
    r.wellBefore = await wellHead()
    await shot(`end-${key}.png`)
    // click the first row: the pseudo-well must move to the crest's km
    const firstId = r.rowsAtEnd[0]?.[0]
    if (firstId) {
      await ev(`document.querySelector('[data-crest-row="${firstId}"]').click()`)
      await sleep(800); await until(`!document.querySelector('.busy')`, 'row click'); await sleep(800)
      r.clicked = { id: firstId, selected: await ev(`document.querySelector('[data-crest-row="${firstId}"]')?.getAttribute('aria-selected')`), wellAfter: await wellHead(), wellNote: await ev(`document.querySelector('[data-testid=crest-well-note]')?.innerText ?? null`), card: await ev(`document.querySelector('[data-testid=crest-card]')?.innerText.slice(0, 600) ?? null`), markersNow: await markers(), ageShown: await ev(`document.body.innerText.match(/(\\d+\\.\\d+) Ma/)?.[1] ?? null`) }
      r.sectionAfterClick = await rect('#section-canvas')
      r.crestPanelAfterClick = await rect('[data-testid=crest-panel]')
      await shot(`clicked-${key}.png`)
    }
    // markers at about 30 Ma (step fraction 0.55 of 66 Myr)
    await setStepTo(0.55)
    r.markersMid = { age: await ev(`document.body.innerText.match(/(\\d+\\.\\d+) Ma/)?.[1] ?? null`), markers: await markers() }
    // the toe as the pseudo-well sees it: click the section at 335.5 km
    await setStepTo(1)
    const c = await ev(`(() => { const c = document.getElementById('section-canvas'); const r = c.getBoundingClientRect(); return { left: r.left, top: r.top, w: r.width, h: r.height } })()`)
    const nx = 400
    const x = c.left + ((335 + 0.5) / nx) * c.w, y = c.top + c.h * 0.5
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
    await sleep(1200)
    r.toeWell = { heading: await wellHead(), saltNote: await ev(`document.querySelector('[data-testid=well-salt-note]')?.innerText ?? null`), hasSalt: await ev(`!!document.querySelector('[data-testid=well-salt]')`), cappedNote: await ev(`document.querySelector('[data-testid=well-capped-note]')?.innerText ?? null`) }
    await shot(`toe-${key}.png`)
    if (!csvDone) {
      await ev(`(() => { window.__csv = []; const o = URL.createObjectURL.bind(URL); URL.createObjectURL = (b) => { b.text().then((t) => window.__csv.push(t)); return o(b) }; return true })()`)
      await ev(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Export crests (CSV)').click()`); await sleep(600)
      const csv = await ev(`window.__csv`)
      const lines = (csv[0] ?? '').split('\n').filter((l) => l && !l.startsWith('#'))
      const hd = lines[0]?.split(',') ?? []
      const recs = lines.slice(1).map((l) => Object.fromEntries(l.split(',').map((v, i) => [hd[i], v])))
      const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2 }
      report.csv = { header: hd, n: recs.length, tabular: recs.filter((q) => q.label === 'tabular').length, tapered: recs.filter((q) => q.label === 'tapered').length, unresolved: recs.filter((q) => q.label === 'unresolved').length, medFminusA_ft: med(recs.map((q) => Number(q.F_minus_A_near_ft_per_myr))), medA_ft: med(recs.map((q) => Number(q.A_near_ft_per_myr))), endReasons: recs.map((q) => `${q.crest_id}:${q.end_reason ?? q.ended ?? '?'}`), rows: recs }
      csvDone = true
    }
    report.screens[key] = r
    console.log(`${key}: viewport ${w}x${h}, scrollWidth ${r.scrollWidth}; section ${r.section?.top}-${r.section?.bottom}, crest panel ${r.crestPanel?.top}-${r.crestPanel?.bottom}, table ${r.crestTable?.top}-${r.crestTable?.bottom}; note "${r.note}"; rows ${r.rowsAtEnd.length}; markers at the end ${r.markersAtEnd.length} ${JSON.stringify(r.markersAtEnd)}; well before "${r.wellBefore}" -> after click on row ${r.clicked?.id}: "${r.clicked?.wellAfter}" (selected ${r.clicked?.selected}; age shown ${r.clicked?.ageShown}); markers at ${r.markersMid.age} Ma: ${r.markersMid.markers.length}; toe well: "${r.toeWell.heading}", salt drawn ${r.toeWell.hasSalt}, note "${(r.toeWell.saltNote ?? '').slice(0, 200)}"`)
  }
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1))
  console.log(`rows at the end (1920x1080@1): ${JSON.stringify(report.screens['1920x1080@1'].rowsAtEnd)}`)
  console.log(`csv: ${JSON.stringify({ ...report.csv, rows: undefined })}`)
  console.log(`errors: ${report.errors.length} ${JSON.stringify(report.errors.slice(0, 5))}, external requests: ${report.externalRequests.length}`)
  failed = false
  ws.close()
} catch (e) {
  console.error(String(e?.stack ?? e))
} finally {
  proc.kill()
  process.exit(failed ? 1 : 0)
}

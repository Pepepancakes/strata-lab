// UI-2 screen check (D25): drives the BUILT dist/strata-lab.html from file:// in headless Chrome over CDP.
// For each screen size (1920x1080 at 100, 125, 150 %; 2560x1440 at 125, 150 %; CSS viewport = screen / scale minus
// 130 px of browser chrome) it runs the Gulf preset, then reports the tops and bottoms (page coordinates) of the
// section, the crest list and the selected-crest card, the page scroll width, clicks crest 5 and checks that its
// marker ring is on screen without scrolling. Then Saltshort (list present) and last3 (no list).
//
//   npm run build && node scripts/review/ui02-screens.mjs <outDir> [crestId]
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const OUT = resolve(process.argv[2] ?? 'ui02-out')
const CREST = Number(process.argv[3] ?? 5)
const APP = resolve('dist/strata-lab.html')
if (!existsSync(APP)) throw new Error(`${APP} missing (npm run build first)`)
mkdirSync(OUT, { recursive: true })

const chrome = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find((p) => existsSync(p))
if (!chrome) throw new Error('No Chrome/Edge found; set CHROME=path')
const port = 9700 + Math.floor(Math.random() * 200)
const profile = mkdtempSync(join(tmpdir(), 'strata-ui02-'))
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu', '--window-size=1920,1080', 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const report = { errors: [], externalRequests: [], sizes: [], other: {} }
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
  const shot = async (name) => writeFileSync(join(OUT, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'))
  const appReady = `!document.querySelector('.busy') && !!document.getElementById('section-canvas') && document.body.innerText.includes('Mass balance')`
  const setSelect = (label, value) => ev(`(() => { const s = document.querySelector('select[aria-label="${label}"]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, '${value}'); s.dispatchEvent(new Event('change', { bubbles: true })); return true })()`)
  const settle = async () => { await sleep(600); await ev(`[...document.querySelectorAll('[data-testid=replace-warning] button')].find((b) => b.textContent.trim() === 'Replace')?.click()`); await sleep(400); await until(appReady, 'the app to finish running'); await sleep(800) }
  // top and bottom in page coordinates of the first element matching the selector
  const box = (sel) => `(() => { const e = document.querySelector('${sel}'); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top + scrollY), bottom: Math.round(r.bottom + scrollY), left: Math.round(r.left), right: Math.round(r.right) } })()`
  const layout = () => ev(`(() => { const b = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top + scrollY), bottom: Math.round(r.bottom + scrollY) } }; return { section: b('#section-canvas'), list: b('[data-testid=crest-table]'), listScroll: b('.crest-scroll'), card: b('[data-testid=crest-card]'), pseudoWell: b('.view:has(h2)') && null, innerH: innerHeight, innerW: innerWidth, scrollW: document.documentElement.scrollWidth, scrollY: Math.round(scrollY) } })()`)
  const metrics = (w, h, dpr) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: false })

  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable')
  const SIZES = [[1920, 1080, 1], [1920, 1080, 1.25], [1920, 1080, 1.5], [2560, 1440, 1.25], [2560, 1440, 1.5]]
  for (const [sw, sh, scale] of SIZES) {
    const w = Math.round(sw / scale)
    const h = Math.round(sh / scale - 130)
    await metrics(w, h, scale)
    await send('Page.navigate', { url: pathToFileURL(APP).href })
    await settle()
    await setSelect('Scenario preset', 'gulf')
    await settle()
    await ev('window.scrollTo(0, 0)')
    const before = await layout()
    const emptyCard = await ev(`document.querySelector('[data-testid=crest-card]')?.innerText ?? null`)
    const rows = await ev(`document.querySelectorAll('[data-crest-row]').length`)
    const rowsVisible = await ev(`(() => { const sc = document.querySelector('.crest-scroll'); const r = sc.getBoundingClientRect(); return [...document.querySelectorAll('[data-crest-row]')].filter((t) => { const q = t.getBoundingClientRect(); return q.top >= r.top && q.bottom <= r.bottom + 1 }).length })()`)
    const wellBefore = await ev(`document.querySelector('canvas[aria-label*="Pseudo-well"], [data-testid=pseudo-well]') ? 1 : 0`)
    const hasRow = await ev(`!!document.querySelector('[data-crest-row="${CREST}"]')`)
    if (!hasRow) throw new Error(`crest ${CREST} is not in the list (${rows} rows)`)
    // click the row (the id button), like John
    const pos = await ev(`(() => { const b = document.querySelector('button[aria-label^="Go to crest ${CREST},"]'); b.scrollIntoView({ block: 'nearest' }); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })()`)
    await ev('window.scrollTo(0, 0)')
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pos.x, y: pos.y })
    const pos2 = await ev(`(() => { const b = document.querySelector('button[aria-label^="Go to crest ${CREST},"]'); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height, w: r.width } })()`)
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pos2.x, y: pos2.y, button: 'left', clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pos2.x, y: pos2.y, button: 'left', clickCount: 1 })
    await sleep(800); await until(`!document.querySelector('.busy')`, 'go to crest'); await sleep(1000)
    const after = await layout()
    const ring = await ev(`(() => { const m = document.querySelector('[data-crest="${CREST}"]'); if (!m) return null; const r = m.getBoundingClientRect(); return { pressed: m.getAttribute('aria-pressed'), top: Math.round(r.top), bottom: Math.round(r.bottom), onScreen: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth } })()`)
    const sectionOnScreen = await ev(`(() => { const r = document.getElementById('section-canvas').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), fits: r.top >= 0 && r.bottom <= innerHeight } })()`)
    const card = await ev(`document.querySelector('[data-testid=crest-card]')?.innerText ?? null`)
    const listTopInWindow = after.list && after.list.top < after.innerH
    const name = `gulf-${sw}x${sh}-${Math.round(scale * 100)}pct-after-click.png`
    await shot(name)
    report.sizes.push({ screen: `${sw}x${sh}`, scale, cssViewport: `${w}x${h}`, before, after, rows, rowsVisible, rowButton: { w: Math.round(pos2.w), h: Math.round(pos2.h) }, ring, sectionOnScreen, listTopInWindow, cardAfter: card, emptyCard, screenshot: join(OUT, name), passRing: !!ring && ring.pressed === 'true' && ring.onScreen && after.scrollY === 0 })
  }

  // Saltshort and last3 at one size
  await metrics(1536, 734, 1.25)
  for (const id of ['saltshort', 'last3']) {
    await send('Page.navigate', { url: pathToFileURL(APP).href })
    await settle()
    await setSelect('Scenario preset', id)
    await settle()
    const present = await ev(`!!document.querySelector('[data-testid=crest-panel]')`)
    const rows = await ev(`document.querySelectorAll('[data-crest-row]').length`)
    const rightH = await ev(`[...document.querySelectorAll('.region.right > .view h2')].map((h) => h.textContent)`)
    const none = await ev(`document.querySelector('[data-testid=crest-none]')?.innerText ?? null`)
    await shot(`${id}.png`)
    report.other[id] = { listPanelPresent: present, rows, none, rightColumnHeadings: rightH, screenshot: join(OUT, `${id}.png`) }
  }
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1))
  for (const s of report.sizes) {
    console.log(`${s.screen} @${s.scale * 100}% css ${s.cssViewport}: section ${s.before.section.top}-${s.before.section.bottom}; list ${s.before.list?.top}-${s.before.list?.bottom} (scroll box ${s.before.listScroll?.top}-${s.before.listScroll?.bottom}; ${s.rowsVisible} of ${s.rows} rows visible); card ${s.before.card?.top}-${s.before.card?.bottom} (empty) / ${s.after.card?.top}-${s.after.card?.bottom} (selected); scrollW ${s.after.scrollW} vs innerW ${s.after.innerW}; row button ${s.rowButton.w}x${s.rowButton.h}; list top in window: ${s.listTopInWindow}; ring on screen without scrolling: ${s.passRing} (marker ${JSON.stringify(s.ring)}, scrollY ${s.after.scrollY})`)
  }
  console.log(JSON.stringify(report.other))
  console.log(`errors: ${report.errors.length} ${JSON.stringify(report.errors.slice(0, 3))}, external requests: ${report.externalRequests.length}`)
  failed = false
  ws.close()
} finally {
  proc.kill()
  process.exit(failed ? 1 : 0)
}

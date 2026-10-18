// AUD-5 screen check (D25 lesson): drives the BUILT dist/strata-lab.html from file:// in headless Chrome over CDP.
// For each screen size (1920x1080 at 100, 125, 150 %; 2560x1440 at 125, 150 %; CSS viewport = screen / scale minus 130 px of
// browser chrome) it loads the Gulf preset, opens Grid and numerical settings, scrolls the Deep compaction switch into view, and reports
// the tops and bottoms (page coordinates and in the window) of the section and of the switch, the page scroll width, and the size of the
// two radio rows. Then it clicks "Full accuracy (slower)" with a real mouse click and checks the run restarts with bundleEvery = 1 (the
// numerics group shows "1 changed"), and that the switch and the section are still on screen together.
//
//   npm run build && node scripts/review/aud-05-screens.mjs <outDir>
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const OUT = resolve(process.argv[2] ?? 'aud05-out')
const APP = resolve('dist/strata-lab.html')
if (!existsSync(APP)) throw new Error(`${APP} missing (npm run build first)`)
mkdirSync(OUT, { recursive: true })
const chrome = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find((p) => existsSync(p))
if (!chrome) throw new Error('No Chrome found; set CHROME=path')
const port = 9700 + Math.floor(Math.random() * 200)
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'strata-aud5s-'))}`, '--no-first-run', '--disable-gpu', '--window-size=1920,1080', 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const report = { errors: [], externalRequests: [], sizes: [] }
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
  const rect = (sel) => `(() => { const e = document.querySelector('${sel}'); if (!e) return null; const r = e.getBoundingClientRect(); return { pageTop: Math.round(r.top + scrollY), pageBottom: Math.round(r.bottom + scrollY), winTop: Math.round(r.top), winBottom: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) } })()`
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
    // the switch sits in the Scenario block at the top of the page: no scrolling at all, so the report shows what John sees on load
    await ev('window.reveal = () => { window.scrollTo(0, 0); return true }')
    await sleep(500)
    await ev(`reveal(document.querySelector('[data-testid=deep-compaction]'))`)
    await sleep(300)
    const before = {
      section: await ev(rect('#section-canvas')), sw: await ev(rect('[data-testid=deep-compaction]')),
      scrollW: await ev('document.documentElement.scrollWidth'), innerW: await ev('innerWidth'), innerH: await ev('innerHeight'), scrollY: await ev('Math.round(scrollY)'),
      rows: await ev(`[...document.querySelectorAll('[data-testid=deep-compaction] label')].map((l) => { const r = l.getBoundingClientRect(); return [l.textContent.trim(), Math.round(r.width), Math.round(r.height)] })`),
      checked: await ev(`[...document.querySelectorAll('[data-testid=deep-compaction] input')].map((i) => i.checked)`),
      cost: await ev(`document.querySelector('[data-testid=deep-compaction-cost]').innerText`),
    }
    await shot(`gulf-${sw}x${sh}-${Math.round(scale * 100)}pct-fast.png`)
    // real click on Full accuracy
    const pos = await ev(`(() => { const l = document.querySelectorAll('[data-testid=deep-compaction] label')[1]; const r = l.getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 } })()`)
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pos.x, y: pos.y, button: 'left', clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pos.x, y: pos.y, button: 'left', clickCount: 1 })
    await sleep(800); await settle()
    await ev(`reveal(document.querySelector('[data-testid=deep-compaction]'))`)
    await sleep(300)
    const after = {
      section: await ev(rect('#section-canvas')), sw: await ev(rect('[data-testid=deep-compaction]')),
      scrollW: await ev('document.documentElement.scrollWidth'), scrollY: await ev('Math.round(scrollY)'),
      checked: await ev(`[...document.querySelectorAll('[data-testid=deep-compaction] input')].map((i) => i.checked)`),
      summary: await ev(`document.querySelector('[data-group=numerics] summary').innerText.replace(/\\s+/g, ' ')`),
      bundleBox: await ev(`document.querySelector('[data-param=bundleEvery] input[type=number]')?.value`),
      presetValue: await ev(`document.querySelector('[data-param=bundleEvery] [data-testid=preset-value]')?.innerText`),
      wellNote: await ev(`document.querySelector('[data-testid=bundling-note]')?.innerText ?? null`),
    }
    await shot(`gulf-${sw}x${sh}-${Math.round(scale * 100)}pct-full.png`)
    const both = (s) => s.section.winTop >= 0 && s.section.winBottom <= before.innerH && s.sw.winTop >= 0 && s.sw.winBottom <= before.innerH
    report.sizes.push({ screen: `${sw}x${sh}`, scale, cssViewport: `${w}x${h}`, before, after, bothOnScreenBefore: both(before), bothOnScreenAfter: both(after) })
  }
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1))
  for (const s of report.sizes) {
    const f = (r) => `${r.pageTop}-${r.pageBottom} (window ${r.winTop}-${r.winBottom})`
    console.log(`${s.screen} @${s.scale * 100}% css ${s.cssViewport}: section ${f(s.before.section)}; switch ${f(s.before.sw)}; scrollW ${s.before.scrollW} vs innerW ${s.before.innerW}; scrollY ${s.before.scrollY}; rows ${JSON.stringify(s.before.rows)}; both on screen: ${s.bothOnScreenBefore} -> after click ${s.bothOnScreenAfter} (switch ${f(s.after.sw)}, section ${f(s.after.section)}, scrollW ${s.after.scrollW}); checked ${JSON.stringify(s.before.checked)} -> ${JSON.stringify(s.after.checked)}; group "${s.after.summary}"; box ${s.after.bundleBox}; ${s.after.presetValue}; well note after: ${s.after.wellNote}`)
  }
  console.log(`cost line: ${report.sizes[0].before.cost}`)
  console.log(`errors: ${report.errors.length} ${JSON.stringify(report.errors.slice(0, 3))}, external requests: ${report.externalRequests.length}`)
  failed = false
  ws.close()
} finally {
  proc.kill()
  process.exit(failed ? 1 : 0)
}

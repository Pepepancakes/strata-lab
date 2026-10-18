// AUD-1 screen check (D25): drives the BUILT dist/strata-lab.html from file:// in headless Chrome over CDP.
// For each screen size (1920x1080 at 100, 125, 150 %; 2560x1440 at 125, 150 %; CSS viewport = screen / scale minus
// 130 px of browser chrome) it runs the Gulf preset, then reports the tops and bottoms (page coordinates) of the
// section, the pseudo-well, planned-well and physics-check panels, the page scroll width, the Traugott check and clamp
// count at columns 150 and 250, and the notes. Screenshots go to <outDir>.
//
//   npm run build && node scripts/review/aud01-screens.mjs <outDir>
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const OUT = resolve(process.argv[2] ?? 'aud01-out')
const APP = resolve('dist/strata-lab.html')
if (!existsSync(APP)) throw new Error(`${APP} missing (npm run build first)`)
mkdirSync(OUT, { recursive: true })

const chrome = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find((p) => existsSync(p))
if (!chrome) throw new Error('No Chrome/Edge found; set CHROME=path')
const port = 9700 + Math.floor(Math.random() * 200)
const profile = mkdtempSync(join(tmpdir(), 'strata-aud01-'))
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
  const metrics = (w, h, dpr) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: false })

  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable')
  const SIZES = [[1920, 1080, 1], [1920, 1080, 1.25], [1920, 1080, 1.5], [2560, 1440, 1.25], [2560, 1440, 1.5]]
  const box = (sel) => ev(`(() => { const e = document.querySelector('${sel}'); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top + scrollY), bottom: Math.round(r.bottom + scrollY) } })()`)
  const clickAt = async (x, y) => {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
    await sleep(700); await until(`!document.querySelector('.busy')`, 'click')
  }
  // click the section so the pseudo-well sits at about `km` km (column = km for dx 1000 m); corrects once from the heading
  const goToKm = async (km) => {
    await ev('window.scrollTo(0, 0)')
    const r = await ev(`(() => { const r = document.getElementById('section-canvas').getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height } })()`)
    let frac = (km + 0.5) / 400
    for (let k = 0; k < 4; k++) {
      await clickAt(r.l + frac * r.w, r.t + r.h * 0.5)
      const got = Number(await ev(`(document.querySelector('.region.well h2')?.textContent.match(/at (\\d+) km/) ?? [])[1]`))
      if (got === km) return got
      frac += (km - got) / 400
    }
    return Number(await ev(`(document.querySelector('.region.well h2')?.textContent.match(/at (\\d+) km/) ?? [])[1]`))
  }
  const text = (sel) => ev(`document.querySelector('${sel}')?.innerText ?? null`)

  for (const [sw, sh, scale] of SIZES) {
    const w = Math.round(sw / scale)
    const h = Math.round(sh / scale - 130)
    await metrics(w, h, scale)
    await send('Page.navigate', { url: pathToFileURL(APP).href })
    await settle()
    await setSelect('Scenario preset', 'gulf')
    await settle()
    const row = { screen: `${sw}x${sh}`, scale, cssViewport: `${w}x${h}`, cols: {} }
    // physics checks: the run lines
    await ev(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Run checks')?.click()`)
    await sleep(1500)
    for (const km of [150, 250]) {
      const got = await goToKm(km)
      row.cols[km] = { got, traugott: await text('[data-testid=traugott-numbers]'), clamps: await text('[data-testid=check-clamps]'), wellNote: await text('[data-testid=well-capped-note]'), bundling: await text('[data-testid=bundling-note]'), gulf: await text('[data-testid=gulf-note]') }
    }
    // plan a well at the current column so the planned-well window shows
    await ev(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Plan a well here')?.click()`)
    await sleep(1500); await until(`!document.querySelector('.busy')`, 'plan well')
    await ev('window.scrollTo(0, 0)')
    row.layout = {
      section: await box('#section-canvas'), pseudoWell: await box('.region.well .view'), wellPlan: await box('[data-testid=well-plan]'), notes: await box('[data-testid=audit-notes]'),
      runChecks: await box('[data-testid=run-checks]'), scrollWidth: await ev('document.documentElement.scrollWidth'), innerWidth: await ev('innerWidth'), innerHeight: await ev('innerHeight'),
    }
    row.planNotes = await text('[data-testid=well-plan] [data-testid=audit-notes]')
    row.planCapped = await text('[data-testid=flag-capped]')
    row.planDots = await ev(`document.querySelectorAll('[data-testid=plot-capped]').length`)
    row.wellDots = await ev(`document.querySelectorAll('[data-testid=well-capped]').length`)
    const name = `gulf-${sw}x${sh}-${Math.round(scale * 100)}pct`
    await shot(`${name}-top.png`)
    await ev(`document.querySelector('[data-testid=well-plan]')?.scrollIntoView()`)
    await sleep(300)
    await shot(`${name}-wellplan.png`)
    await ev(`document.querySelector('[data-testid=run-checks]')?.scrollIntoView()`)
    await sleep(300)
    await shot(`${name}-checks.png`)
    report.sizes.push(row)
  }
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1))
  for (const s of report.sizes) {
    console.log(`${s.screen} @${s.scale * 100}% css ${s.cssViewport}: section ${s.layout.section?.top}-${s.layout.section?.bottom}; pseudo-well ${s.layout.pseudoWell?.top}-${s.layout.pseudoWell?.bottom}; planned well ${s.layout.wellPlan?.top}-${s.layout.wellPlan?.bottom}; run checks ${s.layout.runChecks?.top}-${s.layout.runChecks?.bottom}; scrollWidth ${s.layout.scrollWidth} / ${s.layout.innerWidth}; dots well ${s.wellDots} plan ${s.planDots}`)
  }
  const s0 = report.sizes[0]
  console.log(JSON.stringify(s0.cols, null, 1))
  console.log(JSON.stringify({ planNotes: s0.planNotes, planCapped: s0.planCapped }, null, 1))
  console.log(`errors: ${report.errors.length} ${JSON.stringify(report.errors.slice(0, 3))}, external requests: ${report.externalRequests.length}`)
  failed = false
  ws.close()
} finally {
  proc.kill()
  process.exit(failed ? 1 : 0)
}

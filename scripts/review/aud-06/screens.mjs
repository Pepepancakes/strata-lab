// AUD-6 screen check (D25 lesson), own script: drives the BUILT dist/strata-lab.html from file:// in headless Chrome.
// Five screen sizes; Gulf preset. Reports the tops/bottoms of the section, the Deep compaction switch, the crest list,
// the selected-crest card (after a real click on a crest row), the pseudo-well audit notes, the planned-well notes
// (after "Plan a well here") and the "This run" physics checks; page scroll width; console errors; external requests.
//   node <this> <outDir>   (run from the repo root after npm run build)
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const OUT = resolve(process.argv[2] ?? 'aud06-out')
const APP = resolve('dist/strata-lab.html')
if (!existsSync(APP)) throw new Error(`${APP} missing (npm run build first)`)
mkdirSync(OUT, { recursive: true })
const chrome = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe'].filter(Boolean).find((p) => existsSync(p))
if (!chrome) throw new Error('No Chrome found')
const port = 9700 + Math.floor(Math.random() * 200)
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'strata-aud6s-'))}`, '--no-first-run', '--disable-gpu', '--window-size=1920,1080', 'about:blank'], { stdio: 'ignore' })
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
  const text = (sel) => ev(`document.querySelector('${sel}')?.innerText?.replace(/\\s+/g, ' ').slice(0, 400) ?? null`)
  const click = async (sel) => {
    const pos = await ev(`(() => { const l = document.querySelector('${sel}'); if (!l) return null; l.scrollIntoView({ block: 'center' }); const r = l.getBoundingClientRect(); return { x: r.left + Math.min(20, r.width / 2), y: r.top + r.height / 2 } })()`)
    if (!pos) throw new Error(`no element ${sel}`)
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pos.x, y: pos.y, button: 'left', clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pos.x, y: pos.y, button: 'left', clickCount: 1 })
    await sleep(500)
  }
  const metrics = (w, h, dpr) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: false })

  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable')
  const SIZES = process.env.SIZES ? JSON.parse(process.env.SIZES) : [[1920, 1080, 1], [1920, 1080, 1.25], [1920, 1080, 1.5], [2560, 1440, 1.25], [2560, 1440, 1.5]]
  for (const [sw, sh, scale] of SIZES) {
    const w = Math.round(sw / scale)
    const h = Math.round(sh / scale - 130)
    await metrics(w, h, scale)
    await send('Page.navigate', { url: pathToFileURL(APP).href })
    await settle()
    await setSelect('Scenario preset', 'gulf')
    await settle()
    await ev('window.scrollTo(0, 0)')
    await sleep(300)
    const tag = `${sw}x${sh}-${Math.round(scale * 100)}pct`
    const onLoad = {
      innerW: await ev('innerWidth'), innerH: await ev('innerHeight'), scrollW: await ev('document.documentElement.scrollWidth'),
      section: await ev(rect('#section-canvas')), sw: await ev(rect('[data-testid=deep-compaction]')), crestPanel: await ev(rect('[data-testid=crest-panel]')),
      crestTable: await ev(rect('[data-testid=crest-table]')), crestScroll: await ev(rect('.crest-scroll')), clamps0: await text('[data-testid=check-clamps]'), traugott0: await text('[data-testid=check-traugott]'), traugottClass0: await ev(`document.querySelector('[data-testid=check-traugott] span')?.className ?? null`), wellCapped0: await text('[data-testid=well-capped-note]'), wellCappedDots0: await ev(`document.querySelectorAll('[data-testid=well-capped]').length`), crestRows: await ev(`document.querySelectorAll('[data-crest-row]').length`),
      cost: await text('[data-testid=deep-compaction-cost]'),
    }
    await shot(`gulf-${tag}-load.png`)
    // click the first crest row with a real mouse click
    const wellBefore = await ev(`document.querySelector('[data-testid=well-capped-note]')?.innerText ?? null`)
    await click('[data-crest-row]')
    await sleep(800); await until(appReady, 'run after crest click')
    const afterCrest = {
      scrollY: await ev('Math.round(scrollY)'), section: await ev(rect('#section-canvas')), crestTable: await ev(rect('[data-testid=crest-table]')),
      card: await ev(rect('[data-testid=crest-card]')), crestScroll: await ev(rect('.crest-scroll')), timeShown: await ev(`document.body.innerText.match(/[0-9.]+ Ma/)?.[0] ?? null`), cardText: await text('[data-testid=crest-card]'), wellNote: await text('[data-testid=crest-well-note]'),
      selected: await ev(`document.querySelector('[data-crest-row][aria-selected=true]')?.innerText?.replace(/\\s+/g, ' ') ?? null`),
    }
    await shot(`gulf-${tag}-crest.png`)
    // pseudo-well notes and the physics checks
    const notes = {
      auditNotes: await ev(rect('[data-testid=audit-notes]')), bundlingNote: await text('[data-testid=bundling-note]'), gulfNote: await text('[data-testid=gulf-note]'),
      limits: await text('[data-testid=pressure-limits]'), wellCapped: await text('[data-testid=well-capped-note]'), wellCappedDots: await ev(`document.querySelectorAll('[data-testid=well-capped]').length`),
      checks: await ev(rect('[data-testid=run-checks]')), clamps: await text('[data-testid=check-clamps]'), traugott: await text('[data-testid=check-traugott]'),
      traugottClass: await ev(`document.querySelector('[data-testid=check-traugott] span')?.className ?? null`),
    }
    await ev(`document.querySelector('[data-testid=audit-notes]')?.scrollIntoView({ block: 'center' })`); await sleep(300)
    await shot(`gulf-${tag}-wellnotes.png`)
    await ev(`document.querySelector('[data-testid=run-checks]')?.scrollIntoView({ block: 'center' })`); await sleep(300)
    await shot(`gulf-${tag}-checks.png`)
    // planned well
    let plan = null
    const planBtn = await ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Plan a well here'); if (!b) return null; b.scrollIntoView({ block: 'center' }); b.click(); return true })()`)
    if (planBtn) {
      await sleep(1500); await until(appReady, 'planned well')
      plan = { plot: await ev(rect('[data-testid=pressure-plot]')), flagCapped: await text('[data-testid=flag-capped]'), flagNoWindow: await text('[data-testid=flag-nowindow]'), plotCappedDots: await ev(`document.querySelectorAll('[data-testid=plot-capped]').length`),
        planNotes: await ev(`[...document.querySelectorAll('[data-testid=well-plan] [data-testid=audit-notes] p')].map((p) => p.innerText.slice(0, 120))`) }
      await ev(`document.querySelector('[data-testid=pressure-plot]')?.scrollIntoView({ block: 'center' })`); await sleep(300)
      await shot(`gulf-${tag}-plannedwell.png`)
    }
    report.sizes.push({ screen: `${sw}x${sh}`, scale, cssViewport: `${w}x${h}`, onLoad, afterCrest, notes, plan, wellBefore })
  }
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1))
  const f = (r) => (r ? `${r.pageTop}-${r.pageBottom} (win ${r.winTop}-${r.winBottom})` : 'MISSING')
  for (const s of report.sizes) {
    const o = s.onLoad, a = s.afterCrest
    const on = (r) => r && r.winTop >= 0 && r.winBottom <= o.innerH
    console.log(`\n${s.screen} @${s.scale * 100}% css ${s.cssViewport} innerH ${o.innerH}: scrollW ${o.scrollW} vs innerW ${o.innerW}`)
    console.log(`  on load (end of run): crest scroll box ${f(o.crestScroll)}; capped dots ${o.wellCappedDots0}; capped note: ${o.wellCapped0}\n  checks at end: ${o.clamps0}\n  traugott at end [${o.traugottClass0}]: ${o.traugott0}`)
    console.log(`  on load: section ${f(o.section)}; switch ${f(o.sw)}; crest panel ${f(o.crestPanel)}; crest table ${f(o.crestTable)} rows ${o.crestRows}; section+switch+crest table on screen: ${on(o.section) && on(o.sw) && on(o.crestTable)}`)
    console.log(`  after crest click (scrollY ${a.scrollY}, time shown ${a.timeShown}): scroll box ${f(a.crestScroll)}; section ${f(a.section)}; table ${f(a.crestTable)}; card ${f(a.card)}; section+card on screen: ${on(a.section) && on(a.card)}; selected row: ${a.selected}`)
    console.log(`  card: ${a.cardText}`)
    console.log(`  well note: ${a.wellNote}`)
    console.log(`  pseudo-well audit notes ${f(s.notes.auditNotes)}; capped dots ${s.notes.wellCappedDots}; capped note: ${s.notes.wellCapped}`)
    console.log(`  bundling: ${s.notes.bundlingNote}\n  gulf: ${s.notes.gulfNote}\n  limits: ${s.notes.limits}`)
    console.log(`  checks ${f(s.notes.checks)}: ${s.notes.clamps}\n  traugott [${s.notes.traugottClass}]: ${s.notes.traugott}`)
    if (s.plan) console.log(`  planned well plot ${f(s.plan.plot)}; capped dots ${s.plan.plotCappedDots}; flag capped: ${s.plan.flagCapped}; no window: ${s.plan.flagNoWindow}; notes: ${JSON.stringify(s.plan.planNotes)}`)
  }
  console.log(`\ncost line: ${report.sizes[0].onLoad.cost}`)
  console.log(`errors: ${report.errors.length} ${JSON.stringify(report.errors.slice(0, 3))}, external requests: ${report.externalRequests.length}`)
  failed = false
  ws.close()
} finally {
  proc.kill()
  process.exit(failed ? 1 : 0)
}

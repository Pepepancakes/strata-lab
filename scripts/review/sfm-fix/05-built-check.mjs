// SFM-4 check 5: built-file check at five sizes. Run from the repo root after `npm run build`.
//   CHROME=<path to chrome> OUT_DIR=<folder for screenshots> node scripts/review/sfm-fix/05-built-check.mjs
// Opens dist/strata-lab.html from file:// in headless Chrome over CDP (own --user-data-dir), at 1920x1080 @100/125/150 % and
// 2560x1440 @125/150 %. Per size and per preset (default, then Gulf-style): console errors, external requests, the "Sent down the
// slope" line, its (i) note, bounding-box tops of the section canvas and the line; one screenshot per size and preset at the present step.
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const FILE = resolve('dist/strata-lab.html')
const OUT = process.env.OUT_DIR || tmpdir()
const chrome = process.env.CHROME || 'google-chrome'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const cases = [[1920, 1080, 1], [1920, 1080, 1.25], [1920, 1080, 1.5], [2560, 1440, 1.25], [2560, 1440, 1.5]]
let bad = 0

for (const [w, h, scale] of cases) {
  const port = 9300 + (w + Math.round(scale * 100)) % 500
  const profile = mkdtempSync(join(tmpdir(), 'strata-sfm4-'))
  const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' })
  try {
    let target
    for (let i = 0; i < 50 && !target; i++) {
      try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page') } catch { /* wait */ }
      if (!target) await sleep(200)
    }
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((r) => (ws.onopen = r))
    let id = 0
    const pending = new Map()
    const errors = [], requests = []
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data)
      if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); return }
      if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.text + ' ' + (d.params.exceptionDetails.exception?.description ?? ''))
      if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push('console.error ' + d.params.args.map((a) => a.value ?? a.description).join(' '))
      if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') errors.push('log ' + d.params.entry.text + ' ' + (d.params.entry.url ?? ''))
      if (d.method === 'Network.requestWillBeSent') requests.push(d.params.request.url)
    }
    const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
    const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value
    await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable'); await send('Page.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: Math.round(w / scale), height: Math.round(h / scale), deviceScaleFactor: scale, mobile: false })
    await send('Page.navigate', { url: pathToFileURL(FILE).href })
    let ok = false
    for (let i = 0; i < 100 && !ok; i++) { await sleep(300); ok = await ev(`document.body.innerText.includes('Engine worker: OK')`) }

    const readAt = async (label) => {
      for (let i = 0; i < 200; i++) { // wait until the run has finished (the preset select is enabled again) and the line exists
        const ready = await ev(`(() => { const s = document.querySelector('select[aria-label="Scenario preset"]'); return !!s && !s.disabled && !!document.querySelector('[data-testid="turbidite-share"]') })()`)
        if (ready) break
        await sleep(300)
      }
      await ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Go to the present'); if (b) b.click(); return !!b })()`)
      await sleep(2500)
      const line = await ev(`document.querySelector('[data-testid="turbidite-share"]')?.textContent ?? null`)
      const infoClicked = await ev(`(() => { const b = document.querySelector('[data-testid="turbidite-share"] button.info'); if (b) b.click(); return !!b })()`)
      await sleep(300)
      const box = await ev(`(() => {
        const e = document.querySelector('[data-testid="turbidite-share"]'); if (!e) return null
        e.scrollIntoView({ block: 'center' })
        const r = e.getBoundingClientRect(); const c = document.querySelector('#section-canvas').getBoundingClientRect()
        return { lineTop: Math.round(r.top), canvasBottom: Math.round(c.bottom), note: document.querySelector('[data-testid="turbidite-share"] [role=note]')?.textContent.slice(0, 40) ?? null }
      })()`)
      await sleep(300)
      const shot = await send('Page.captureScreenshot', { format: 'png' })
      const path = join(OUT, `sfm4-built-${label}-${w}x${h}-${Math.round(scale * 100)}.png`)
      writeFileSync(path, Buffer.from(shot.result.data, 'base64'))
      console.log(`${w}x${h} @${scale * 100}% ${label}: line "${line}"; info clicked ${infoClicked}; box ${JSON.stringify(box)}; ${path}`)
      await ev(`(() => { const b = document.querySelector('[data-testid="turbidite-share"] button.info'); if (b && b.getAttribute('aria-expanded') === 'true') b.click(); return true })()`)
      await ev(`window.scrollTo(0, 0)`)
    }
    await readAt('default')
    await ev(`(() => { const s = document.querySelector('select[aria-label="Scenario preset"]'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, 'gulf'); s.dispatchEvent(new Event('change', { bubbles: true })); return s.value })()`)
    await sleep(1500)
    await readAt('gulf')
    const external = requests.filter((u) => !u.startsWith('file:') && !u.startsWith('data:') && !u.startsWith('blob:'))
    if (!ok || errors.length || external.length) bad++
    console.log(`${w}x${h} @${scale * 100}%: engine OK ${ok}; console errors ${errors.length}; external requests ${external.length}`)
    if (errors.length) console.log('  errors:', errors.slice(0, 3))
    ws.close()
  } finally { proc.kill() }
}
console.log(bad ? `FAIL: ${bad} size(s) with errors or external requests` : 'all five sizes: 0 console errors, 0 external requests')

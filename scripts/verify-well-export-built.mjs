// Export of the planned well from the BUILT app (dist/strata-lab.html), from file:// in headless Chrome (M4.4).
//   For display scaling 100 % and 150 % (deviceScaleFactor 1 and 1.5), from a clean browser state:
//   plan a well, Export plot (PNG) and Export stations (CSV) are real downloads through CDP Browser.setDownloadBehavior.
//   PNG: starts 89 50 4E 47 0D 0A 1A 0A, over 10 KB, same pixel size at both scalings.
//   CSV: '#' header lines (units, method, versions, hash), the 14 columns, no NaN/undefined, and three depths whose fracture
//   gradient is re-computed here from the file's own overburden and pore pressure (Eaton: ppg_fg = k (ppg_S - ppg_P) + ppg_P,
//   k = nu/(1-nu), nu = 0.40), plus salt rows where fracture gradient = overburden. The M4.2 hand column itself is in tests/wellExport.test.ts.
//   With a branch ticked under Compare branches the CSV holds a block per branch.
// Needs Node 22+ and Chrome/Edge (set CHROME to override). Run: npm run build && node scripts/verify-well-export-built.mjs
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const APP = resolve('dist/strata-lab.html')
if (!existsSync(APP)) throw new Error('dist/strata-lab.html missing: run npm run build first')
const chrome = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean).find((p) => existsSync(p))
if (!chrome) throw new Error('No Chrome/Edge found; set CHROME=path')

const work = mkdtempSync(join(tmpdir(), 'strata-wex-'))
const dlRoot = join(work, 'dl')
mkdirSync(dlRoot)
const port = 9300 + Math.floor(Math.random() * 500)
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${join(work, 'profile')}`, '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const report = { errors: [], externalRequests: [], checks: [] }
const check = (name, ok, detail = '') => { report.checks.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`) }
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
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && waiting.has(m.id)) return waiting.get(m.id)(m)
    if (m.method === 'Runtime.exceptionThrown') report.errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text)
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) report.errors.push(`console.${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description).join(' ')}`)
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') report.errors.push(`${m.params.entry.text} ${m.params.entry.url ?? ''}`)
    if (m.method === 'Network.requestWillBeSent') {
      const u = m.params.request.url
      if (!/^(file:|data:|blob:|about:)/.test(u)) report.externalRequests.push(u)
    }
  }
  const send = (method, params = {}) => new Promise((r) => { const id = ++seq; waiting.set(id, r); ws.send(JSON.stringify({ id, method, params })) })
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'evaluate failed')
    return r.result?.result?.value
  }
  const until = async (expr, what, ms = 180000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < ms) { if (await ev(expr)) return; await sleep(150) }
    throw new Error(`timeout waiting for ${what}; errors=${JSON.stringify(report.errors.slice(0, 3))}; text=${JSON.stringify((await ev('document.body.innerText')).slice(0, 500))}`)
  }
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable'); await send('Network.enable'); await send('DOM.enable')

  const ready = `!document.querySelector('.busy') && !!document.getElementById('section-canvas') && document.body.innerText.includes('Mass balance') && document.querySelectorAll('ul.branches li').length > 0`
  const clickText = (text) => ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(text)}); if (!b) throw new Error('no button ' + ${JSON.stringify(text)}); b.click(); return true })()`)
  const waitFile = async (dir, ext) => {
    for (let i = 0; i < 100; i++) {
      const f = readdirSync(dir).find((n) => n.endsWith(ext))
      if (f) { await sleep(300); return join(dir, f) }
      await sleep(150)
    }
    throw new Error(`no ${ext} file was downloaded to ${dir}`)
  }
  const download = async (dir, button, ext) => {
    mkdirSync(dir, { recursive: true })
    await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir, eventsEnabled: true })
    await clickText(button)
    return waitFile(dir, ext)
  }
  const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const NU = 0.40 // wellPressureParams default Poisson's ratio (tuned)
  const K = NU / (1 - NU)
  const sizes = {}
  const base = (p) => p.split(/[\\/]/).pop()

  for (const scale of [1, 1.5]) {
    const tag = `${Math.round(scale * 100)}%`
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: scale, mobile: false })
    await send('Page.navigate', { url: pathToFileURL(APP).href })
    await sleep(500)
    await ev(`localStorage.clear()`) // fresh state: no autosaved well
    await send('Page.navigate', { url: pathToFileURL(APP).href })
    await sleep(500)
    await until(ready, 'the app to finish running')
    await sleep(300)
    await clickText('Plan a well here')
    await until(`!!document.querySelector('[data-testid=pressure-plot]') && !!document.querySelector('[data-testid=well-export]') && !document.querySelector('.busy')`, 'the pressure plot')
    await sleep(300)
    check(`${tag}: export buttons are at least 44 px tall`, await ev(`[...document.querySelectorAll('[data-testid=well-export] button')].every((b) => b.getBoundingClientRect().height >= 43.5)`))

    // PNG
    const png = await download(join(dlRoot, `png-${scale}`), 'Export plot (PNG)', '.png')
    const pb = readFileSync(png)
    const w = pb.readUInt32BE(16)
    const h = pb.readUInt32BE(20)
    sizes[tag] = [w, h]
    check(`${tag}: PNG starts with 89 50 4E 47 0D 0A 1A 0A`, pb.subarray(0, 8).equals(PNG_MAGIC), pb.subarray(0, 8).toString('hex'))
    check(`${tag}: PNG is over 10 KB`, pb.length > 10240, `${pb.length} bytes, ${w}x${h}, ${base(png)}`)
    check(`${tag}: PNG ends with the IEND chunk`, pb.subarray(pb.length - 8, pb.length - 4).toString('latin1') === 'IEND')
    writeFileSync(join(work, `well-${Math.round(scale * 100)}.png`), pb)

    // CSV
    const csvPath = await download(join(dlRoot, `csv-${scale}`), 'Export stations (CSV)', '.csv')
    const text = readFileSync(csvPath, 'utf8')
    const lines = text.split(/\r?\n/).filter((l) => l !== '')
    const header = lines.filter((l) => l.startsWith('#'))
    const bodyLines = lines.filter((l) => !l.startsWith('#'))
    const cols = bodyLines[0].split(',')
    const rows = bodyLines.slice(1).map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v])))
    const head = header.join('\n')
    check(`${tag}: CSV has # header lines with units, method, versions, hash`, header.length >= 9 && /app_version: \d/.test(head) && /engine_version: \d+/.test(head) && /scenario_hash: .*[0-9a-f]{16}/.test(head) && /Eaton \(1969\)/.test(head) && /ppg/.test(head), `${header.length} header lines, ${base(csvPath)}`)
    check(`${tag}: CSV has the 14 columns`, cols.join(',') === 'md_ft,tvd_rkb_ft,tvdss_ft,x_km,material,porosity,pore_pressure_psi,pore_pressure_ppg,hydrostatic_ppg,overburden_ppg,fracture_gradient_ppg,window_ppg,temperature_f,branch', cols.join(','))
    check(`${tag}: CSV has rows and no NaN/undefined`, rows.length > 100 && !/NaN|undefined|Infinity/.test(text), `${rows.length} rows, ${text.length} bytes`)
    const sed = rows.filter((r) => r.material === 'sediment' && r.pore_pressure_ppg !== '')
    check(`${tag}: CSV has sediment rows`, sed.length >= 3, `${sed.length}`)
    if (sed.length >= 3) {
      const picks = [sed[Math.floor(sed.length * 0.1)], sed[Math.floor(sed.length * 0.5)], sed[sed.length - 1]]
      const detail = []
      let worst = 0
      for (const r of picks) {
        const s = Number(r.overburden_ppg), p = Number(r.pore_pressure_ppg)
        const hand = K * (s - p) + p
        worst = Math.max(worst, Math.abs(hand - Number(r.fracture_gradient_ppg)) / hand)
        detail.push(`${r.tvdss_ft} ft: S ${s} P ${p} FG ${r.fracture_gradient_ppg} hand ${hand.toFixed(6)}`)
      }
      check(`${tag}: fracture gradient at three depths equals the Eaton hand formula on the file's own S and P (rel < 1e-5)`, worst < 1e-5, `${detail.join(' | ')}; worst ${worst.toExponential(2)}`)
    }
    const salt = rows.filter((r) => r.material === 'salt')
    if (salt.length) check(`${tag}: in salt the fracture gradient equals the overburden`, salt.every((r) => r.fracture_gradient_ppg === r.overburden_ppg && r.pore_pressure_ppg === ''), `${salt.length} salt rows`)
    check(`${tag}: all rows name the branch`, rows.every((r) => r.branch === 'Main run'))
  }
  check('PNG pixel size is the same at 100 % and 150 % display scaling', sizes['100%'][0] === sizes['150%'][0] && sizes['100%'][1] === sizes['150%'][1], JSON.stringify(sizes))

  // a branch overlay: one block per branch (at 150 %, the current scaling)
  await ev(`(() => { const el = document.querySelector('input[type=range][aria-label=Time]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '300'); el.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
  await sleep(500)
  await clickText('Branch from here')
  await until(`document.querySelectorAll('ul.branches li').length === 2 && !document.querySelector('.busy')`, 'the branch')
  await sleep(500)
  await ev(`(() => { const box = [...document.querySelectorAll('[data-testid=well-plan] fieldset input[type=checkbox]')][0]; if (!box) throw new Error('no compare box'); box.click(); return true })()`)
  await until(`!!document.querySelector('[data-testid=branch-legend]') && !document.querySelector('.busy')`, 'the branch compare')
  await sleep(300)
  const png2 = await download(join(dlRoot, 'png-compare'), 'Export plot (PNG)', '.png')
  const pb2 = readFileSync(png2)
  check('compare: PNG is valid and over 10 KB', pb2.subarray(0, 8).equals(PNG_MAGIC) && pb2.length > 10240, `${pb2.length} bytes`)
  writeFileSync(join(work, 'well-compare.png'), pb2)
  const csv2 = readFileSync(await download(join(dlRoot, 'csv-compare'), 'Export stations (CSV)', '.csv'), 'utf8')
  const lines2 = csv2.split(/\r?\n/).filter((l) => l !== '')
  const names = [...new Set(lines2.filter((l) => !l.startsWith('#')).slice(1).map((l) => l.split(',').pop()))]
  check('compare: CSV has one block per branch, with a branch column and a hash per branch', lines2.filter((l) => l.startsWith('# branch:')).length === 2 && names.length === 2 && (lines2.find((l) => l.startsWith('# scenario_hash')).match(/[0-9a-f]{16}/g) || []).length === 2, `branches ${JSON.stringify(names)}`)

  check('no console errors', report.errors.length === 0, report.errors.slice(0, 3).join(' | '))
  check('no external requests', report.externalRequests.length === 0, report.externalRequests.slice(0, 3).join(' | '))
  failed = report.checks.some((c) => !c.ok)
  console.log(`files kept in ${work}`)
  console.log(failed ? 'WELL EXPORT VERIFY FAILED' : `WELL EXPORT VERIFY OK: ${report.checks.length} checks`)
  ws.close()
} catch (e) {
  console.error(e)
} finally {
  proc.kill()
}
process.exit(failed ? 1 : 0)

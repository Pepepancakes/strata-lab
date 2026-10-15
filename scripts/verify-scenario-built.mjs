// Round trip of a scenario file in the BUILT app (dist/strata-lab.html) from file:// in headless Chrome.
//   1. make a branch with a changed control, Save (a real download through CDP Browser.setDownloadBehavior)
//   2. check the downloaded file: size, JSON, schema, one stateHash per branch
//   3. reload: the autosave restores the same two branches
//   4. New, then Open the downloaded file; no warning; Save again; the hashes equal the first file's
//   5. a malformed file is refused and the work stays; the replace warning appears and Cancel keeps the work
// Needs Node 22+ and Chrome/Edge (set CHROME to override). Run: npm run build && node scripts/verify-scenario-built.mjs
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
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

const work = mkdtempSync(join(tmpdir(), 'strata-scn-'))
const dl1 = join(work, 'dl1')
const dl2 = join(work, 'dl2')
mkdirSync(dl1); mkdirSync(dl2)
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })

  const ready = `!document.querySelector('.busy') && !!document.getElementById('section-canvas') && document.body.innerText.includes('Mass balance') && document.querySelectorAll('ul.branches li').length > 0`
  const nBranches = () => ev(`document.querySelectorAll('ul.branches li').length`)
  const clickText = (text) => ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(text)}); if (!b) throw new Error('no button ' + ${JSON.stringify(text)}); b.click(); return true })()`)
  const setStep = (n) => ev(`(() => { const el = document.querySelector('input[type=range][aria-label=Time]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '${n}'); el.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
  const setSupply = (v) => ev(`(() => { const el = document.querySelector('input[aria-label^="Sediment supply"]'); el.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '${v}'); el.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); return true })()`)
  const waitFile = async (dir) => {
    for (let i = 0; i < 100; i++) {
      const f = readdirSync(dir).find((n) => n.endsWith('.strata.json'))
      if (f) { await sleep(200); return join(dir, f) }
      await sleep(150)
    }
    throw new Error('no file was downloaded to ' + dir)
  }
  const chooseFile = async (path) => {
    const doc = await send('DOM.getDocument', { depth: 0 })
    const q = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: 'input[data-testid=open-file]' })
    await send('DOM.setFileInputFiles', { files: [path], nodeId: q.result.nodeId })
  }
  const settle = async () => { await sleep(400); await until(ready, 'the app to finish running'); await sleep(300) }

  await send('Page.navigate', { url: pathToFileURL(APP).href })
  await settle()
  check('first start (no autosave) shows the default scenario', (await nBranches()) === 1 && (await ev(`document.body.innerText`)).includes('Nothing unsaved'))

  // 1. a branch with a changed control
  await setStep(300)
  await sleep(300)
  await clickText('Branch from here')
  await until(`document.querySelectorAll('ul.branches li').length === 2 && !document.querySelector('.busy')`, 'the branch')
  await setSupply(600) // ft^2/yr: about 56 m^2/yr
  await sleep(500)
  await until(`!document.querySelector('.busy') && document.querySelectorAll('ul.branches li').length === 2`, 'the branch to be rebuilt with the new supply')
  check('after the branch edit the app says changes are unsaved', (await ev(`document.querySelector('[data-testid=save-state]').innerText`)).includes('not saved'))

  // 2. save: a real download
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl1, eventsEnabled: true })
  await clickText('Save')
  const file1 = await waitFile(dl1)
  const size1 = statSync(file1).size
  const text1 = readFileSync(file1, 'utf8')
  const j1 = JSON.parse(text1)
  check('downloaded file parses', j1.format === 'strata-lab-scenario' && j1.version === 1, `${file1.split(/[\\/]/).pop()}`)
  check('file is small (recipe, not the record)', size1 > 200 && size1 < 20000, `${size1} bytes`)
  check('two branches, each with a stateHash, branch edits present', j1.branches.length === 2 && j1.branches.every((b) => /^[0-9a-f]{16}$/.test(b.stateHash)) && Object.keys(j1.branches[1].edits).includes('supply'), JSON.stringify(j1.branches.map((b) => [b.name, b.startStep, b.stateHash, b.edits])))
  check('saving marks the work as saved', (await ev(`document.querySelector('[data-testid=save-state]').innerText`)).includes('Nothing unsaved'))

  // 3. reload: autosave restores
  await send('Page.reload')
  await settle()
  check('reload restores the autosaved branches', (await nBranches()) === 2)
  check('restored scenario has the branch edit', (await ev(`document.querySelector('ul.branches li:nth-child(2)').innerText`)).includes('supply'))

  // 4. New, then Open the file
  await clickText('New')
  await settle()
  check('New (nothing unsaved) goes straight to the default scenario', (await nBranches()) === 1 && !(await ev(`!!document.querySelector('[data-testid=replace-warning]')`)))
  await chooseFile(file1)
  await until(`document.querySelectorAll('ul.branches li').length === 2 && !document.querySelector('.busy')`, 'the file to open')
  await settle()
  check('opening the file shows no hash warning', !(await ev(`!!document.querySelector('[data-testid=notice]')`)))
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl2, eventsEnabled: true })
  await clickText('Save')
  const j2 = JSON.parse(readFileSync(await waitFile(dl2), 'utf8'))
  const same = JSON.stringify(j1.branches.map((b) => b.stateHash)) === JSON.stringify(j2.branches.map((b) => b.stateHash))
  check('hashes after Open equal the saved hashes, every branch', same, `${j1.branches.map((b) => b.stateHash).join(',')} vs ${j2.branches.map((b) => b.stateHash).join(',')}`)
  // branch ids are only links inside a file (a rebuilt branch gets the next free id), so compare without them
  const bare = (j) => JSON.stringify({ ...j, branches: j.branches.map((b) => ({ name: b.name, startStep: b.startStep, edits: b.edits, stateHash: b.stateHash, hasParent: b.parent !== null })) })
  check('saved structure is identical (ids aside)', bare(j1) === bare(j2))

  // a file whose hash was altered shows the warning
  const tampered = JSON.parse(text1); tampered.branches[1].stateHash = '0000000000000000'
  const tpath = join(work, 'tampered.strata.json'); writeFileSync(tpath, JSON.stringify(tampered))
  await chooseFile(tpath)
  await sleep(500)
  await until(`!document.querySelector('.busy') && !!document.querySelector('[data-testid=notice]')`, 'the hash warning')
  const notice = await ev(`document.querySelector('[data-testid=notice]').innerText`)
  check('a changed hash shows the plain warning', /different engine version; results differ/.test(notice))

  // 5. malformed file refused, work stays
  const bad = join(work, 'bad.strata.json'); writeFileSync(bad, '{ not a scenario')
  await chooseFile(bad)
  await until(`!!document.querySelector('.errbar')`, 'the refusal')
  const err = await ev(`document.querySelector('.errbar').innerText`)
  check('a malformed file is refused with a plain message', /not a usable Strata Lab scenario file/.test(err), err.slice(0, 100))
  check('the current work is untouched', (await nBranches()) === 2)
  await clickText('Dismiss')

  // replace warning
  await setStep(100)
  await sleep(300)
  await clickText('Branch from here')
  await until(`document.querySelectorAll('ul.branches li').length === 3 && !document.querySelector('.busy')`, 'a third branch')
  await clickText('New')
  await sleep(200)
  check('New with unsaved work shows the replace warning', await ev(`!!document.querySelector('[data-testid=replace-warning]')`))
  await clickText('Cancel')
  await sleep(200)
  check('Cancel keeps the work', !(await ev(`!!document.querySelector('[data-testid=replace-warning]')`)) && (await nBranches()) === 3)

  await ev(`document.querySelector('.shell') && true`)
  const shot = (await send('Page.captureScreenshot', { format: 'png' })).result.data
  mkdirSync('docs/screenshots/m1-07', { recursive: true })
  writeFileSync('docs/screenshots/m1-07/built-after-roundtrip.png', Buffer.from(shot, 'base64'))

  check('no console errors', report.errors.length === 0, report.errors.slice(0, 3).join(' | '))
  check('no external requests', report.externalRequests.length === 0, report.externalRequests.slice(0, 3).join(' | '))
  failed = report.checks.some((c) => !c.ok)
  console.log(failed ? 'SCENARIO VERIFY FAILED' : `SCENARIO VERIFY OK: ${report.checks.length} checks`)
  ws.close()
} catch (e) {
  console.error(e)
} finally {
  proc.kill()
}
process.exit(failed ? 1 : 0)

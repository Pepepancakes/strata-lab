// Opens the BUILT dist/strata-lab.html from file:// in headless Chrome (CDP, separate profile)
// and checks that it shows "Engine worker: OK" with no console errors.
// Needs Node 22+ (global WebSocket) and a Chrome/Edge install. Set CHROME to override the path.
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const FILE = resolve('dist/strata-lab.html')
if (!existsSync(FILE)) throw new Error('dist/strata-lab.html missing: run npm run build first')

const candidates = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean)
const chrome = candidates.find((p) => existsSync(p))
if (!chrome) throw new Error('No Chrome/Edge found; set CHROME=path')

const port = 9300 + Math.floor(Math.random() * 500)
const profile = mkdtempSync(join(tmpdir(), 'strata-verify-'))
const proc = spawn(
  chrome,
  ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu', 'about:blank'],
  { stdio: 'ignore' },
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let failed = true // set false only when every check passes
try {
  let target
  for (let i = 0; i < 50 && !target; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
      target = list.find((t) => t.type === 'page')
    } catch {
      /* browser still starting */
    }
    if (!target) await sleep(200)
  }
  if (!target) throw new Error('could not reach Chrome DevTools')

  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)))
  let seq = 0
  const waiting = new Map()
  const errors = []
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && waiting.has(m.id)) return waiting.get(m.id)(m)
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text)
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
      errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '))
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push(m.params.entry.text + ' ' + (m.params.entry.url ?? ''))
  }
  const send = (method, params = {}) =>
    new Promise((r) => {
      const id = ++seq
      waiting.set(id, r)
      ws.send(JSON.stringify({ id, method, params }))
    })

  await send('Runtime.enable')
  await send('Log.enable')
  await send('Page.enable')
  await send('Page.navigate', { url: pathToFileURL(FILE).href })

  let text = ''
  for (let i = 0; i < 50; i++) {
    await sleep(200)
    const r = await send('Runtime.evaluate', { expression: 'document.body.innerText', returnByValue: true })
    text = r.result?.result?.value ?? ''
    if (text.includes('Engine worker: OK') || text.includes('FAILED')) break
  }
  const ok = text.includes('Engine worker: OK') && text.includes('Strata Lab')
  console.log(`page text: ${JSON.stringify(text.slice(0, 200))}`)
  console.log(`console errors: ${errors.length}`)
  for (const e of errors) console.log('  ' + e)
  failed = !ok || errors.length > 0
  console.log(failed ? 'VERIFY FAILED' : 'VERIFY OK: built file shows "Engine worker: OK" from file://, no console errors')
  ws.close()
} catch (e) {
  console.error(e)
} finally {
  proc.kill()
}
process.exit(failed ? 1 : 0)

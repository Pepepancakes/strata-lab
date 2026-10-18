// @vitest-environment jsdom
// CL-1 (D28.3): the crest list is height-capped so the selected-crest card stays on screen, and a selected row
// is scrolled into view inside the list. jsdom has no layout, so the cap is read from the stylesheet source and
// the real pixel positions are checked by scripts/review/cl01-screens.mjs in the built file.
import { readFileSync } from 'node:fs'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildCrestLog, createCrestHistory, crestParams } from '../src/engine/crestLog'
import { pushCrestFrame } from '../src/engine/crestLog'
import { store } from '../src/app/store'
import crestsView from '../src/views/crests'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const CSS = readFileSync('src/app/styles.css', 'utf8')

function oneCrestLog() {
  const NX = 30, N = 20
  const h = createCrestHistory(NX, 1000, N)
  for (let k = 0; k < N; k++) {
    const hs = new Float64Array(NX), b = new Float64Array(NX), H = new Float64Array(NX)
    for (let j = 0; j < NX; j++) {
      const crest = j === 10
      const zt = crest ? -1900 + 10 * k : -2000
      hs[j] = crest ? 1100 + 10 * k : 1000
      b[j] = zt - hs[j]
      H[j] = crest ? -1800 + 10 * k : -1850 + 4 * k
    }
    pushCrestFrame(h, (k + 1) * 1e5, 60 - 0.1 * (k + 1), hs, b, H)
  }
  return buildCrestLog(h, crestParams(100))
}

describe('crest list height cap (CL-1)', () => {
  it('caps .crest-scroll at the smaller of 480 px and a share of the window height, keeps the head sticky, and a short-window rule exists', () => {
    const rule = CSS.match(/\.crest-scroll \{([^}]*)\}/)?.[1] ?? ''
    expect(rule).toMatch(/max-height:\s*min\(480px,\s*\d+vh\)/)
    expect(rule).toMatch(/overflow:\s*auto/)
    expect(CSS).toMatch(/\.crest-scroll thead th \{[^}]*position:\s*sticky/)
    expect(CSS).toMatch(/@media \(max-height: \d+px\)/)
  })

  const host = document.createElement('div')
  document.body.appendChild(host)
  afterEach(() => vi.restoreAllMocks())

  it('renders the card after the list, the list is keyboard-focusable, and a selected row is scrolled into view (nearest)', async () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    const set = (patch: object): void => (store as unknown as { set(p: object): void }).set(patch)
    set({ view: { nPre: 2, step: 5 }, info: { rootId: 1, dx: 1000, nx: 30, nSteps: 20 }, activeId: 1, crestLog: oneCrestLog(), selectedCrest: null })
    const Comp = crestsView.component
    const root = createRoot(host)
    await act(async () => { root.render(<Comp />) })

    const list = host.querySelector('.crest-scroll') as HTMLElement
    const card = host.querySelector('[data-testid=crest-card]') as HTMLElement
    expect(list).not.toBeNull()
    expect(list.getAttribute('tabindex')).toBe('0')
    expect(card).not.toBeNull()
    expect(list.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(scroll).not.toHaveBeenCalled()

    await act(async () => { set({ selectedCrest: 1 }) })
    expect(scroll).toHaveBeenCalledWith({ block: 'nearest' })
    expect((scroll.mock.contexts[0] as HTMLElement).getAttribute('data-crest-row')).toBe('1')
    expect(host.querySelector('[data-testid=crest-card]')?.textContent).toContain('Crest 1')
    await act(async () => { root.unmount() })
  })
})

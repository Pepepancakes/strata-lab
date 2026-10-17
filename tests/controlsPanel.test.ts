// UI-1: the Controls panel rendered (server-side, no browser): default open groups, switch badges,
// controls hidden by mode, the changed-from-preset marker. The state is built by hand; no engine run.
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { AppState } from '../src/app/store'
import { presetParams, type PresetId } from '../src/engine/presets'
import { ControlsPanel } from '../src/views/controls'
import { DEFAULT_OPEN } from '../src/views/controls/groups'

function stateFor(presetId: PresetId, edit: Record<string, unknown> = {}): AppState {
  const params = { ...presetParams(presetId), ...edit }
  return {
    presetId, activeId: 'main', busy: null,
    branches: [{ id: 'main', parentId: null, label: 'Main run' }],
    params: { main: params },
  } as unknown as AppState
}

const render = (state: AppState, query = '') => renderToStaticMarkup(createElement(ControlsPanel, { state, initialQuery: query, initialOpen: [...DEFAULT_OPEN] }))

/** The opening <details> tag and summary text of a group. */
function groupHtml(html: string, id: string): string {
  const a = html.indexOf(`data-group="${id}"`)
  if (a < 0) return ''
  const b = html.indexOf('</details>', a)
  return html.slice(a, b)
}
const isOpen = (html: string, id: string) => /^data-group="[a-z]+" open=""/.test(groupHtml(html, id))
const summary = (html: string, id: string) => /<summary>(.*?)<\/summary>/.exec(groupHtml(html, id))?.[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

describe('Controls panel', () => {
  it('opens Sediment supply, Sea level and Subsidence and closes the rest', () => {
    const html = render(stateFor('last3'))
    for (const id of ['supply', 'sealevel', 'subsidence']) expect(isOpen(html, id), id).toBe(true)
    for (const id of ['salt', 'failure', 'transport', 'compaction', 'temperature', 'cement', 'numerics']) expect(isOpen(html, id), id).toBe(false)
    expect(html).not.toContain('All other parameters')
    expect(html).toContain('aria-label="Find a parameter"')
    expect(html).toContain('placeholder="Find a parameter (e.g. salt, viscosity)"')
  })

  it('shows the Salt badge off on the default preset and on on the Gulf preset', () => {
    expect(summary(render(stateFor('last3')), 'salt')).toMatch(/Salt off/)
    expect(summary(render(stateFor('gulf')), 'salt')).toMatch(/Salt on/)
    expect(groupHtml(render(stateFor('last3')), 'salt')).toContain('Off: these settings have no effect until it is switched on.')
    expect(groupHtml(render(stateFor('gulf')), 'salt')).not.toContain('Off: these settings')
  })

  it('hides the sine controls with the published curve and shows them with the sine', () => {
    const curve = render(stateFor('last3'))
    expect(curve).not.toContain('data-param="slAmp"')
    expect(curve).toContain('Amplitude and period appear when Sine (teaching) is picked.')
    expect(curve).toContain('data-param="slShift"')
    const sine = render(stateFor('last3', { seaLevelKind: 'sine' }))
    expect(sine).toContain('data-param="slAmp"')
    expect(sine).toContain('data-param="slPeriod"')
    expect(sine).not.toContain('Amplitude and period appear')
  })

  it('hides the subsidence decay time and history outside their mode', () => {
    expect(render(stateFor('last3'))).not.toContain('data-param="subsTau"')
    expect(render(stateFor('last3', { subsMode: 'thermal' }))).toContain('data-param="subsTau"')
    expect(render(stateFor('last3', { subsMode: 'history' }))).toContain('data-param="subsHistory"')
  })

  it('marks a changed control and counts it in the group header', () => {
    expect(summary(render(stateFor('last3')), 'supply')).not.toMatch(/changed/)
    const html = render(stateFor('last3', { sandFrac: 0.4 }))
    expect(summary(html, 'supply')).toMatch(/1 changed/)
    const row = /data-param="sandFrac".*?<\/div><\/div>.*?<\/div>/s.exec(html)![0]
    expect(row).toContain('aria-label="changed from preset"')
    expect(row).toContain('title="Changed from the preset"')
    expect(row).toContain('preset 0.35')
    expect(html.match(/aria-label="changed from preset"/g)?.length).toBe(1)
  })

  it('counts a switch and shows the preset value in display units', () => {
    const html = render(stateFor('last3', { saltOn: 1, supply: 40 }))
    expect(summary(html, 'salt')).toMatch(/Salt on 1 changed/)
    expect(html).toContain('preset 215.28') // 20 m2/yr shown as ft2/yr
  })

  it('says what cement needs when temperature is off', () => {
    expect(render(stateFor('last3', { cement: 1, thermal: 0 }))).toContain('Needs Temperature on to have any effect.')
    expect(render(stateFor('last3', { cement: 1, thermal: 1 }))).not.toContain('Needs Temperature on')
  })

  it('names the switches as check boxes, coverBend included', () => {
    const html = render(stateFor('gulf'), 'a')
    for (const l of ['Salt layer on', 'Slope failure (MTDs) on', 'Temperature on', 'Quartz cement on', 'Cover resists bending']) {
      expect(html, l).toContain(`aria-label="${l}"`)
    }
  })

  it('a search opens the matching groups, hides the others, and says when nothing matches', () => {
    const html = render(stateFor('last3'), 'salt')
    expect(isOpen(html, 'salt')).toBe(true)
    expect(isOpen(html, 'numerics')).toBe(true)
    expect(html).not.toContain('data-group="supply"')
    expect(html).toContain('data-param="nSaltSub"')
    expect(html).not.toContain('data-param="nx"')
    expect(render(stateFor('last3'), 'zzz')).toContain('No parameter matches &quot;zzz&quot;.')
  })

  it('a search finds a hidden control and shows it with its note', () => {
    const html = render(stateFor('last3'), 'amplitude')
    expect(html).toContain('data-param="slAmp"')
    expect(html).toContain('Amplitude and period appear when Sine (teaching) is picked.')
  })
})

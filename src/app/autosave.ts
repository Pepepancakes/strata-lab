// Autosave of the scenario to browser storage, so a reload or a closed tab does not lose work.
//
// What is stored: the scenario file text (the recipe, see scenarioFile.ts; no hashes, no computed
// record) plus whether it had unsaved changes. Restoring recomputes the run, like opening a file.
// The storage and the timer are passed in, so the tests run without a browser.

import { parseScenario, type ScenarioFile } from './scenarioFile'

export const AUTOSAVE_KEY = 'strata-lab.autosave.v1'
export const AUTOSAVE_DELAY_MS = 800

/** The part of window.localStorage that is used. */
export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface TimerApi {
  set(fn: () => void, ms: number): unknown
  clear(handle: unknown): void
}

const browserTimers: TimerApi = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
}

export interface RestoredAutosave {
  file: ScenarioFile
  /** The work had not been saved to a file when it was autosaved. */
  dirty: boolean
}

export class Autosave {
  private handle: unknown = null
  private pending: (() => { text: string; dirty: boolean }) | null = null
  /** Set when the last write failed (storage full or blocked); the app tells John. */
  lastError: string | null = null
  /** Called after every write attempt (the store uses it to show a storage problem). */
  onWrite: (() => void) | null = null

  constructor(
    private storage: KeyValueStorage | null,
    private timers: TimerApi = browserTimers,
    private delayMs: number = AUTOSAVE_DELAY_MS,
  ) {}

  /** Write soon: many calls within the delay make one write, of the latest `make()`. */
  schedule(make: () => { text: string; dirty: boolean }): void {
    this.pending = make
    if (this.handle !== null) this.timers.clear(this.handle)
    this.handle = this.timers.set(() => this.flush(), this.delayMs)
  }

  /** Write now if something is waiting (used when the page is being hidden or closed). */
  flush(): void {
    if (this.handle !== null) this.timers.clear(this.handle)
    this.handle = null
    const make = this.pending
    this.pending = null
    if (!make || !this.storage) return
    this.write(this.storage, make)
    this.onWrite?.()
  }

  private write(storage: KeyValueStorage, make: () => { text: string; dirty: boolean }): void {
    try {
      const { text, dirty } = make()
      storage.setItem(AUTOSAVE_KEY, JSON.stringify({ v: 1, dirty, scenario: text }))
      this.lastError = null
    } catch (e) {
      this.lastError = `Autosave could not write to browser storage (${e instanceof Error ? e.message : String(e)}). Save to a file to keep your work.`
    }
  }

  /** The stored scenario, or null when there is none or it cannot be read (then the default is shown). */
  load(): RestoredAutosave | null {
    if (!this.storage) return null
    let raw: string | null
    try {
      raw = this.storage.getItem(AUTOSAVE_KEY)
    } catch {
      return null
    }
    if (!raw) return null
    try {
      const wrap = JSON.parse(raw) as { v?: unknown; dirty?: unknown; scenario?: unknown }
      if (wrap.v !== 1 || typeof wrap.scenario !== 'string') return null
      const parsed = parseScenario(wrap.scenario)
      return parsed.ok ? { file: parsed.file, dirty: wrap.dirty === true } : null
    } catch {
      return null
    }
  }

  clear(): void {
    if (this.handle !== null) this.timers.clear(this.handle)
    this.handle = null
    this.pending = null
    try {
      this.storage?.removeItem(AUTOSAVE_KEY)
    } catch {
      /* nothing to clear */
    }
  }
}

/** localStorage, or null when the browser blocks it. */
export function browserStorage(): KeyValueStorage | null {
  try {
    const s = window.localStorage
    s.getItem(AUTOSAVE_KEY)
    return s
  } catch {
    return null
  }
}

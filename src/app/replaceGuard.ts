// The "are you sure" gate in front of anything that would replace work that is not saved to a file.
//
// request() runs the action at once when nothing is unsaved. Otherwise it parks the action and
// publishes a warning; John then chooses Replace (confirm), Save first (confirmAfterSave) or
// Cancel. Pure logic, no DOM: tests/replaceGuard.test.ts. The app shows `pending` as a dialog.

export interface PendingReplace {
  /** What is about to happen, e.g. "Open a file". */
  what: string
}

export class ReplaceGuard {
  private dirty = false
  private action: (() => void) | null = null
  private info: PendingReplace | null = null

  constructor(private onChange: () => void = () => {}) {}

  get isDirty(): boolean {
    return this.dirty
  }

  get pending(): PendingReplace | null {
    return this.info
  }

  setDirty(d: boolean): void {
    if (d === this.dirty) return
    this.dirty = d
    this.onChange()
  }

  /** Run `action` now, or ask first when there is unsaved work. Returns true when it ran. */
  request(what: string, action: () => void, needsWarning: boolean = this.dirty): boolean {
    if (!needsWarning) {
      action()
      return true
    }
    this.action = action
    this.info = { what }
    this.onChange()
    return false
  }

  /** John chose Replace: the unsaved work goes. */
  confirm(): void {
    const a = this.action
    this.clearPending()
    a?.()
  }

  /** John chose Save first: `save` must return true once the file was written. */
  async confirmAfterSave(save: () => Promise<boolean>): Promise<void> {
    const a = this.action
    if (!a) return
    if (await save()) {
      this.clearPending()
      a()
    }
  }

  cancel(): void {
    this.clearPending()
  }

  private clearPending(): void {
    this.action = null
    this.info = null
    this.onChange()
  }
}

// Checks a branch's parameter edits against the registry (params.ts) and says what is wrong in
// plain language. Start-only parameters are read-only in a branch: the layers already stored
// depend on them. Ranges are the registry's guard rails.

import { getParamDef, type ParamDef, type ParamValue } from '../engine/params'

function inRange(def: ParamDef, key: string, v: ParamValue): string | null {
  if (def.options) {
    return typeof v === 'string' && def.options.includes(v) ? null : `${def.label} (${key}) must be one of: ${def.options.join(', ')}.`
  }
  if (Array.isArray(v)) {
    const lo = def.min as number[]
    const hi = def.max as number[]
    const names = def.components ?? []
    if (!Array.isArray(def.default) || v.length !== def.default.length) return `${def.label} (${key}) needs ${Array.isArray(def.default) ? def.default.length : 1} number(s).`
    for (let i = 0; i < v.length; i++) {
      if (!Number.isFinite(v[i]) || v[i] < lo[i] || v[i] > hi[i]) return `${def.label} (${key}${names[i] ? ', ' + names[i] : ''}) must be between ${lo[i]} and ${hi[i]} ${def.unit}.`
    }
    return null
  }
  if (typeof v !== 'number' || !Number.isFinite(v)) return `${def.label} (${key}) must be a number.`
  if (typeof def.min === 'number' && v < def.min) return `${def.label} (${key}) must be at least ${def.min} ${def.unit}.`
  if (typeof def.max === 'number' && v > def.max) return `${def.label} (${key}) must be at most ${def.max} ${def.unit}.`
  return null
}

/** Returns a list of problems; empty means the edits are allowed in a branch. */
export function validateBranchEdits(edits: Record<string, ParamValue>): string[] {
  const problems: string[] = []
  const keys = Object.keys(edits)
  if (keys.length === 0) return problems // a branch with no edits is allowed: it reproduces its parent
  for (const key of keys) {
    const def = getParamDef(key)
    if (!def) problems.push(`Unknown parameter "${key}".`)
    else if (def.startOnly) problems.push(`${def.label} (${key}) can only be set when a run starts; it cannot change in a branch.`)
    else {
      const bad = inRange(def, key, edits[key])
      if (bad) problems.push(bad)
    }
  }
  return problems
}

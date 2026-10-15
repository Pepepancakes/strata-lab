// Tiny engine function used to prove the worker round trip (M1.1). Not physics.
// Plain left-to-right loop so the result is bit-identical on every run.
export function sumFloat64(values: Float64Array): number {
  let total = 0
  for (let i = 0; i < values.length; i++) total += values[i]
  return total
}

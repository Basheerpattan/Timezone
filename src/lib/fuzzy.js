// Typo tolerance for place search.
//
// Optimal-string-alignment distance: insertions, deletions, substitutions and
// swaps of two neighbouring letters each count as one edit, so "newyrok",
// "londn", "tokio" and "sydeny" are all one step from what was meant.

/** Remove spaces and punctuation: "New York" → "newyork". */
export const squash = (s) => s.toLowerCase().replace(/[\s_/,.'’()-]+/g, '')

/**
 * How many typos a query of this length may carry. None under four letters —
 * "par" is one edit from far too many places to mean anything.
 */
export const allowedTypos = (q) => (q.length < 4 ? 0 : q.length < 7 ? 1 : 2)

/** Edit distance between `a` and `b`, or Infinity once it exceeds `max`. */
export function editDistance(a, b, max) {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return Infinity

  let prev2 = null
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let d = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost)
      if (prev2 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, prev2[j - 2] + 1)
      row.push(d)
      if (d < best) best = d
    }
    // Every later row is at least this row's minimum, so stop early.
    if (best > max) return Infinity
    prev2 = prev
    prev = row
  }
  return prev[b.length] <= max ? prev[b.length] : Infinity
}

/** Smallest distance from `q` to any of `labels`, within `max`. */
export function closest(q, labels, max) {
  let best = Infinity
  for (const label of labels) {
    if (label.length < 4) continue
    const d = editDistance(q, label, max)
    if (d < best) {
      best = d
      if (d === 0) break
    }
  }
  return best
}

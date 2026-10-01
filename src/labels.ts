/**
 * Reading metadata.labels back out.
 *
 * A label is written to make a cut later (TAXONOMY.md D11), so the
 * question a register asks is which cut is in use — not which one was
 * planned. The answer is measured off the entries themselves: the key the
 * most of them carry is the one somebody has actually been tagging with.
 */

/** The label key most entries carry, ties broken alphabetically so the
 * same register always groups the same way. Undefined when nothing is
 * tagged. */
export function mostCommonLabelKey(labels: Iterable<Record<string, string>>): string | undefined {
  const counts = new Map<string, number>();
  for (const map of labels) {
    for (const key of Object.keys(map)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestN = 0;
  for (const [key, n] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (n > bestN) {
      best = key;
      bestN = n;
    }
  }
  return best;
}

/** Every key in use, alphabetically: what a "group by" control offers. */
export function labelKeys(labels: Iterable<Record<string, string>>): string[] {
  const keys = new Set<string>();
  for (const map of labels) for (const key of Object.keys(map)) keys.add(key);
  return [...keys].sort();
}

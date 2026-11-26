/**
 * Plain string scanners, one per regex they replaced (#304, spec section 3.7).
 *
 * Each answers exactly what its regex answered on every input — leftmost
 * match, greedy runs, backtracking where the pattern had it — and nothing
 * looser. The differential tests (`__tests__/scan*.test.ts`) hold each against
 * its regex on SAP's recorded texts, hand-written edges, every short string
 * over the pattern's characters and seeded random ones.
 */

/** The end of the run of characters from `from` that are none of `stops`. */
function runEnd(text: string, from: number, stops: string): number {
  let end = from;
  while (end < text.length && !stops.includes(text.charAt(end))) end++;
  return end;
}

/**
 * The id after the first `prefix` that one or more non-`/` characters follow:
 * `/\/runs\/([^/]+)/` for `prefix` `/runs/`, and the same for any other
 * literal prefix. `undefined` when there is none.
 */
export function runIdAfter(text: string, prefix: string): string | undefined {
  let at = text.indexOf(prefix);
  while (at !== -1) {
    const from = at + prefix.length;
    const end = runEnd(text, from, '/');
    if (end > from) return text.slice(from, end);
    at = text.indexOf(prefix, at + 1);
  }
  return undefined;
}

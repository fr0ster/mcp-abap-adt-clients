import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The differential test of #304 (spec section 7): a scanner that replaces a
 * regex must answer what the regex answered on every input of three sets —
 * SAP's recorded texts, hand-written edges, and every string up to a bounded
 * length over the pattern's significant characters plus seeded random ones.
 * The regex is the oracle, copied into the test, where regexes are allowed.
 */

const CORPUS = join(__dirname, '../../../corpus/adt');

/** Every recorded body and header value: what SAP actually sent. */
let recorded: string[] | undefined;
export function recordedTexts(): string[] {
  if (recorded) return recorded;
  const texts: string[] = [];
  for (const folder of [
    'answers',
    'debugger',
    'discovery',
    'abapunit',
    'informationsystem',
    'documents',
  ]) {
    const dir = join(CORPUS, folder);
    for (const file of readdirSync(dir)) {
      if (!statSync(join(dir, file)).isFile()) continue;
      const text = readFileSync(join(dir, file), 'utf-8');
      texts.push(text);
      if (!file.endsWith('.json')) continue;
      const parsed: unknown = JSON.parse(text);
      collectStrings(parsed, texts);
    }
  }
  recorded = texts;
  return texts;
}

function collectStrings(value: unknown, into: string[]): void {
  if (typeof value === 'string') into.push(value);
  else if (Array.isArray(value)) for (const v of value) collectStrings(v, into);
  else if (typeof value === 'object' && value !== null)
    for (const v of Object.values(value)) collectStrings(v, into);
}

/**
 * Every string of length 0..maxLength over the alphabet, depth first: one
 * prefix is held at a time, so memory grows with `maxLength`, not with the
 * number of strings.
 */
export function* everyString(
  alphabet: readonly string[],
  maxLength: number,
  prefix = '',
): Generator<string> {
  yield prefix;
  if (prefix.length >= maxLength) return;
  for (const c of alphabet) yield* everyString(alphabet, maxLength, prefix + c);
}

/** mulberry32: a fixed seed gives the same strings on every run. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Random strings joined from tokens — single characters and the pattern's own
 * fragments, so a fragment appears often enough to exercise backtracking.
 */
export function* seededStrings(
  tokens: readonly string[],
  count: number,
  maxTokens: number,
  seed = 304,
): Generator<string> {
  const next = random(seed);
  for (let i = 0; i < count; i++) {
    const length = Math.floor(next() * (maxTokens + 1));
    let s = '';
    for (let j = 0; j < length; j++)
      s += tokens[Math.floor(next() * tokens.length)] ?? '';
    yield s;
  }
}

/** The inputs where the two disagree, at most `limit` of them. */
export function differences<T>(
  inputs: Iterable<string>,
  oracle: (s: string) => T,
  scanner: (s: string) => T,
  limit = 5,
): { input: string; oracle: T; scanner: T }[] {
  const found: { input: string; oracle: T; scanner: T }[] = [];
  for (const input of inputs) {
    const expected = oracle(input);
    const actual = scanner(input);
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      found.push({ input, oracle: expected, scanner: actual });
      if (found.length >= limit) break;
    }
  }
  return found;
}

/** The three input sets for one pattern. */
export function inputSets(options: {
  edges: readonly string[];
  alphabet: readonly string[];
  maxLength: number;
  tokens: readonly string[];
  count?: number;
  maxTokens?: number;
}): Record<string, () => Iterable<string>> {
  return {
    recorded: recordedTexts,
    edges: () => options.edges,
    exhaustive: () => everyString(options.alphabet, options.maxLength),
    random: () =>
      seededStrings(
        options.tokens,
        options.count ?? 20000,
        options.maxTokens ?? 24,
      ),
  };
}

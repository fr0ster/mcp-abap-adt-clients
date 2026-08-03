/**
 * What the package actually hands out from its root.
 *
 * This exists because a claim in the CHANGELOG outran the code:
 * `parseSearchResults` was described as "exported for callers already holding
 * the XML" while the symbol never reached the public barrel. It had `export` in
 * its own module, the module was not re-exported, and nothing noticed — a
 * deep import into `dist/core/shared/search` was the only way in, which is not
 * an API, it is a consumer reaching past the package boundary.
 *
 * So this imports from the package ENTRY POINT, the way a consumer does. A
 * `src/`-relative import would still pass with the barrel unwired and prove
 * nothing.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as rootExports from '../../index';
import { parseSearchResults } from '../../index';

describe('public API surface', () => {
  it('hands out parseSearchResults from the package root', () => {
    expect(typeof parseSearchResults).toBe('function');
  });

  it('parses through the public entry point, not just past it', () => {
    // Exercised via the root import, so an export that exists but resolves to
    // something unusable would fail here rather than in the deep module.
    const hits = parseSearchResults(
      `<objectReferences>
         <objectReference adtcore:name="ZCL_PUBLIC" adtcore:type="CLAS/OC"/>
       </objectReferences>`,
    );

    expect(hits).toEqual([
      {
        name: 'ZCL_PUBLIC',
        type: 'CLAS/OC',
        description: '',
        packageName: undefined,
        uri: undefined,
      },
    ]);
  });
});

/**
 * Names the README presents as runtime exports must actually be exported.
 *
 * The import-checking guard could not see these: both defects that reached
 * review — a promised `ENHANCEMENT_TYPE_CODES` that was never exported, and a
 * `SERVICE_BINDING_VARIANT_MAP` removed while still documented — live in prose,
 * in a bulleted list of values, not in an `import` statement.
 *
 * Telling a value from a type in prose is only tractable because of the naming
 * rule: an interface is `I` followed by a capital. Anything else backticked in
 * these sections is a value, and a value the README names must exist.
 */
describe('README runtime-export claims', () => {
  const SECTIONS = [
    'Handler classes exported directly',
    'System-capability helpers',
  ];

  const readme = readFileSync(resolve(__dirname, '../../../README.md'), 'utf8');
  const runtime = new Set(Object.keys(rootExports));

  /** Body of a `###` section, up to the next heading of any level. */
  function section(title: string): string {
    const start = readme.indexOf(`### ${title}`);
    if (start === -1) throw new Error(`README section missing: ${title}`);
    const rest = readme.slice(start + title.length + 4);
    const end = rest.search(/^#{2,3} /m);
    return end === -1 ? rest : rest.slice(0, end);
  }

  /**
   * A name is a CLAIM only where the README is listing exports — leading a
   * bullet, or on a line that is nothing but backticked names.
   *
   * Scanning every backticked word instead was the first attempt and it read
   * prose as promises: `null` out of "the record, or `null`", and `getUtils`
   * out of "rather than a method on `getUtils()`" — a method on the client,
   * never a package export.
   */
  function claimedValues(body: string): string[] {
    const names = new Set<string>();
    for (const line of body.split('\n')) {
      const bullet = line.match(
        /^\s*-\s+`([A-Za-z_][A-Za-z0-9_]*)(?:\([^`]*\))?`/,
      );
      if (bullet) {
        names.add(bullet[1]);
        continue;
      }
      // A bare enumeration line: `A`, `B`, `C`. Nothing else on it.
      if (/^`[^`]+`(,\s*`[^`]+`)*\.?$/.test(line.trim())) {
        for (const m of line.matchAll(/`([A-Za-z_][A-Za-z0-9_]*)`/g))
          names.add(m[1]);
      }
    }
    // An interface is `I` + capital by convention; everything else here is a value.
    return [...names].filter((n) => !/^I[A-Z]/.test(n));
  }

  it.each(SECTIONS)('every value named under "%s" is exported', (title) => {
    const missing = claimedValues(section(title)).filter(
      (n) => !runtime.has(n),
    );

    expect(missing).toEqual([]);
  });

  it('does not name SERVICE_BINDING_VARIANT_MAP as one of ours', () => {
    // Removed in 9.0.0: it belongs to @mcp-abap-adt/interfaces. The README may
    // mention it — it must not list it among this package's own values.
    expect(runtime.has('SERVICE_BINDING_VARIANT_MAP')).toBe(false);
  });
});

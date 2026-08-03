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

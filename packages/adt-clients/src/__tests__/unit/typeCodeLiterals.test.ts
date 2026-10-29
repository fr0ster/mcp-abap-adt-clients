/**
 * An ADT type code in this package's production source is typed by the
 * tables of `@mcp-abap-adt/interfaces-adt`, and a code named in a comment is
 * a code of the tables (`typeCodeScan.ts` has the rules). The program is
 * built from this package's own `tsconfig.json`.
 *
 * What looks like a code and is not one goes into ALLOWED, with its reason;
 * an entry that matches no finding fails too, so the list cannot rot.
 */

import { join } from 'node:path';
import { productionFiles, typeCodeFindings } from './typeCodeScan';

const ROOT = join(__dirname, '../../..');
const TSCONFIG = join(ROOT, 'tsconfig.json');

/** `<file>:<literal or word>` → why it is not a type code. */
const ALLOWED: ReadonlyMap<string, string> = new Map([
  [
    'src/batch/wire.ts:HTTP/1',
    "The HTTP version of a batch part's request line (`HTTP/1.1`), not a type code.",
  ],
  [
    'src/core/enhancement/create.ts:ENHS/XS',
    "The type of the enhancement spot as the BAdI implementation's create body references it (`enhcore:objectReference adtcore:type`): a type the systems list (`coverage.json`, unserved) that no API of the library serves, so no table holds it; it is the request body as sent, unchanged.",
  ],
  [
    'src/core/shared/whereUsed.ts:STRU/DS',
    'Named as the code the friendly name `structure` used to map to before 38.0.0 — the comment says it is a code no release lists, which is why the mapping went.',
  ],
]);

describe('type codes in production source come from the tables', () => {
  const findings = typeCodeFindings(
    ROOT,
    TSCONFIG,
    productionFiles(join(ROOT, 'src')),
  );

  it('types every code literal and names only table codes in comments', () => {
    expect(
      findings
        .filter((finding) => !ALLOWED.has(finding.key))
        .map((finding) => finding.line),
    ).toEqual([]);
  });

  it('keeps no allow-list entry that matches no finding', () => {
    const keys = new Set(findings.map((finding) => finding.key));
    expect([...ALLOWED.keys()].filter((key) => !keys.has(key))).toEqual([]);
  });
});

/**
 * An ADT type code in the legacy package's production source is typed by the
 * tables of `@mcp-abap-adt/interfaces-adt`, and a code named in a comment is
 * a code of the tables (`typeCodeScan.ts` has the rules). The program is
 * built from this package's own `tsconfig.json`.
 *
 * What looks like a code and is not one goes into ALLOWED, with its reason;
 * an entry that matches no finding fails too, so the list cannot rot.
 */

import { join } from 'node:path';
import {
  productionFiles,
  typeCodeFindings,
} from '../../../../adt-clients/src/__tests__/unit/typeCodeScan';

const ROOT = join(__dirname, '../../..');
const TSCONFIG = join(ROOT, 'tsconfig.json');

/** `<file>:<literal or word>` → why it is not a type code. */
const ALLOWED: ReadonlyMap<string, string> = new Map([]);

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

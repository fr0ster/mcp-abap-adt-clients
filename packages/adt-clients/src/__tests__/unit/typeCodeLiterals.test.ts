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
    'src/core/class/run.ts:CLAS',
    'An `osl:object` type of an ABAP Unit run — the short object type Eclipse sends (`CLAS`, `PROG`, `FUGR`, and `FUNC` beside them, which no table lists): the vocabulary of the run, not an ADT type code.',
  ],
  [
    'src/executors/class/ClassTestRunner.ts:CLAS',
    'An `osl:object` type of an ABAP Unit run — the short object type Eclipse sends (`CLAS`, `PROG`, `FUGR`, and `FUNC` beside them, which no table lists): the vocabulary of the run, not an ADT type code.',
  ],
  [
    'src/executors/functionGroup/FunctionGroupTestRunner.ts:FUGR',
    'An `osl:object` type of an ABAP Unit run — the short object type Eclipse sends (`CLAS`, `PROG`, `FUGR`, and `FUNC` beside them, which no table lists): the vocabulary of the run, not an ADT type code.',
  ],
  [
    'src/executors/program/ProgramTestRunner.ts:PROG',
    'An `osl:object` type of an ABAP Unit run — the short object type Eclipse sends (`CLAS`, `PROG`, `FUGR`, and `FUNC` beside them, which no table lists): the vocabulary of the run, not an ADT type code.',
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

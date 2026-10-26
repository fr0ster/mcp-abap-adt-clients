/**
 * Every call a legacy live suite or a legacy test helper makes to an
 * adt-clients member is judged — the root package's rule
 * (`integrationCallsAreJudged.test.ts` there), run with its guard
 * (`judgedScan.ts`) over this package's `src/__tests__/integration` and
 * `src/__tests__/helpers`, typed through this package's test tsconfig.
 *
 * A call deliberately judged otherwise goes into ALLOWED, with its reason;
 * an entry that matches no call fails too.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  filesUnder,
  jsFindings,
  typedFindings,
} from '../../../../adt-clients/src/__tests__/unit/judgedScan';

const ROOT = join(__dirname, '../../..');
const TSCONFIG = join(ROOT, 'tsconfig.test.json');
const SCOPES = ['src/__tests__/integration', 'src/__tests__/helpers'];

/** `<file>:<member>:<first 60 characters of the call>` → why it is allowed. */
const ALLOWED: ReadonlyMap<string, string> = new Map([]);

describe('legacy suites and helpers judge every adt-clients call', () => {
  const findings = [
    ...typedFindings(
      ROOT,
      TSCONFIG,
      SCOPES.flatMap((scope) => filesUnder(join(ROOT, scope), /\.ts$/)),
    ),
    ...jsFindings(
      ROOT,
      new Map(
        SCOPES.flatMap((scope) => filesUnder(join(ROOT, scope), /\.js$/)).map(
          (file) => [file, readFileSync(file, 'utf8')],
        ),
      ),
    ),
  ];
  const unallowed = findings.filter(
    (finding) => !ALLOWED.has(finding.split(' — ')[0] ?? ''),
  );

  it('scans the live suites and the helpers', () => {
    const files = SCOPES.flatMap((scope) =>
      filesUnder(join(ROOT, scope), /\.ts$/),
    );
    expect(files).toContain(join(ROOT, 'src/__tests__/helpers/legacyLive.ts'));
    expect(files).toContain(
      join(ROOT, 'src/__tests__/integration/legacy/LegacyDelete.test.ts'),
    );
  });

  it('passes an analyse strategy, the exception document read first', () => {
    expect(unallowed).toEqual([]);
  });

  it('keeps no allow-list entry that matches no call', () => {
    const keys = new Set(findings.map((finding) => finding.split(' — ')[0]));
    expect([...ALLOWED.keys()].filter((key) => !keys.has(key))).toEqual([]);
  });
});

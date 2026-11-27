/**
 * The forbidden forms of #304 in this package's production `src` (casts,
 * `any`, hand-narrowed values, regular expressions, type predicates), read by
 * `tools/sourceRules.js` — the same definition the inventory uses. None is
 * left, and none may come back: every finding is listed with its place.
 */
import * as path from 'node:path';

interface IFinding {
  file: string;
  line: number;
  column: number;
  rule: string;
  kind: string;
  text: string;
}
const rules = require('../../../../tools/sourceRules.js') as {
  findForbidden(tsconfigPath: string): IFinding[];
};

describe('source rules (#304)', () => {
  it('finds no cast, any, hand-narrowed value, regex or typed predicate', () => {
    const findings = rules.findForbidden(
      path.resolve(__dirname, '../../tsconfig.json'),
    );
    expect(
      findings.map((f) => `${f.file}:${f.line} ${f.rule}/${f.kind} ${f.text}`),
    ).toEqual([]);
  }, 120000);
});

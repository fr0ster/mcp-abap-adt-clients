/**
 * The forbidden forms of #304 in this package's production `src` (casts,
 * `any`, hand-narrowed values, regular expressions, type predicates), read by
 * `tools/sourceRules.js` — the same definition the inventory uses.
 *
 * Until this package's stage of the #304 plan is done, the findings are
 * compared with a committed baseline, a multiset keyed by file, rule, kind and
 * the node's text: a finding beyond the baseline fails, and so does a baseline
 * entry no longer reached, so the baseline only shrinks. At the end of the
 * stage the baseline is empty and this asserts no finding at all.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

interface IFinding {
  file: string;
  line: number;
  column: number;
  rule: string;
  kind: string;
  text: string;
}
interface IBaselineEntry {
  file: string;
  rule: string;
  kind: string;
  text: string;
  count: number;
}
const rules = require('../../../../tools/sourceRules.js') as {
  findForbidden(tsconfigPath: string): IFinding[];
  compareWithBaseline(
    findings: IFinding[],
    baseline: IBaselineEntry[],
  ): {
    added: { entry: string[]; count: number; before: number }[];
    stale: { entry: string[]; count: number; after: number }[];
  };
};

const baseline: IBaselineEntry[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'sourceRules.baseline.json'), 'utf8'),
);

describe('source rules (#304)', () => {
  it('finds no form beyond the baseline, and every baseline entry still', () => {
    const findings = rules.findForbidden(
      path.resolve(__dirname, '../../tsconfig.json'),
    );
    const { added, stale } = rules.compareWithBaseline(findings, baseline);
    expect({ added, stale }).toEqual({ added: [], stale: [] });
  }, 120000);
});

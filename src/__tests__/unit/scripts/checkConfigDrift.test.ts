const {
  drift,
  sharedEntriesOf,
} = require('../../../../scripts/check-config-drift');

/** `npm run check:config`: sections and shared entries the local config lacks. */

const TEMPLATE = [
  'environment:',
  '  system: "onprem"',
  'shared_dependencies:',
  '  package: "ZAC_SHR_PKG"',
  '  classes:',
  '    - name: "ZAC_SHR_A"',
  '      source: |',
  '        CLASS zac_shr_a DEFINITION.',
  '    - name: "ZAC_SHR_B"',
  '  views:',
  "    - name: 'ZAC_SHR_V'",
  '    # - name: "ZAC_SHR_COMMENTED"',
  'run_class:',
  '  test_cases:',
  '    - name: "run_class"',
  '',
].join('\n');

describe('check:config', () => {
  it('reads shared entries as collection/NAME, not test cases or comments', () => {
    expect([...sharedEntriesOf(TEMPLATE)].sort()).toEqual([
      'classes/ZAC_SHR_A',
      'classes/ZAC_SHR_B',
      'views/ZAC_SHR_V',
    ]);
  });

  it('reports a shared entry the local config lacks, and a missing section', () => {
    const config = [
      'environment:',
      '  system: "cloud"',
      'shared_dependencies:',
      '  classes:',
      '    - name: "ZAC_SHR_A"',
      '      source: |',
      '        CLASS zac_shr_a DEFINITION. " a different value is not drift',
      '',
    ].join('\n');
    const result = drift(TEMPLATE, config);
    expect(result.missingShared).toEqual([
      'classes/ZAC_SHR_B',
      'views/ZAC_SHR_V',
    ]);
    expect(result.missing).toEqual(['run_class']);
  });

  it('reports nothing when every section and entry is there', () => {
    const result = drift(TEMPLATE, TEMPLATE);
    expect(result.missing).toEqual([]);
    expect(result.missingShared).toEqual([]);
  });
});

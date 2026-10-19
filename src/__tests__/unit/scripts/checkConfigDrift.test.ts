import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const {
  drift,
  main,
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

  it('reads a quoted collection key as the helper does', () => {
    const config = [
      'environment:',
      '  system: "onprem"',
      'shared_dependencies:',
      '  "classes":',
      '    - name: "ZAC_SHR_A"',
      '    - "name": ZAC_SHR_B',
      "  'views':",
      '    - { name: ZAC_SHR_V }',
      'run_class:',
      '  test_cases: []',
      '',
    ].join('\n');
    expect(drift(TEMPLATE, config).missingShared).toEqual([]);
  });

  it('reads an anchored collection and its alias as the helper does', () => {
    const config = [
      'environment:',
      '  system: "onprem"',
      'shared_dependencies:',
      '  classes: &shared_classes',
      '    - name: "ZAC_SHR_A"',
      '    - name: "ZAC_SHR_B"',
      '  views:',
      '    - name: "ZAC_SHR_V"',
      'run_class:',
      '  test_cases: []',
      '',
    ].join('\n');
    expect(drift(TEMPLATE, config).missingShared).toEqual([]);
    const aliased = [
      'environment:',
      '  system: "onprem"',
      'library: &views',
      '  - name: "ZAC_SHR_V"',
      'shared_dependencies:',
      '  classes:',
      '    - name: "ZAC_SHR_A"',
      '    - name: "ZAC_SHR_B"',
      '  views: *views',
      'run_class:',
      '  test_cases: []',
      '',
    ].join('\n');
    expect(drift(TEMPLATE, aliased).missingShared).toEqual([]);
  });

  it('says when it could not compare the entries', () => {
    const result = drift(
      TEMPLATE,
      'shared_dependencies:\n  classes: [unclosed\n',
    );
    expect(result.sharedCompared).toBe(false);
    expect(result.missingShared).toEqual([]);
  });

  // `npm test`'s pretest runs `main()` whenever a local config exists; CI has
  // none, so only a run of `main()` itself catches a slip there.
  describe('main()', () => {
    let dir: string;
    let exit: jest.SpyInstance;
    let log: jest.SpyInstance;
    let warn: jest.SpyInstance;

    beforeEach(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-config-'));
      exit = jest.spyOn(process, 'exit').mockImplementation(((
        code?: number,
      ) => {
        throw new Error(`exit ${code}`);
      }) as never);
      log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
      exit.mockRestore();
      log.mockRestore();
      warn.mockRestore();
      fs.rmSync(dir, { recursive: true, force: true });
    });

    const run = (config: string) => {
      const template = path.join(dir, 'template.yaml');
      const local = path.join(dir, 'config.yaml');
      fs.writeFileSync(template, TEMPLATE);
      fs.writeFileSync(local, config);
      expect(() => main(template, local)).toThrow('exit 0');
    };

    it('exits 0 when the local config matches the template', () => {
      run(TEMPLATE);
      expect(log).toHaveBeenCalledWith(expect.stringContaining('carries all'));
    });

    it('exits 0 and warns when entries are missing', () => {
      run(
        'environment:\n  system: "onprem"\nshared_dependencies:\n  classes: []\n',
      );
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('shared_dependencies lacks'),
      );
    });

    it('exits 0 and says so when the entries could not be compared', () => {
      run('shared_dependencies:\n  classes: [unclosed\n');
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('not compared'),
      );
    });
  });
});

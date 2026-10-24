import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * `MCP_TEST_CONFIG_PATH` names the configuration a run loads — the 7.40
 * system's own, beside the main one — and it is that file or nothing.
 */
describe('test configuration path', () => {
  let directory: string;
  const saved = process.env.MCP_TEST_CONFIG_PATH;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'config-path-'));
    writeFileSync(
      join(directory, 'test-config.yaml'),
      'environment:\n  system: "cloud"\n',
    );
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.MCP_TEST_CONFIG_PATH;
    else process.env.MCP_TEST_CONFIG_PATH = saved;
    rmSync(directory, { recursive: true, force: true });
  });

  it('loads the named file instead of test-config.yaml', () => {
    const named = join(directory, 'test-config.legacy-740.yaml');
    writeFileSync(
      named,
      'environment:\n  system: "onprem"\n  is_legacy: true\n',
    );
    process.env.MCP_TEST_CONFIG_PATH = named;
    jest.isolateModules(() => {
      const helper = require('../../helpers/test-helper');
      expect(helper.loadTestConfig(directory).environment).toEqual({
        system: 'onprem',
        is_legacy: true,
      });
      expect(helper.isTestConfigTemplate()).toBe(false);
    });
  });

  it('fails naming the file when it does not exist, with no fallback', () => {
    const named = join(directory, 'missing.yaml');
    process.env.MCP_TEST_CONFIG_PATH = named;
    jest.isolateModules(() => {
      const helper = require('../../helpers/test-helper');
      expect(() => helper.loadTestConfig(directory)).toThrow(
        `MCP_TEST_CONFIG_PATH names ${named}, which does not exist`,
      );
    });
  });

  it('loads test-config.yaml when the variable is not set', () => {
    delete process.env.MCP_TEST_CONFIG_PATH;
    jest.isolateModules(() => {
      const helper = require('../../helpers/test-helper');
      expect(helper.loadTestConfig(directory).environment).toEqual({
        system: 'cloud',
      });
    });
  });
});

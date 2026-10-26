/**
 * Every suite of this package runs with the legacy registrations and the
 * legacy test configuration in place, with no import of its own: both Jest
 * configs load `legacySetup.ts` before each file. Without it
 * `integrationHeadersOf` would answer `AdtFunctionIncludeLegacy.create` with
 * the root class's v2 pair, which 7.40 refuses.
 *
 * This file imports neither `legacyRegistrations` nor `legacyTestConfig`, so
 * what it finds registered is the setup's.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { integrationHeadersOf } from '../../../../adt-clients/src/__tests__/helpers/adtHeaders';
import { AdtFunctionIncludeLegacy } from '../../core/functionInclude/AdtFunctionIncludeLegacy';

const PACKAGE = path.resolve(__dirname, '../../..');
const SETUP = '<rootDir>/src/__tests__/helpers/legacySetup.ts';

describe('the Jest setup', () => {
  it.each(['jest.unit.config.js', 'jest.live.config.js'])(
    '%s loads legacySetup before every file',
    (config) => {
      const { setupFiles } = require(path.join(PACKAGE, config)) as {
        setupFiles?: string[];
      };
      expect(setupFiles).toEqual([SETUP]);
    },
  );

  it('has the legacy pairs registered in a file that imports none', () => {
    const include = new AdtFunctionIncludeLegacy(
      {} as IAbapConnection,
      undefined,
    );
    const v1 = 'application/vnd.sap.adt.functions.fincludes+xml';
    expect(integrationHeadersOf(include, 'create')).toEqual({
      accept: v1,
      contentType: v1,
    });
  });

  it('has the legacy test configuration registered in a file that imports none', () => {
    const helpers = path.resolve(
      PACKAGE,
      '../adt-clients/src/__tests__/helpers',
    );
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-setup-'));
    try {
      fs.copyFileSync(
        path.join(helpers, 'test-config.yaml.template'),
        path.join(directory, 'test-config.yaml.template'),
      );
      const { loadTestConfig } = require(path.join(helpers, 'test-helper'));
      const config = loadTestConfig(directory);
      expect(config.legacy_env.runner).toBe('abap_unit');
      expect(config.legacy_740.test_cases.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});

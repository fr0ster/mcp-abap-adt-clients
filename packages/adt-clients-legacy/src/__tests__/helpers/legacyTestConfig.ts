/**
 * The legacy package's part of the test configuration
 * (`scripts/legacyTestConfig.js`: its sections and overlay keys), registered
 * with the root harness's loader (`registerTestConfigExtension`). One overlay
 * file — the one `MCP_TEST_OVERLAY` names — then carries the root's keys and
 * these.
 *
 * Loaded by this package's Jest setup (`legacySetup.ts`) and its globalSetup
 * and globalTeardown, so every configuration a legacy suite, helper or admin
 * script reads has these sections; the root package reads none of it.
 */

/** What the root's overlay loader takes as an extension. */
export interface ITestConfigExtension {
  readonly name: string;
  readonly baseFile: string;
  readonly keys: readonly (readonly [
    string,
    Readonly<Record<string, unknown>>,
  ])[];
}

const definition = require('../../../scripts/legacyTestConfig') as {
  LEGACY_CASES: readonly string[];
  LEGACY_OVERLAY_KEYS: ITestConfigExtension['keys'];
  LEGACY_TEST_CONFIG: ITestConfigExtension;
};

const { registerTestConfigExtension } =
  require('../../../../adt-clients/src/__tests__/helpers/test-helper') as {
    registerTestConfigExtension: (extension: ITestConfigExtension) => void;
  };

/** The live checks of the legacy client, off in the base. */
export const LEGACY_CASES = definition.LEGACY_CASES;

/** The overlay keys the legacy sections take. */
export const LEGACY_OVERLAY_KEYS = definition.LEGACY_OVERLAY_KEYS;

export const LEGACY_TEST_CONFIG = definition.LEGACY_TEST_CONFIG;

registerTestConfigExtension(LEGACY_TEST_CONFIG);

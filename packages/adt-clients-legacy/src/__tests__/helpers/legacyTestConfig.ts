/**
 * The legacy package's part of the test configuration, registered with the
 * root harness's loader (`registerTestConfigExtension`): its sections
 * (`test-config.legacy.yaml`, added to the root's base) and the overlay keys
 * that set them. One overlay file — the one `MCP_TEST_OVERLAY` names — then
 * carries the root's keys and these.
 *
 * Loaded by this package's Jest setup (`legacySetup.ts`) and its globalSetup
 * and globalTeardown, so every configuration a legacy suite, helper or admin
 * script reads has these sections; the root package reads none of it.
 */

import * as path from 'node:path';

const { registerTestConfigExtension } =
  require('../../../../adt-clients/src/__tests__/helpers/test-helper') as {
    registerTestConfigExtension: (extension: ITestConfigExtension) => void;
  };

/** What the root's overlay loader takes as an extension. */
export interface ITestConfigExtension {
  name: string;
  baseFile: string;
  keys: [string, Record<string, unknown>][];
}

/** The live checks of the legacy client, off in the base. */
export const LEGACY_CASES = [
  'legacy_deletes',
  'legacy_refusals_send_nothing',
  'legacy_unit_runners',
  'legacy_function_include',
  'legacy_transports',
  'legacy_transportable',
] as const;

/**
 * A legacy system (SAP_BASIS < 7.50): the legacy client, its live checks
 * (over RFC only) and the transportable package its test environment creates
 * (`npm run legacy:setup`). The rules are the root loader's
 * (`ALLOWED_OVERLAY_KEYS` there).
 */
export const LEGACY_OVERLAY_KEYS: [string, Record<string, unknown>][] = [
  ['environment.is_legacy', { type: 'boolean' }],
  ['legacy_env.software_component', {}],
  ['legacy_env.transport_layer', {}],
  // How the env actions run; `manual` where ABAP Unit may not run them.
  ['legacy_env.runner', { values: ['abap_unit', 'manual'] }],
  ...LEGACY_CASES.map((name): [string, Record<string, unknown>] => [
    `legacy_740.test_cases[${name}].enabled`,
    { type: 'boolean' },
  ]),
];

export const LEGACY_TEST_CONFIG: ITestConfigExtension = {
  name: 'legacy',
  baseFile: path.join(__dirname, 'test-config.legacy.yaml'),
  keys: LEGACY_OVERLAY_KEYS,
};

registerTestConfigExtension(LEGACY_TEST_CONFIG);

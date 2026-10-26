/**
 * The legacy package's part of the test configuration, as the root harness's
 * loader takes an extension (`loadTestConfigFrom`'s extensions): its sections
 * (`src/__tests__/helpers/test-config.legacy.yaml`, added to the root's base)
 * and the overlay keys that set them, with the root loader's rules
 * (`ALLOWED_OVERLAY_KEYS` there).
 *
 * Plain node, so both readers load it: the Jest helper
 * `src/__tests__/helpers/legacyTestConfig.ts`, which registers it with the
 * harness, and `scripts/check-config.js` (`npm run check:config`).
 */

const path = require('node:path');

/** The live checks of the legacy client, off in the base. */
const LEGACY_CASES = Object.freeze([
  'legacy_deletes',
  'legacy_refusals_send_nothing',
  'legacy_unit_runners',
  'legacy_function_include',
  'legacy_transports',
  'legacy_transportable',
]);

/**
 * A legacy system (SAP_BASIS < 7.50): the legacy client, its live checks
 * (over RFC only) and the transportable package its test environment creates
 * (`npm run legacy:setup`).
 */
const LEGACY_OVERLAY_KEYS = Object.freeze([
  ['environment.is_legacy', { type: 'boolean' }],
  ['legacy_env.software_component', {}],
  ['legacy_env.transport_layer', {}],
  // How the env actions run; `manual` where ABAP Unit may not run them.
  ['legacy_env.runner', { values: ['abap_unit', 'manual'] }],
  ...LEGACY_CASES.map((name) => [
    `legacy_740.test_cases[${name}].enabled`,
    { type: 'boolean' },
  ]),
]);

const LEGACY_TEST_CONFIG = Object.freeze({
  name: 'legacy',
  baseFile: path.join(
    __dirname,
    '..',
    'src',
    '__tests__',
    'helpers',
    'test-config.legacy.yaml',
  ),
  keys: LEGACY_OVERLAY_KEYS,
});

module.exports = { LEGACY_CASES, LEGACY_OVERLAY_KEYS, LEGACY_TEST_CONFIG };

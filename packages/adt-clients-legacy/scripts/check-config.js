#!/usr/bin/env node
/**
 * Say, before a legacy live run, when the overlay does not fit the base — the
 * root package's `check:config` (`scripts/check-config-drift.js` there), with
 * the legacy sections and keys registered (`legacyTestConfig.js`).
 *
 * One overlay file holds both kinds of keys: the root's (system, packages,
 * transports, …) and the legacy ones (`environment.is_legacy`, `legacy_env.*`,
 * `legacy_740.*`). This check reads it with both key lists, so every key is
 * known and every required root key is asked for. The root package's own
 * `check:config` knows the root keys only, and refuses such an overlay by its
 * legacy keys: it is the check for a modern system's overlay.
 *
 * The overlay is the one `MCP_TEST_OVERLAY` names, resolved against
 * packages/adt-clients, else that package's `test-config.overlay.yaml`.
 * Nothing is printed of any value.
 *
 * Run: npm run check:config (also before npm run test:live)
 */

const {
  HELPERS_DIRECTORY,
} = require('../../adt-clients/scripts/lib/testConfigOverlay');
const { main } = require('../../adt-clients/scripts/check-config-drift');
const { LEGACY_TEST_CONFIG } = require('./legacyTestConfig');

if (require.main === module) {
  main(HELPERS_DIRECTORY, [LEGACY_TEST_CONFIG]);
}

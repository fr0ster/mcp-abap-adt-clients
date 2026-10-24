#!/usr/bin/env node
/**
 * Say when the local overlay does not fit the base.
 *
 * The base (`test-config.yaml.template`) is tracked, so it cannot drift from the
 * checkout. What can be wrong is the one local file, `test-config.overlay.yaml`:
 * a key the base no longer allows, a required key a pull added, a value still a
 * `<PLACEHOLDER>`. Each of those turns into a config failure that reads like a
 * code regression, so this checks them before a run instead of after it:
 * every overlay key allowed, every required one present. The old full
 * `test-config.yaml` is refused. Nothing is printed of any value.
 *
 * No overlay at all is not an error here: unit tests need none. The integration
 * tests then register as configuration defects, which is their own gate.
 *
 * Run: npm run check:config
 */

const {
  HELPERS_DIRECTORY,
  OVERLAY_FILE,
  TestConfigError,
  loadTestConfigFrom,
} = require('./lib/testConfigOverlay');
const fs = require('node:fs');
const path = require('node:path');

/** @returns {{ ok: boolean, message: string }} */
function check(directory = HELPERS_DIRECTORY) {
  if (!fs.existsSync(path.join(directory, OVERLAY_FILE))) {
    // Still refuses the old full file, which makes the loader throw.
    try {
      loadTestConfigFrom(directory);
    } catch (error) {
      if (error instanceof TestConfigError) {
        return { ok: false, message: error.message };
      }
      throw error;
    }
    return {
      ok: true,
      message: `check:config — no ${OVERLAY_FILE} yet. Run \`npm run test:init -- onprem\` (or \`cloud\`) before the integration tests.`,
    };
  }
  try {
    loadTestConfigFrom(directory);
  } catch (error) {
    if (error instanceof TestConfigError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
  return {
    ok: true,
    message: `check:config — ${OVERLAY_FILE} carries only allowed keys and every required one.`,
  };
}

function main(directory = HELPERS_DIRECTORY) {
  const { ok, message } = check(directory);
  (ok ? console.log : console.error)(message);
  process.exit(ok ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { check, main };

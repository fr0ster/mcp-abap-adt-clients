#!/usr/bin/env node
/**
 * The local test configuration is a small overlay over the tracked base
 * (scripts/lib/testConfigOverlay.js). Two commands, neither contacts anything
 * and neither prints a configured value:
 *
 *   npm run test:init -- onprem|cloud   write test-config.overlay.yaml from the
 *                                       tracked form; refuses to overwrite one
 *   npm run test-config:migrate         write test-config.overlay.yaml from an
 *                                       old full test-config.yaml; refuses to
 *                                       overwrite one
 *
 * Both write the overlay MCP_TEST_OVERLAY names when it is set — one per
 * system: src/__tests__/helpers/test-config.overlay.<system>.yaml.
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  HELPERS_DIRECTORY,
  OVERLAY_FILE,
  TestConfigError,
  migrateFullConfig,
  overlayPathFromEnv,
  overlayPathOf,
} = require('./lib/testConfigOverlay');

const FORMS = ['onprem', 'cloud'];

function init(type, directory = HELPERS_DIRECTORY, namedOverlay) {
  if (!FORMS.includes(type)) {
    throw new TestConfigError(
      `Say which system type: \`npm run test:init -- ${FORMS.join('|')}\`. Nothing is guessed.`,
    );
  }
  const target = overlayPathOf(directory, namedOverlay);
  if (fs.existsSync(target)) {
    throw new TestConfigError(
      `${target} already exists — not overwriting it.`,
    );
  }
  fs.copyFileSync(
    path.join(directory, 'overlays', `${type}.yaml`),
    target,
    fs.constants.COPYFILE_EXCL,
  );
  return target;
}

function main(argv = process.argv.slice(2)) {
  const [command, argument] = argv;
  try {
    if (command === 'init') {
      const target = init(argument, HELPERS_DIRECTORY, overlayPathFromEnv());
      console.log(`Created ${target} — replace every <PLACEHOLDER> in it.`);
    } else if (command === 'migrate') {
      const namedOverlay = overlayPathFromEnv();
      const written = migrateFullConfig(HELPERS_DIRECTORY, namedOverlay);
      console.log(
        `Wrote ${path.basename(overlayPathOf(HELPERS_DIRECTORY, namedOverlay))} with ${written.length} key(s): ${written.join(', ')}.\n` +
          'Check that it loads (`npm run check:config`), then delete the old test-config.yaml.',
      );
    } else {
      throw new TestConfigError('Usage: test-config.js init <onprem|cloud> | migrate');
    }
  } catch (error) {
    if (error instanceof TestConfigError) {
      console.error(`test-config — ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}

if (require.main === module) {
  main();
}

module.exports = { init, main };

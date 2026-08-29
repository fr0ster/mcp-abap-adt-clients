#!/usr/bin/env node
/**
 * The template is in git; the config is not. Say when they have drifted.
 *
 * `test-config.yaml` is gitignored, so a pull that adds a section to
 * `test-config.yaml.template` leaves every existing checkout behind — silently.
 * The suite that needs the new section then finds no test case, **skips, and
 * reports PASS having run nothing**, which is the failure this repository keeps
 * paying for: a green run that tested nothing looks exactly like a green run
 * that tested everything.
 *
 * So: compare the top-level sections and report what the template has and the
 * local config does not. It warns rather than fails — the config is the
 * developer's, and a section they deliberately left out is their business. What
 * they must not have is *no idea* that it appeared.
 *
 * Run: npm run check:config
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TEMPLATE = path.join(
  ROOT,
  'src/__tests__/helpers/test-config.yaml.template',
);
const CONFIG = path.join(ROOT, 'src/__tests__/helpers/test-config.yaml');

/**
 * Top-level keys, read without a YAML parser.
 *
 * A dependency is not worth it for "lines that start in column zero and end in
 * a colon", and this file must run before anything is installed.
 */
function sections(file) {
  const found = new Set();
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*):\s*(#.*)?$/.exec(line);
    if (match) {
      found.add(match[1]);
    }
  }
  return found;
}

if (!fs.existsSync(CONFIG)) {
  console.log(
    'check:config — no test-config.yaml yet. Run `npm run test:init` before the integration tests.',
  );
  process.exit(0);
}

const inTemplate = sections(TEMPLATE);
const inConfig = sections(CONFIG);
const missing = [...inTemplate].filter((s) => !inConfig.has(s)).sort();
const extra = [...inConfig].filter((s) => !inTemplate.has(s)).sort();

if (missing.length === 0 && extra.length === 0) {
  console.log(
    `check:config — test-config.yaml carries all ${inTemplate.size} sections the template does.`,
  );
  process.exit(0);
}

if (missing.length > 0) {
  console.warn(
    `\n⚠️  test-config.yaml is missing ${missing.length} section(s) the template has:\n`,
  );
  for (const s of missing) {
    console.warn(`      ${s}`);
  }
  console.warn(
    '\n   A suite whose section is absent finds no test case, skips, and reports\n' +
      '   PASS having run nothing. Copy them from the template, or leave them out\n' +
      '   deliberately — but knowingly.\n',
  );
}

if (extra.length > 0) {
  console.warn(
    `   ${extra.length} section(s) exist locally and not in the template: ${extra.join(', ')}\n` +
      '   Harmless, unless one was renamed upstream and yours is now the old name.\n',
  );
}

// A warning, not a failure: the config belongs to whoever runs the tests.
process.exit(0);

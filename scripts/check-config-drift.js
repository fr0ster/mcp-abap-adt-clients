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
 * local config does not — and, inside `shared_dependencies`, the entries
 * (collection and name) the template lists and the local config does not: a
 * test whose shared object is missing from the config fails or skips naming a
 * dependency nobody told the developer about. Only presence is compared; the
 * values (sources, descriptions, flags) are not. It warns rather than fails — the config is the
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
 * Top-level keys, read without a YAML parser: "lines that start in column zero
 * and end in a colon" need none, and this check works before anything is
 * installed. The shared entries below need the parser, and are skipped (with
 * a note) until it is there.
 */
function sections(file) {
  return sectionsOf(fs.readFileSync(file, 'utf8'));
}

function sectionsOf(text) {
  const found = new Set();
  for (const line of text.split('\n')) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*):\s*(#.*)?$/.exec(line);
    if (match) {
      found.add(match[1]);
    }
  }
  return found;
}

/**
 * `shared_dependencies` entries as `collection/NAME`, read with the YAML
 * library the test helper loads the config with — so a quoted key, an anchor,
 * an alias or a merge key reads as the helper reads it. `null` when the text
 * cannot be read that way (the library not installed yet, or invalid YAML):
 * then the entries are not compared, and the caller says so.
 */
function sharedEntriesOf(text) {
  let YAML;
  try {
    YAML = require('yaml');
  } catch {
    return null;
  }
  let document;
  try {
    document = YAML.parse(text, { merge: true });
  } catch {
    return null;
  }
  const found = new Set();
  const shared = document?.shared_dependencies;
  if (!shared || typeof shared !== 'object') return found;
  for (const [collection, entries] of Object.entries(shared)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (entry && typeof entry.name === 'string') {
        found.add(`${collection}/${entry.name}`);
      }
    }
  }
  return found;
}

/** What the template has and the config lacks, and the other way round. */
function drift(templateText, configText) {
  const inTemplate = sectionsOf(templateText);
  const inConfig = sectionsOf(configText);
  const sharedTemplate = sharedEntriesOf(templateText);
  const sharedConfig = sharedEntriesOf(configText);
  const sharedRead = sharedTemplate !== null && sharedConfig !== null;
  return {
    sections: inTemplate.size,
    missing: [...inTemplate].filter((s) => !inConfig.has(s)).sort(),
    extra: [...inConfig].filter((s) => !inTemplate.has(s)).sort(),
    // Compared only when both files read and the config has the section at
    // all — a missing section is already reported above.
    sharedCompared: sharedRead,
    missingShared:
      sharedRead && inConfig.has('shared_dependencies')
        ? [...sharedTemplate].filter((e) => !sharedConfig.has(e)).sort()
        : [],
  };
}

function main(template = TEMPLATE, config = CONFIG) {
  if (!fs.existsSync(config)) {
    console.log(
      'check:config — no test-config.yaml yet. Run `npm run test:init` before the integration tests.',
    );
    process.exit(0);
  }

  const {
    sections: count,
    missing,
    extra,
    missingShared,
    sharedCompared,
  } = drift(fs.readFileSync(template, 'utf8'), fs.readFileSync(config, 'utf8'));

  if (
    missing.length === 0 &&
    extra.length === 0 &&
    missingShared.length === 0 &&
    sharedCompared
  ) {
    console.log(
      `check:config — test-config.yaml carries all ${count} sections and every shared entry the template does.`,
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

  if (!sharedCompared) {
    console.warn(
      '   shared_dependencies entries not compared: the YAML library is not installed yet, or a file is not valid YAML.\n',
    );
  }

  if (missingShared.length > 0) {
    console.warn(
      `\n⚠️  shared_dependencies lacks ${missingShared.length} entr${missingShared.length === 1 ? 'y' : 'ies'} the template has:\n`,
    );
    for (const e of missingShared) {
      console.warn(`      ${e}`);
    }
    console.warn(
      '\n   A test that ensures one of them fails naming it, or one that reads it skips.\n' +
        '   Copy them from the template (with your own prefix if you rename shared\n' +
        '   objects — then this list names the template entries you have renamed).\n' +
        '   Values are not compared.\n',
    );
  }

  // A warning, not a failure: the config belongs to whoever runs the tests.
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { drift, main, sectionsOf, sharedEntriesOf };

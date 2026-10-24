/**
 * The test configuration is a tracked base plus a small local overlay.
 *
 * - base:    `src/__tests__/helpers/test-config.yaml.template`, in git. Everything
 *            shared — fixtures, test cases, object names, timeouts.
 * - overlay: `src/__tests__/helpers/test-config.overlay.yaml`, gitignored. Only
 *            the keys that differ per system, written FLAT: each key is a path
 *            into the base (`environment.default_package`), a test case inside
 *            a list is picked by its name
 *            (`create_package.test_cases[adt_package].params.package_name`).
 *
 * Nothing is guessed and nothing fails silently: an overlay key outside
 * ALLOWED_OVERLAY_KEYS, a required key the overlay omits, a value still written
 * as a `<PLACEHOLDER>`, and the old full `test-config.yaml` are each refused
 * with a TestConfigError naming what is wrong.
 *
 * What is "a placeholder the developer must replace": the base line of a
 * REQUIRED key carries `← CHANGE` in the template. The list below is the one
 * place that says which keys those are, and
 * `unit/helpers/testConfigOverlay.test.ts` holds it to the template — a
 * required key whose template line lacks the marker, and a marked line whose
 * key is not listed, both fail. An OPTIONAL key is one the overlay may set but
 * whose base value is a valid default (a case that is off, a standard object
 * that exists on most systems).
 *
 * Plain node, no TypeScript: scripts/check-config-drift.js and the helper
 * test-helper.js both load it.
 */

const fs = require('node:fs');
const path = require('node:path');

const BASE_FILE = 'test-config.yaml.template';
const OVERLAY_FILE = 'test-config.overlay.yaml';
/** The pre-overlay local config. Refused when present. */
const OLD_FULL_FILE = 'test-config.yaml';
const HELPERS_DIRECTORY = path.resolve(
  __dirname,
  '..',
  '..',
  'src',
  '__tests__',
  'helpers',
);

const APPEND = 'create_append_structure.test_cases[adt_append_structure].params';
const PACKAGE = 'create_package.test_cases[adt_package].params';
const SCALAR = 'create_scalar_function.test_cases[adt_scalar_function].params';
const SCALAR_IMPL =
  'create_scalar_function_implementation.test_cases[adt_scalar_function_implementation].params';
const TRANSPORT = 'create_transport.test_cases[builder_transport].params';
const ATC_RUN = 'atc_run.test_cases[adt_atc_run]';
const ATC_KINDS = 'atc_object_kinds.test_cases[adt_atc_object_kinds]';
const ENHANCEMENT = 'enhancement.test_cases';

/**
 * Every key an overlay may carry. `required`: the overlay must state it, the
 * base value is only a placeholder.
 */
const ALLOWED_OVERLAY_KEYS = Object.freeze(
  [
    // Which system, and where its objects go.
    ['environment.system', true],
    ['environment.default_package', true],
    ['environment.default_transport', true],
    ['environment.default_master_system', true],
    ['environment.connection_type', false],
    // The shared package (the template's "Lego library").
    ['shared_dependencies.package', true],
    ['shared_dependencies.super_package', true],
    ['shared_dependencies.software_component', true],
    ['shared_dependencies.transport_layer', true],
    ['shared_dependencies.record_changes', true],
    // Cases that create a package or a transport request.
    [`${PACKAGE}.package_name`, true],
    [`${PACKAGE}.software_component`, true],
    [`${PACKAGE}.transport_layer`, true],
    [`${TRANSPORT}.target_system`, true],
    // Names that may collide with something on a particular system.
    [`${SCALAR}.scalar_function_name`, false],
    [`${SCALAR_IMPL}.implementation_name`, false],
    [`${APPEND}.append_structure_name`, false],
    // ATC needs a check variant the system can run.
    [`${ATC_RUN}.enabled`, false],
    [`${ATC_RUN}.params.check_variant`, false],
    [`${ATC_RUN}.params.expected_message_id`, false],
    [`${ATC_RUN}.params.expected_priority`, false],
    [`${ATC_KINDS}.enabled`, false],
    [`${ATC_KINDS}.params.check_variant`, false],
    // Standard objects the enhancement hosts expect, if the system lacks them.
    [`${ENHANCEMENT}[program_host].params.program_name`, false],
    [`${ENHANCEMENT}[function_group_host].params.function_group_name`, false],
    [`${ENHANCEMENT}[include_host].params.include_name`, false],
    [`${ENHANCEMENT}[include_host].params.main_program`, false],
  ].map(([keyPath, required]) => Object.freeze({ path: keyPath, required })),
);

class TestConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TestConfigError';
  }
}

/** `a.b[name].c` → [{key:'a'},{key:'b'},{name:'name'},{key:'c'}]; null if malformed. */
function parsePath(keyPath) {
  const segments = [];
  let current = '';
  const flush = () => {
    if (current === '') return false;
    segments.push({ key: current });
    current = '';
    return true;
  };
  for (let i = 0; i < keyPath.length; i++) {
    const char = keyPath[i];
    if (char === '.') {
      if (!flush()) return null;
    } else if (char === '[') {
      if (current !== '' && !flush()) return null;
      const close = keyPath.indexOf(']', i);
      if (close === -1 || close === i + 1) return null;
      segments.push({ name: keyPath.slice(i + 1, close) });
      i = close;
      if (i + 1 < keyPath.length) {
        // Only a dot may follow a selector, and a key must follow the dot.
        if (keyPath[i + 1] !== '.' || i + 2 >= keyPath.length) return null;
        i++;
      }
    } else {
      current += char;
    }
  }
  if (current !== '' && !flush()) return null;
  return segments.length > 0 && segments[0].key !== undefined ? segments : null;
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Set the value at `keyPath` in `config`. The path must exist but for its last
 * key: the overlay changes the base, it does not grow it.
 * Returns an error text, or null.
 */
function setAt(config, keyPath, value) {
  const segments = parsePath(keyPath);
  if (segments === null) return 'is not a valid key path';
  let node = config;
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    if (segment.key !== undefined) {
      if (!isObject(node) || !(segment.key in node)) {
        return `names "${segment.key}", which the base does not have`;
      }
      node = node[segment.key];
    } else {
      const found = Array.isArray(node)
        ? node.find((item) => isObject(item) && item.name === segment.name)
        : undefined;
      if (found === undefined) {
        return `names the case "${segment.name}", which the base does not have`;
      }
      node = found;
    }
  }
  const last = segments[segments.length - 1];
  if (last.key === undefined || !isObject(node)) {
    return 'does not end in a key';
  }
  node[last.key] = value;
  return null;
}

function isPlaceholder(value) {
  return (
    typeof value === 'string' && value.startsWith('<') && value.endsWith('>')
  );
}

function isScalar(value) {
  return (
    value === null || ['string', 'number', 'boolean'].includes(typeof value)
  );
}

/**
 * The overlay's text → a map of flat keys to scalars. Throws TestConfigError on
 * a document that is not a flat map.
 */
function parseOverlay(text, yaml) {
  let parsed;
  try {
    parsed = yaml.parse(text);
  } catch (error) {
    throw new TestConfigError(
      `${OVERLAY_FILE} is not valid YAML (${error.name}). Fix it or recreate it with \`npm run test:init -- onprem|cloud\`.`,
    );
  }
  if (parsed === null || parsed === undefined) return {};
  if (!isObject(parsed)) {
    throw new TestConfigError(
      `${OVERLAY_FILE} must be a map of flat key paths to values, as in the forms under src/__tests__/helpers/overlays/.`,
    );
  }
  return parsed;
}

/**
 * base + overlay → a new config. Every defect of the overlay is collected and
 * thrown together, so one run names them all.
 */
function applyOverlay(base, overlay) {
  const allowed = new Map(ALLOWED_OVERLAY_KEYS.map((key) => [key.path, key]));
  const problems = [];
  const config = structuredClone(base);

  for (const [keyPath, value] of Object.entries(overlay)) {
    if (!allowed.has(keyPath)) {
      problems.push(
        `unknown key "${keyPath}" — only system-specific keys belong in the overlay (the list is in scripts/lib/testConfigOverlay.js)`,
      );
    } else if (!isScalar(value)) {
      problems.push(
        `"${keyPath}" must be a single value; keys are written flat, one path per line`,
      );
    } else if (isPlaceholder(value)) {
      problems.push(
        `"${keyPath}" is still the placeholder ${value} — replace it`,
      );
    } else {
      const error = setAt(config, keyPath, value);
      if (error !== null) problems.push(`"${keyPath}" ${error}`);
    }
  }
  for (const { path: keyPath, required } of ALLOWED_OVERLAY_KEYS) {
    if (required && !(keyPath in overlay)) {
      problems.push(
        `missing key "${keyPath}" — the base holds only a placeholder for it`,
      );
    }
  }
  if (problems.length > 0) {
    throw new TestConfigError(
      `${OVERLAY_FILE} is not usable:\n  - ${problems.join('\n  - ')}`,
    );
  }
  return config;
}

/** The words a developer with the old full local config gets. */
function oldConfigMessage(directory) {
  return (
    `${path.join(directory, OLD_FULL_FILE)} exists. The test configuration is now ` +
    `the tracked base (${BASE_FILE}) plus a small local overlay (${OVERLAY_FILE}); ` +
    `a full local copy is no longer read, because it goes stale when the base moves. ` +
    'Run `npm run test-config:migrate` to write the overlay from it, then delete the old file.'
  );
}

/**
 * Load the configuration of `directory`.
 * @returns {{ config: object, source: 'base-and-overlay' | 'base-only' }}
 *   `base-only` means no overlay: the base's placeholders are what is in use.
 */
function loadTestConfigFrom(directory = HELPERS_DIRECTORY) {
  const yaml = require('yaml');
  if (fs.existsSync(path.join(directory, OLD_FULL_FILE))) {
    throw new TestConfigError(oldConfigMessage(directory));
  }
  const basePath = path.join(directory, BASE_FILE);
  if (!fs.existsSync(basePath)) {
    throw new TestConfigError(`${basePath} not found — the base is tracked in git.`);
  }
  const base = yaml.parse(fs.readFileSync(basePath, 'utf8')) || {};
  const overlayPath = path.join(directory, OVERLAY_FILE);
  if (!fs.existsSync(overlayPath)) {
    return { config: base, source: 'base-only' };
  }
  const overlay = parseOverlay(fs.readFileSync(overlayPath, 'utf8'), yaml);
  return { config: applyOverlay(base, overlay), source: 'base-and-overlay' };
}

/** The value at `keyPath` in `config`, or `undefined` when the path is absent. */
function readAt(config, keyPath) {
  const segments = parsePath(keyPath);
  if (segments === null) return undefined;
  let node = config;
  for (const segment of segments) {
    if (segment.key !== undefined) {
      if (!isObject(node) || !(segment.key in node)) return undefined;
      node = node[segment.key];
    } else {
      node = Array.isArray(node)
        ? node.find((item) => isObject(item) && item.name === segment.name)
        : undefined;
    }
  }
  return node;
}

/**
 * Migrate: read the old full config of `directory` and write the overlay with
 * the allowed keys it holds. Returns the key paths written (never values).
 * Refuses to overwrite an overlay; refuses an old config that lacks a required
 * key, rather than writing an overlay that will not load.
 */
function migrateFullConfig(directory = HELPERS_DIRECTORY) {
  const yaml = require('yaml');
  const oldPath = path.join(directory, OLD_FULL_FILE);
  const overlayPath = path.join(directory, OVERLAY_FILE);
  if (!fs.existsSync(oldPath)) {
    throw new TestConfigError(
      `Nothing to migrate: ${oldPath} does not exist. Create the overlay with \`npm run test:init -- onprem|cloud\`.`,
    );
  }
  if (fs.existsSync(overlayPath)) {
    throw new TestConfigError(
      `${overlayPath} already exists — not overwriting it. Delete it first if you mean to migrate again.`,
    );
  }
  const old = yaml.parse(fs.readFileSync(oldPath, 'utf8')) || {};
  const overlay = {};
  const missing = [];
  for (const { path: keyPath, required } of ALLOWED_OVERLAY_KEYS) {
    const value = readAt(old, keyPath);
    if (value !== undefined && isScalar(value)) {
      overlay[keyPath] = value;
    } else if (required) {
      missing.push(keyPath);
    }
  }
  if (missing.length > 0) {
    throw new TestConfigError(
      `${OLD_FULL_FILE} has no value for ${missing.join(', ')}; nothing written. Add them there (or write the overlay by hand from a form under src/__tests__/helpers/overlays/).`,
    );
  }
  fs.writeFileSync(
    overlayPath,
    `# Migrated from ${OLD_FULL_FILE}: only the system-specific keys. The rest is\n` +
      `# ${BASE_FILE}. Delete ${OLD_FULL_FILE} once this loads.\n${yaml.stringify(overlay)}`,
    { flag: 'wx' },
  );
  return Object.keys(overlay);
}

module.exports = {
  ALLOWED_OVERLAY_KEYS,
  BASE_FILE,
  OLD_FULL_FILE,
  OVERLAY_FILE,
  HELPERS_DIRECTORY,
  TestConfigError,
  applyOverlay,
  loadTestConfigFrom,
  migrateFullConfig,
  oldConfigMessage,
  parseOverlay,
  parsePath,
  readAt,
};

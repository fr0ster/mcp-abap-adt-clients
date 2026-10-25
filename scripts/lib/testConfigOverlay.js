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
 * One checkout serves several systems: `MCP_TEST_OVERLAY` names the overlay a
 * run reads in place of `test-config.overlay.yaml` (relative to the repository
 * root, or absolute) — `src/__tests__/helpers/test-config.overlay.<system>.yaml`,
 * one per system, gitignored by pattern. A named overlay that does not
 * exist is refused; the default one is never read in its place.
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
const REPOSITORY_ROOT = path.resolve(__dirname, '..', '..');
const HELPERS_DIRECTORY = path.join(
  REPOSITORY_ROOT,
  'src',
  '__tests__',
  'helpers',
);
/** The variable that names the overlay a run reads. */
const OVERLAY_VARIABLE = 'MCP_TEST_OVERLAY';

/**
 * The overlay `MCP_TEST_OVERLAY` names, resolved against the repository root
 * when relative; `undefined` only when the variable is not set. Set but blank
 * — `MCP_TEST_OVERLAY="$OVERLAY"` with `$OVERLAY` empty — is refused: it names
 * no file, and reading the default would run on another system's values.
 */
function overlayPathFromEnv(env = process.env) {
  const raw = env[OVERLAY_VARIABLE];
  if (raw === undefined) return undefined;
  const value = raw.trim();
  if (value === '') {
    throw new TestConfigError(
      `${OVERLAY_VARIABLE} is set but names no file. Name the overlay of the system this run is for, or unset the variable to read ${OVERLAY_FILE}.`,
    );
  }
  return path.resolve(REPOSITORY_ROOT, value);
}

/** The overlay of `directory`: the named one, else the default file there. */
function overlayPathOf(directory, namedOverlay) {
  return namedOverlay ?? path.join(directory, OVERLAY_FILE);
}

/**
 * Every key an overlay may carry.
 *
 * - `required`: the overlay must state it, the base value is only a placeholder.
 * - `type`: `string` (default), `boolean` or `integer`. `null` is refused for
 *   every key (an empty YAML value must never read as "not set": consumers fall
 *   back to another key when a value is absent), and a quoted `"true"` is not a
 *   boolean.
 * - `empty`: a string key where "" is a legitimate stated value; every other
 *   string must be non-empty. The exceptions, each by what "" means:
 *     default_transport, shared transport_layer, create_package transport_layer
 *       — a local ($TMP) package or a cloud system has none;
 *     default_master_system, target_system — cloud supplies / needs none;
 *     shared_dependencies.software_component — cloud has none;
 *     check_variant — "" asks the system for its nominated variant.
 * - `values`: the only values a string may take.
 */
const PACKAGE = 'create_package.test_cases[adt_package].params';
const TRANSPORT = 'create_transport.test_cases[builder_transport].params';
const SCALAR = 'create_scalar_function.test_cases[adt_scalar_function].params';
const SCALAR_IMPL =
  'create_scalar_function_implementation.test_cases[adt_scalar_function_implementation].params';
const APPEND =
  'create_append_structure.test_cases[adt_append_structure].params';
const ATC_RUN = 'atc_run.test_cases[adt_atc_run]';
const FEATURE_TOGGLE = 'create_feature_toggle.test_cases[adt_feature_toggle]';
const CHECK_RUN = 'check_run.test_cases[class_check]';
const ATC_KINDS = 'atc_object_kinds.test_cases[adt_atc_object_kinds]';
const ENHANCEMENT = 'enhancement.test_cases';
/** The live checks of the legacy client, off in the base. */
const LEGACY_CASES = [
  'legacy_deletes',
  'legacy_refusals_send_nothing',
  'legacy_unit_runners',
  'legacy_function_include',
  'legacy_transports',
  'legacy_transportable',
];

const ALLOWED_OVERLAY_KEYS = Object.freeze(
  [
    // Which system, and where its objects go.
    ['environment.system', { required: true, values: ['onprem', 'cloud'] }],
    ['environment.default_package', { required: true }],
    ['environment.default_transport', { required: true, empty: true }],
    ['environment.default_master_system', { required: true, empty: true }],
    ['environment.connection_type', { values: ['rfc', 'http'] }],
    // Checks whose outcome depends on how the system routes sessions: stated
    // per system, required, never defaulted. On, any refusal fails; off, the
    // check is not made and the run says so.
    ['environment.verify_lock_released', { required: true, type: 'boolean' }],
    [
      'environment.read_message_class_after_create',
      { required: true, type: 'boolean' },
    ],
    [
      'environment.validate_transformation_names',
      { required: true, type: 'boolean' },
    ],
    // The shared package (the template's "Lego library").
    ['shared_dependencies.package', { required: true }],
    ['shared_dependencies.super_package', { required: true }],
    ['shared_dependencies.software_component', { required: true, empty: true }],
    ['shared_dependencies.transport_layer', { required: true, empty: true }],
    ['shared_dependencies.record_changes', { required: true, type: 'boolean' }],
    // Cases that create a package or a transport request.
    [`${PACKAGE}.package_name`, { required: true }],
    [`${PACKAGE}.software_component`, { required: true }],
    [`${PACKAGE}.transport_layer`, { required: true, empty: true }],
    [`${TRANSPORT}.target_system`, { required: true, empty: true }],
    // Names that may collide with something on a particular system.
    [`${SCALAR}.scalar_function_name`, {}],
    [`${SCALAR_IMPL}.implementation_name`, {}],
    [`${APPEND}.append_structure_name`, {}],
    // Whether a case runs on this system is the configuration's: a refusal
    // fails the test, it never turns into a skip.
    [
      'create_scalar_function.test_cases[adt_scalar_function].enabled',
      { type: 'boolean' },
    ],
    [
      'create_scalar_function_implementation.test_cases[adt_scalar_function_implementation].enabled',
      { type: 'boolean' },
    ],
    [
      'create_append_structure.test_cases[adt_append_structure].enabled',
      { type: 'boolean' },
    ],
    [`${FEATURE_TOGGLE}.enabled`, { type: 'boolean' }],
    [`${CHECK_RUN}.enabled`, { type: 'boolean' }],
    // Where the function module / include flows get their function group:
    // the shared one, or one in the default package (no shared package on
    // this system). Stated here, never a recovery from a failed shared setup.
    [
      'create_function_module.test_cases[adt_function_module].params.function_group_route',
      { values: ['shared', 'default_package'] },
    ],
    [
      'create_function_include.test_cases[adt_function_include].params.function_group_route',
      { values: ['shared', 'default_package'] },
    ],
    // ATC needs a check variant the system can run.
    [`${ATC_RUN}.enabled`, { type: 'boolean' }],
    [`${ATC_RUN}.params.check_variant`, { empty: true }],
    [`${ATC_RUN}.params.expected_message_id`, {}],
    [`${ATC_RUN}.params.expected_priority`, { type: 'integer' }],
    [`${ATC_KINDS}.enabled`, { type: 'boolean' }],
    [`${ATC_KINDS}.params.check_variant`, { empty: true }],
    // Standard objects the enhancement hosts expect, if the system lacks them.
    [`${ENHANCEMENT}[program_host].params.program_name`, {}],
    [`${ENHANCEMENT}[function_group_host].params.function_group_name`, {}],
    [`${ENHANCEMENT}[include_host].params.include_name`, {}],
    [`${ENHANCEMENT}[include_host].params.main_program`, {}],
    // A legacy system (SAP_BASIS < 7.50): the legacy client, its live checks
    // (over RFC only) and the transportable package its test environment
    // creates (`npm run legacy:setup`).
    ['environment.is_legacy', { type: 'boolean' }],
    ['legacy_env.software_component', {}],
    ['legacy_env.transport_layer', {}],
    ...LEGACY_CASES.map((name) => [
      `legacy_740.test_cases[${name}].enabled`,
      { type: 'boolean' },
    ]),
  ].map(([keyPath, rule]) =>
    Object.freeze({
      path: keyPath,
      required: rule.required === true,
      type: rule.type ?? 'string',
      empty: rule.empty === true,
      values: rule.values,
    }),
  ),
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

/** Why `value` is not acceptable for `rule`, or null. */
function invalidValue(rule, value) {
  if (value === null || value === undefined) {
    return 'has no value (an empty entry is not "unset" — write the value, or "" where that is allowed)';
  }
  if (rule.type === 'boolean') {
    return typeof value === 'boolean'
      ? null
      : 'must be true or false, unquoted';
  }
  if (rule.type === 'integer') {
    return Number.isInteger(value) ? null : 'must be an integer';
  }
  if (typeof value !== 'string') return 'must be a string';
  if (rule.values !== undefined && !rule.values.includes(value)) {
    return `must be one of ${rule.values.join(', ')}`;
  }
  if (value === '' && !rule.empty) return 'must not be empty';
  return null;
}

/**
 * The overlay's text → a map of flat keys to scalars. Throws TestConfigError on
 * a document that is not a flat map.
 */
function parseOverlay(text, yaml, label = OVERLAY_FILE) {
  let parsed;
  try {
    parsed = yaml.parse(text);
  } catch (error) {
    throw new TestConfigError(
      `${label} is not valid YAML (${error.name}). Fix it or recreate it with \`npm run test:init -- onprem|cloud\`.`,
    );
  }
  if (parsed === null || parsed === undefined) return {};
  if (!isObject(parsed)) {
    throw new TestConfigError(
      `${label} must be a map of flat key paths to values, as in the forms under src/__tests__/helpers/overlays/.`,
    );
  }
  return parsed;
}

/**
 * Placeholders that survive the merge where a consumer would read them: the
 * `environment` and `shared_dependencies` values, and every param of an ENABLED
 * test case. A disabled case may keep its placeholders (the ATC case is off
 * until the overlay turns it on — and then its `<CHECK_VARIANT>` must have been
 * replaced). Returns problem texts naming the key path.
 */
function leftoverPlaceholders(config) {
  const found = [];
  const scan = (node, prefix) => {
    if (isPlaceholder(node)) {
      found.push(
        `"${prefix}" is still the placeholder ${node} where it is read — set it in the overlay`,
      );
    } else if (Array.isArray(node)) {
      node.forEach((item, index) => {
        const name =
          isObject(item) && typeof item.name === 'string' ? item.name : null;
        scan(
          item,
          name === null ? `${prefix}[${index}]` : `${prefix}[${name}]`,
        );
      });
    } else if (isObject(node)) {
      for (const [key, value] of Object.entries(node)) {
        scan(value, prefix === '' ? key : `${prefix}.${key}`);
      }
    }
  };
  scan(config.environment, 'environment');
  scan(config.shared_dependencies, 'shared_dependencies');
  for (const [section, body] of Object.entries(config)) {
    const cases = isObject(body) ? body.test_cases : undefined;
    if (!Array.isArray(cases)) continue;
    for (const testCase of cases) {
      if (isObject(testCase) && testCase.enabled === true) {
        scan(testCase, `${section}.test_cases[${testCase.name}]`);
      }
    }
  }
  return found;
}

/**
 * base + overlay → a new config. Every defect of the overlay is collected and
 * thrown together, so one run names them all.
 */
function applyOverlay(base, overlay, label = OVERLAY_FILE) {
  const allowed = new Map(ALLOWED_OVERLAY_KEYS.map((key) => [key.path, key]));
  const problems = [];
  const config = structuredClone(base);

  for (const [keyPath, value] of Object.entries(overlay)) {
    const rule = allowed.get(keyPath);
    if (rule === undefined) {
      problems.push(
        `unknown key "${keyPath}" — only system-specific keys belong in the overlay (the list is in scripts/lib/testConfigOverlay.js)`,
      );
    } else if (isObject(value) || Array.isArray(value)) {
      problems.push(
        `"${keyPath}" must be a single value; keys are written flat, one path per line`,
      );
    } else if (isPlaceholder(value)) {
      problems.push(
        `"${keyPath}" is still the placeholder ${value} — replace it`,
      );
    } else if (invalidValue(rule, value) !== null) {
      problems.push(`"${keyPath}" ${invalidValue(rule, value)}`);
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
  if (problems.length === 0) problems.push(...leftoverPlaceholders(config));
  if (problems.length > 0) {
    throw new TestConfigError(
      `${label} is not usable:\n  - ${problems.join('\n  - ')}`,
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
 * @param {string} [namedOverlay] the overlay `MCP_TEST_OVERLAY` names
 *   ({@link overlayPathFromEnv}); refused when it does not exist
 * @returns {{ config: object, source: 'base-and-overlay' | 'base-only' }}
 *   `base-only` means no overlay: the base's placeholders are what is in use.
 */
function loadTestConfigFrom(directory = HELPERS_DIRECTORY, namedOverlay) {
  const yaml = require('yaml');
  if (fs.existsSync(path.join(directory, OLD_FULL_FILE))) {
    throw new TestConfigError(oldConfigMessage(directory));
  }
  const basePath = path.join(directory, BASE_FILE);
  if (!fs.existsSync(basePath)) {
    throw new TestConfigError(
      `${basePath} not found — the base is tracked in git.`,
    );
  }
  const base = yaml.parse(fs.readFileSync(basePath, 'utf8')) || {};
  const overlayPath = overlayPathOf(directory, namedOverlay);
  if (!fs.existsSync(overlayPath)) {
    if (namedOverlay !== undefined) {
      throw new TestConfigError(
        `${OVERLAY_VARIABLE} names ${overlayPath}, which does not exist. Create it with \`${OVERLAY_VARIABLE}=… npm run test:init -- onprem|cloud\`; ${OVERLAY_FILE} is not read in its place.`,
      );
    }
    return { config: base, source: 'base-only' };
  }
  const label = path.basename(overlayPath);
  const overlay = parseOverlay(
    fs.readFileSync(overlayPath, 'utf8'),
    yaml,
    label,
  );
  return {
    config: applyOverlay(base, overlay, label),
    source: 'base-and-overlay',
  };
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
 * key, rather than writing an overlay that will not load. Writes the overlay
 * `namedOverlay` names when given.
 */
function migrateFullConfig(directory = HELPERS_DIRECTORY, namedOverlay) {
  const yaml = require('yaml');
  const oldPath = path.join(directory, OLD_FULL_FILE);
  const overlayPath = overlayPathOf(directory, namedOverlay);
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
  for (const rule of ALLOWED_OVERLAY_KEYS) {
    const value = readAt(old, rule.path);
    if (
      value !== undefined &&
      !isPlaceholder(value) &&
      invalidValue(rule, value) === null
    ) {
      overlay[rule.path] = value;
    } else if (rule.required) {
      missing.push(rule.path);
    }
  }
  if (missing.length > 0) {
    throw new TestConfigError(
      `${OLD_FULL_FILE} has no valid value for ${missing.join(', ')}; nothing written. Add them there (or write the overlay by hand from a form under src/__tests__/helpers/overlays/).`,
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
  OVERLAY_VARIABLE,
  HELPERS_DIRECTORY,
  TestConfigError,
  overlayPathFromEnv,
  overlayPathOf,
  applyOverlay,
  loadTestConfigFrom,
  migrateFullConfig,
  oldConfigMessage,
  parseOverlay,
  parsePath,
  readAt,
};

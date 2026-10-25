import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as yaml from 'yaml';

const overlayLib = require('../../../../scripts/lib/testConfigOverlay');
const { init } = require('../../../../scripts/test-config');
const { check, checkNamed } = require('../../../../scripts/check-config-drift');

const {
  ALLOWED_OVERLAY_KEYS,
  BASE_FILE,
  OLD_FULL_FILE,
  OVERLAY_FILE,
  TestConfigError,
  loadTestConfigFrom,
  migrateFullConfig,
} = overlayLib;

const HELPERS = path.resolve(__dirname, '..', '..', 'helpers');
const MARKER = '← CHANGE';

/** A base small enough to read, shaped like the real one. */
const BASE = [
  'environment:',
  '  system: "onprem"   # ← CHANGE',
  '  default_package: "<DEV_PACKAGE>"   # ← CHANGE',
  '  default_transport: ""   # ← CHANGE',
  '  default_master_system: ""   # ← CHANGE',
  '  skip_cleanup: false',
  '  verify_lock_released: true   # ← CHANGE',
  '  read_message_class_after_create: true   # ← CHANGE',
  '  validate_transformation_names: true   # ← CHANGE',
  'shared_dependencies:',
  '  package: "ZAC_SHR_PKG"   # ← CHANGE',
  '  super_package: "<DEV_PACKAGE>"   # ← CHANGE',
  '  software_component: ""   # ← CHANGE',
  '  transport_layer: ""   # ← CHANGE',
  '  record_changes: false   # ← CHANGE',
  'create_package:',
  '  test_cases:',
  '    - name: "adt_package"',
  '      params:',
  '        package_name: "<DEV_PACKAGE>"   # ← CHANGE',
  '        software_component: "HOME"   # ← CHANGE',
  '        transport_layer: ""   # ← CHANGE',
  '        test_package: "ZAC_INNER_PKG02"',
  'create_transport:',
  '  test_cases:',
  '    - name: "builder_transport"',
  '      params:',
  '        target_system: ""   # ← CHANGE',
  'atc_run:',
  '  test_cases:',
  '    - name: "adt_atc_run"',
  '      enabled: false',
  '      params:',
  '        class_name: "ZAC_SHR_ATC_DIRTY"',
  '        check_variant: "<CHECK_VARIANT>"   # ← CHANGE',
  'other:',
  '  test_cases:',
  '    - name: "always_on"',
  '      enabled: true',
  '      params:',
  '        thing: "fine"',
  '',
].join('\n');

/** Every required key, with a value of its own. */
const FULL_OVERLAY: Record<string, string | boolean> = {
  'environment.system': 'cloud',
  'environment.default_package': 'ZPKG',
  'environment.default_transport': 'TRK900001',
  'environment.default_master_system': 'SID',
  'environment.verify_lock_released': false,
  'environment.read_message_class_after_create': false,
  'environment.validate_transformation_names': false,
  'shared_dependencies.package': 'ZSHR',
  'shared_dependencies.super_package': 'ZPKG',
  'shared_dependencies.software_component': 'SWC',
  'shared_dependencies.transport_layer': 'ZL',
  'shared_dependencies.record_changes': true,
  'create_package.test_cases[adt_package].params.package_name': 'ZPARENT',
  'create_package.test_cases[adt_package].params.software_component': 'SWC2',
  'create_package.test_cases[adt_package].params.transport_layer': 'ZL2',
  'create_transport.test_cases[builder_transport].params.target_system': 'TGT',
};

let directory: string;

function put(name: string, text: string): string {
  const file = path.join(directory, name);
  fs.writeFileSync(file, text);
  return file;
}

function overlayText(entries: Record<string, unknown>): string {
  return yaml.stringify(entries);
}

function refusal(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(TestConfigError);
    return (error as Error).message;
  }
  throw new Error('expected a TestConfigError');
}

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'test-config-overlay-'));
  put(BASE_FILE, BASE);
});

afterEach(() => {
  fs.rmSync(directory, { recursive: true, force: true });
});

describe('merging the base and the overlay', () => {
  it('lets an allowed overlay key win and leaves the rest of the base alone', () => {
    put(OVERLAY_FILE, overlayText(FULL_OVERLAY));
    const { config, source } = loadTestConfigFrom(directory);
    expect(source).toBe('base-and-overlay');
    expect(config.environment.default_package).toBe('ZPKG');
    expect(config.environment.skip_cleanup).toBe(false);
    expect(config.shared_dependencies.record_changes).toBe(true);
    const params = config.create_package.test_cases[0].params;
    expect(params.package_name).toBe('ZPARENT');
    expect(params.software_component).toBe('SWC2');
    expect(params.test_package).toBe('ZAC_INNER_PKG02');
  });

  it('takes an empty string as a stated value, not as an omission', () => {
    put(
      OVERLAY_FILE,
      overlayText({ ...FULL_OVERLAY, 'environment.default_transport': '' }),
    );
    expect(
      loadTestConfigFrom(directory).config.environment.default_transport,
    ).toBe('');
  });

  it('uses the base alone, and says so, when there is no overlay', () => {
    const { config, source } = loadTestConfigFrom(directory);
    expect(source).toBe('base-only');
    expect(config.environment.default_package).toBe('<DEV_PACKAGE>');
  });

  it('refuses an overlay key that is not allowed, naming it', () => {
    put(
      OVERLAY_FILE,
      overlayText({ ...FULL_OVERLAY, 'environment.skip_cleanup': true }),
    );
    expect(refusal(() => loadTestConfigFrom(directory))).toContain(
      'unknown key "environment.skip_cleanup"',
    );
  });

  it('refuses a required key the overlay omits, naming it', () => {
    const { 'shared_dependencies.package': _omitted, ...rest } = FULL_OVERLAY;
    put(OVERLAY_FILE, overlayText(rest));
    expect(refusal(() => loadTestConfigFrom(directory))).toContain(
      'missing key "shared_dependencies.package"',
    );
  });

  it('refuses an empty overlay by listing every required key', () => {
    put(OVERLAY_FILE, '');
    const message = refusal(() => loadTestConfigFrom(directory));
    for (const key of ALLOWED_OVERLAY_KEYS.filter(
      (k: { required: boolean }) => k.required,
    )) {
      expect(message).toContain(`missing key "${key.path}"`);
    }
  });

  it('refuses a value that is still a placeholder, naming the key', () => {
    put(
      OVERLAY_FILE,
      overlayText({
        ...FULL_OVERLAY,
        'environment.default_package': '<DEV_PACKAGE>',
      }),
    );
    expect(refusal(() => loadTestConfigFrom(directory))).toContain(
      '"environment.default_package" is still the placeholder',
    );
  });

  it('refuses a nested value: keys are flat', () => {
    put(
      OVERLAY_FILE,
      overlayText({ ...FULL_OVERLAY, environment: { system: 'cloud' } }),
    );
    const message = refusal(() => loadTestConfigFrom(directory));
    expect(message).toContain('unknown key "environment"');
    const nested = { ...FULL_OVERLAY, 'environment.system': { a: 1 } };
    put(OVERLAY_FILE, overlayText(nested));
    expect(refusal(() => loadTestConfigFrom(directory))).toContain(
      '"environment.system" must be a single value',
    );
  });

  it('names the case when the base has no such test case', () => {
    const base = BASE.replace('"builder_transport"', '"renamed"');
    put(BASE_FILE, base);
    put(OVERLAY_FILE, overlayText(FULL_OVERLAY));
    expect(refusal(() => loadTestConfigFrom(directory))).toContain(
      'names the case "builder_transport"',
    );
  });

  it('refuses an overlay that is not YAML', () => {
    put(OVERLAY_FILE, 'a: [unclosed\n');
    expect(refusal(() => loadTestConfigFrom(directory))).toContain(
      'is not valid YAML',
    );
  });
});

describe('values are validated by type, not only by presence', () => {
  const ATC = 'atc_run.test_cases[adt_atc_run]';
  const refuses = (entries: Record<string, unknown>, fragment: string) => {
    put(OVERLAY_FILE, overlayText({ ...FULL_OVERLAY, ...entries }));
    expect(refusal(() => loadTestConfigFrom(directory))).toContain(fragment);
  };

  it('refuses an empty entry (null) for a required key, naming it', () => {
    put(
      OVERLAY_FILE,
      overlayText(FULL_OVERLAY).replace(
        'shared_dependencies.package: ZSHR',
        'shared_dependencies.package:',
      ),
    );
    expect(refusal(() => loadTestConfigFrom(directory))).toContain(
      '"shared_dependencies.package" has no value',
    );
  });

  it('refuses null for a key where "" is allowed', () => {
    refuses(
      { 'environment.default_transport': null },
      '"environment.default_transport" has no value',
    );
  });

  it('refuses a quoted boolean', () => {
    refuses(
      { 'shared_dependencies.record_changes': 'true' },
      '"shared_dependencies.record_changes" must be true or false',
    );
  });

  it('refuses an empty string where it is not a statement', () => {
    refuses(
      { 'environment.default_package': '' },
      '"environment.default_package" must not be empty',
    );
  });

  it('accepts "" where it means something', () => {
    put(
      OVERLAY_FILE,
      overlayText({
        ...FULL_OVERLAY,
        'environment.default_transport': '',
        'shared_dependencies.transport_layer': '',
      }),
    );
    expect(() => loadTestConfigFrom(directory)).not.toThrow();
  });

  it('refuses a system outside onprem and cloud and a non-integer priority', () => {
    refuses(
      { 'environment.system': 'prod' },
      '"environment.system" must be one of onprem, cloud',
    );
    refuses({ [`${ATC}.params.expected_priority`]: '2' }, 'must be an integer');
  });

  it('reports every invalid key together', () => {
    put(
      OVERLAY_FILE,
      overlayText({
        ...FULL_OVERLAY,
        'environment.default_package': '',
        'shared_dependencies.record_changes': 'yes',
      }),
    );
    const message = refusal(() => loadTestConfigFrom(directory));
    expect(message).toContain('"environment.default_package"');
    expect(message).toContain('"shared_dependencies.record_changes"');
  });
});

describe('the merged configuration keeps no placeholder where it is read', () => {
  const ATC = 'atc_run.test_cases[adt_atc_run]';

  it('refuses enabling the ATC case without overriding its variant', () => {
    put(
      OVERLAY_FILE,
      overlayText({ ...FULL_OVERLAY, [`${ATC}.enabled`]: true }),
    );
    const message = refusal(() => loadTestConfigFrom(directory));
    expect(message).toContain(
      'atc_run.test_cases[adt_atc_run].params.check_variant',
    );
    expect(message).toContain('<CHECK_VARIANT>');
  });

  it('accepts the enabled case with a variant, or "" for the system\'s own', () => {
    for (const variant of ['DEFAULT', '']) {
      put(
        OVERLAY_FILE,
        overlayText({
          ...FULL_OVERLAY,
          [`${ATC}.enabled`]: true,
          [`${ATC}.params.check_variant`]: variant,
        }),
      );
      expect(() => loadTestConfigFrom(directory)).not.toThrow();
    }
  });

  it('leaves the disabled case alone', () => {
    put(OVERLAY_FILE, overlayText(FULL_OVERLAY));
    expect(() => loadTestConfigFrom(directory)).not.toThrow();
  });

  it('refuses a placeholder left in any enabled case of the base', () => {
    put(BASE_FILE, BASE.replace('thing: "fine"', 'thing: "<SOMETHING>"'));
    put(OVERLAY_FILE, overlayText(FULL_OVERLAY));
    expect(refusal(() => loadTestConfigFrom(directory))).toContain(
      'other.test_cases[always_on].params.thing',
    );
  });

  it('loads the real template with a complete, valid overlay', () => {
    fs.copyFileSync(
      path.join(HELPERS, BASE_FILE),
      path.join(directory, BASE_FILE),
    );
    put(OVERLAY_FILE, overlayText(FULL_OVERLAY));
    expect(() => loadTestConfigFrom(directory)).not.toThrow();
  });
});

describe('the old full test-config.yaml', () => {
  it('is refused, with or without an overlay, and the words say how to migrate', () => {
    put(OLD_FULL_FILE, BASE);
    expect(refusal(() => loadTestConfigFrom(directory))).toContain(
      'npm run test-config:migrate',
    );
    put(OVERLAY_FILE, overlayText(FULL_OVERLAY));
    expect(refusal(() => loadTestConfigFrom(directory))).toContain(
      'npm run test-config:migrate',
    );
  });
});

describe('migrating the old full config', () => {
  const OLD_SECRET = 'S3CRET-VALUE-XYZ';

  function oldConfig(): string {
    const config = yaml.parse(BASE);
    config.environment.system = 'onprem';
    config.environment.default_package = 'ZMIGRATED';
    config.environment.default_transport = 'TRK1';
    config.environment.default_master_system = 'SID';
    config.environment.skip_cleanup = true;
    config.shared_dependencies.package = 'ZSHR';
    config.shared_dependencies.super_package = 'ZMIGRATED';
    config.shared_dependencies.record_changes = true;
    config.shared_dependencies.leaked = OLD_SECRET;
    config.custom_section = { value: OLD_SECRET };
    const params = config.create_package.test_cases[0].params;
    params.package_name = 'ZPARENT';
    params.test_package = OLD_SECRET;
    config.create_transport.test_cases[0].params.target_system = 'TGT';
    return yaml.stringify(config);
  }

  it('writes only the allowed keys, and the overlay then loads', () => {
    put(OLD_FULL_FILE, oldConfig());
    const written: string[] = migrateFullConfig(directory);
    // The required keys, plus the optional one the old file holds with a valid
    // value (its placeholder `check_variant` is not carried).
    expect(written.sort()).toEqual(
      [
        ...ALLOWED_OVERLAY_KEYS.filter(
          (k: { required: boolean }) => k.required,
        ).map((k: { path: string }) => k.path),
        'atc_run.test_cases[adt_atc_run].enabled',
      ].sort(),
    );
    const text = fs.readFileSync(path.join(directory, OVERLAY_FILE), 'utf8');
    expect(text).not.toContain(OLD_SECRET);
    expect(text).not.toContain('skip_cleanup');
    expect(text).not.toContain('custom_section');
    // The old file is the developer's to delete; the loader refuses while it is there.
    fs.rmSync(path.join(directory, OLD_FULL_FILE));
    const { config } = loadTestConfigFrom(directory);
    expect(config.environment.default_package).toBe('ZMIGRATED');
    expect(config.environment.skip_cleanup).toBe(false);
  });

  it('returns key paths, never values', () => {
    put(OLD_FULL_FILE, oldConfig());
    expect(JSON.stringify(migrateFullConfig(directory))).not.toContain(
      'ZMIGRATED',
    );
  });

  it('writes the overlay MCP_TEST_OVERLAY names, leaving the default absent', () => {
    put(OLD_FULL_FILE, oldConfig());
    const named = path.join(directory, 'test-config.overlay.sys.yaml');
    migrateFullConfig(directory, named);
    expect(fs.existsSync(path.join(directory, OVERLAY_FILE))).toBe(false);
    fs.rmSync(path.join(directory, OLD_FULL_FILE));
    expect(
      loadTestConfigFrom(directory, named).config.environment.default_package,
    ).toBe('ZMIGRATED');
  });

  it('refuses to overwrite an existing overlay and leaves it untouched', () => {
    put(OLD_FULL_FILE, oldConfig());
    put(OVERLAY_FILE, 'mine: 1\n');
    expect(refusal(() => migrateFullConfig(directory))).toContain(
      'not overwriting',
    );
    expect(fs.readFileSync(path.join(directory, OVERLAY_FILE), 'utf8')).toBe(
      'mine: 1\n',
    );
  });

  it('refuses an old config that lacks a required key, writing nothing', () => {
    const old = yaml.parse(oldConfig());
    delete old.environment.default_master_system;
    put(OLD_FULL_FILE, yaml.stringify(old));
    expect(refusal(() => migrateFullConfig(directory))).toContain(
      'environment.default_master_system',
    );
    expect(fs.existsSync(path.join(directory, OVERLAY_FILE))).toBe(false);
  });

  it('has nothing to migrate without the old file', () => {
    expect(refusal(() => migrateFullConfig(directory))).toContain(
      'Nothing to migrate',
    );
  });
});

describe('the allowed keys against the real template', () => {
  const text = fs.readFileSync(path.join(HELPERS, BASE_FILE), 'utf8');
  const lines = new yaml.LineCounter();
  const document = yaml.parseDocument(text, { lineCounter: lines });
  const textLines = text.split('\n');

  /** Path of every key/value pair whose line carries the marker. */
  function markedPaths(): string[] {
    const found: string[] = [];
    const walk = (node: unknown, prefix: string): void => {
      if (yaml.isMap(node)) {
        for (const pair of node.items) {
          const key = String((pair.key as yaml.Scalar).value);
          const here = prefix === '' ? key : `${prefix}.${key}`;
          if (yaml.isScalar(pair.value)) {
            const offset = (pair.key as yaml.Scalar).range?.[0] ?? 0;
            const line = lines.linePos(offset).line;
            if ((textLines[line - 1] ?? '').includes(MARKER)) found.push(here);
          } else {
            walk(pair.value, here);
          }
        }
      } else if (yaml.isSeq(node)) {
        for (const item of node.items) {
          const name = yaml.isMap(item) ? item.get('name') : undefined;
          if (typeof name === 'string') walk(item, `${prefix}[${name}]`);
        }
      }
    };
    walk(document.contents, '');
    return found;
  }

  it('keeps a required key exactly where the template marks a value to change', () => {
    const marked = markedPaths();
    const required = ALLOWED_OVERLAY_KEYS.filter(
      (k: { required: boolean }) => k.required,
    ).map((k: { path: string }) => k.path);
    for (const keyPath of required) expect(marked).toContain(keyPath);
    const allowed = ALLOWED_OVERLAY_KEYS.map((k: { path: string }) => k.path);
    for (const keyPath of marked) expect(allowed).toContain(keyPath);
  });

  it('can set every allowed key in the template', () => {
    const base = yaml.parse(text);
    for (const { path: keyPath } of ALLOWED_OVERLAY_KEYS) {
      const clone = structuredClone(base);
      // An overlay of just this key can only fail on the OTHER required keys.
      let message = '';
      try {
        overlayLib.applyOverlay(clone, { [keyPath]: 'x' });
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).not.toContain(`"${keyPath}" names`);
      expect(message).not.toContain(`"${keyPath}" is not a valid`);
      expect(message).not.toContain('unknown key');
    }
  });

  it('marks the shared package, the key the 2026-09-01 run lost unmarked', () => {
    expect(markedPaths()).toContain('shared_dependencies.package');
    expect(markedPaths()).toContain('shared_dependencies.software_component');
  });

  it('tracks forms whose required keys are exactly the required list and name no real value', () => {
    const required = ALLOWED_OVERLAY_KEYS.filter(
      (k: { required: boolean }) => k.required,
    ).map((k: { path: string }) => k.path);
    for (const form of ['onprem', 'cloud']) {
      const formText = fs.readFileSync(
        path.join(HELPERS, 'overlays', `${form}.yaml`),
        'utf8',
      );
      const parsed = yaml.parse(formText);
      expect(Object.keys(parsed).sort()).toEqual([...required].sort());
      expect(parsed['environment.system']).toBe(form);
      // Unedited, a form is refused for its placeholders, never loaded.
      fs.writeFileSync(path.join(directory, OVERLAY_FILE), formText);
      fs.copyFileSync(
        path.join(HELPERS, BASE_FILE),
        path.join(directory, BASE_FILE),
      );
      expect(refusal(() => loadTestConfigFrom(directory))).toContain(
        'is still the placeholder',
      );
    }
  });
});

describe('npm run test:init', () => {
  beforeEach(() => {
    fs.mkdirSync(path.join(directory, 'overlays'));
    fs.writeFileSync(
      path.join(directory, 'overlays', 'cloud.yaml'),
      'form: 1\n',
    );
  });

  it('copies the named form and will not overwrite the overlay', () => {
    const target = init('cloud', directory);
    expect(fs.readFileSync(target, 'utf8')).toBe('form: 1\n');
    fs.writeFileSync(target, 'edited: 1\n');
    expect(refusal(() => init('cloud', directory))).toContain(
      'not overwriting',
    );
    expect(fs.readFileSync(target, 'utf8')).toBe('edited: 1\n');
  });

  it('does not guess the system type', () => {
    expect(refusal(() => init(undefined, directory))).toContain(
      'Say which system type',
    );
  });
});

describe('npm run check:config', () => {
  it('passes a good overlay, fails a defective one, stays quiet without one', () => {
    expect(check(directory).ok).toBe(true);
    expect(check(directory).message).toContain(
      'no test-config.overlay.yaml yet',
    );
    put(OVERLAY_FILE, overlayText(FULL_OVERLAY));
    expect(check(directory)).toEqual({
      ok: true,
      message: expect.stringContaining('only allowed keys'),
    });
    put(OVERLAY_FILE, overlayText({ ...FULL_OVERLAY, nonsense: 1 }));
    const bad = check(directory);
    expect(bad.ok).toBe(false);
    expect(bad.message).toContain('unknown key "nonsense"');
  });

  it('fails on the old full config even without an overlay', () => {
    put(OLD_FULL_FILE, BASE);
    expect(check(directory).ok).toBe(false);
  });
});

/**
 * One checkout, one overlay per system: `MCP_TEST_OVERLAY` names the file a
 * run reads. Editing the one overlay back and forth between systems is how a
 * run ends up on the wrong one.
 */
describe('the overlay MCP_TEST_OVERLAY names', () => {
  const { OVERLAY_VARIABLE, overlayPathFromEnv } = overlayLib;
  const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

  it('is MCP_TEST_OVERLAY', () => {
    expect(OVERLAY_VARIABLE).toBe('MCP_TEST_OVERLAY');
  });

  it('is none when the variable is not set', () => {
    expect(overlayPathFromEnv({})).toBeUndefined();
  });

  it.each(['', '  '])(
    'is refused when the variable is set but blank (%j)',
    (blank) => {
      expect(
        refusal(() => overlayPathFromEnv({ MCP_TEST_OVERLAY: blank })),
      ).toContain('MCP_TEST_OVERLAY is set but names no file');
    },
  );

  it('resolves a relative name against the repository root', () => {
    expect(
      overlayPathFromEnv({
        MCP_TEST_OVERLAY: 'src/__tests__/helpers/test-config.overlay.sys.yaml',
      }),
    ).toBe(
      path.join(
        ROOT,
        'src',
        '__tests__',
        'helpers',
        'test-config.overlay.sys.yaml',
      ),
    );
  });

  it('keeps an absolute path as it is', () => {
    const absolute = path.join(os.tmpdir(), 'elsewhere.yaml');
    expect(overlayPathFromEnv({ MCP_TEST_OVERLAY: absolute })).toBe(absolute);
  });

  it('is read in place of the default overlay', () => {
    put(OVERLAY_FILE, overlayText(FULL_OVERLAY));
    const named = put(
      'test-config.overlay.sys.yaml',
      overlayText({ ...FULL_OVERLAY, 'environment.default_package': 'ZNAMED' }),
    );
    const { config, source } = loadTestConfigFrom(directory, named);
    expect(source).toBe('base-and-overlay');
    expect(config.environment.default_package).toBe('ZNAMED');
  });

  it('is refused when it does not exist, and the default is not read instead', () => {
    put(OVERLAY_FILE, overlayText(FULL_OVERLAY));
    const named = path.join(directory, 'test-config.overlay.absent.yaml');
    const message = refusal(() => loadTestConfigFrom(directory, named));
    expect(message).toContain('MCP_TEST_OVERLAY names');
    expect(message).toContain(named);
  });

  it('is named in its own refusals', () => {
    const named = put('test-config.overlay.sys.yaml', 'unknown.key: 1\n');
    expect(refusal(() => loadTestConfigFrom(directory, named))).toContain(
      'test-config.overlay.sys.yaml is not usable',
    );
  });

  it('is where init writes the form, and the default stays absent', () => {
    fs.mkdirSync(path.join(directory, 'overlays'));
    fs.copyFileSync(
      path.join(HELPERS, 'overlays', 'cloud.yaml'),
      path.join(directory, 'overlays', 'cloud.yaml'),
    );
    const named = path.join(directory, 'test-config.overlay.sys.yaml');
    expect(init('cloud', directory, named)).toBe(named);
    expect(fs.existsSync(named)).toBe(true);
    expect(fs.existsSync(path.join(directory, OVERLAY_FILE))).toBe(false);
  });

  it('fails check:config when set but blank, without reading the default', () => {
    put(OVERLAY_FILE, overlayText(FULL_OVERLAY));
    const result = checkNamed(directory, { MCP_TEST_OVERLAY: ' ' });
    expect(result.ok).toBe(false);
    expect(result.message).toContain(
      'MCP_TEST_OVERLAY is set but names no file',
    );
  });

  it('is what check:config checks, and must exist', () => {
    const absent = path.join(directory, 'test-config.overlay.absent.yaml');
    const missing = check(directory, absent);
    expect(missing.ok).toBe(false);
    expect(missing.message).toContain('MCP_TEST_OVERLAY names');

    const named = put(
      'test-config.overlay.sys.yaml',
      overlayText(FULL_OVERLAY),
    );
    expect(check(directory, named)).toEqual({
      ok: true,
      message:
        'check:config — test-config.overlay.sys.yaml carries only allowed keys and every required one.',
    });
  });
});

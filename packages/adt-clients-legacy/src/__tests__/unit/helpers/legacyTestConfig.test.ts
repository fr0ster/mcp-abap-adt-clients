import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as yaml from 'yaml';
import {
  LEGACY_CASES,
  LEGACY_TEST_CONFIG,
} from '../../helpers/legacyTestConfig';

/**
 * The legacy part of the test configuration, loaded through the root
 * harness's loader as the extension `legacyTestConfig.ts` registers: the
 * legacy cases off in the base, the overlay turning them on, and the env
 * runner's rule. The base is the root package's real template; the
 * overlays are written here.
 */
const overlayLib = require('../../../../../adt-clients/scripts/lib/testConfigOverlay');
const { BASE_FILE, TestConfigError, loadTestConfigFrom } = overlayLib;

const ROOT_HELPERS = path.resolve(
  __dirname,
  '../../../../../adt-clients/src/__tests__/helpers',
);
const EXTENSIONS = [LEGACY_TEST_CONFIG];

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
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'test-config-legacy-'));
});

afterEach(() => {
  fs.rmSync(directory, { recursive: true, force: true });
});

describe('a legacy system in its overlay', () => {
  beforeEach(() => {
    fs.copyFileSync(
      path.join(ROOT_HELPERS, BASE_FILE),
      path.join(directory, BASE_FILE),
    );
  });

  it('keeps every legacy case off in the base', () => {
    const { config } = loadTestConfigFrom(directory, undefined, EXTENSIONS);
    for (const name of LEGACY_CASES) {
      const testCase = config.legacy_740.test_cases.find(
        (c: { name: string }) => c.name === name,
      );
      expect([name, testCase.enabled]).toEqual([name, false]);
    }
  });

  it('turns the legacy client, its checks and its package on', () => {
    const named = put(
      'test-config.overlay.sys.yaml',
      overlayText({
        ...FULL_OVERLAY,
        'environment.system': 'onprem',
        'environment.is_legacy': true,
        'environment.connection_type': 'rfc',
        'legacy_env.software_component': 'ZCUST',
        'legacy_env.transport_layer': 'ZL7',
        ...Object.fromEntries(
          LEGACY_CASES.map((name) => [
            `legacy_740.test_cases[${name}].enabled`,
            true,
          ]),
        ),
      }),
    );
    const { config } = loadTestConfigFrom(directory, named, EXTENSIONS);
    expect(config.environment.is_legacy).toBe(true);
    expect(config.environment.connection_type).toBe('rfc');
    expect(config.legacy_env).toEqual({
      software_component: 'ZCUST',
      transport_layer: 'ZL7',
      runner: 'abap_unit',
    });
    expect(
      config.legacy_740.test_cases
        .filter((c: { name: string }) =>
          (LEGACY_CASES as readonly string[]).includes(c.name),
        )
        .map((c: { enabled: boolean }) => c.enabled),
    ).toEqual(LEGACY_CASES.map(() => true));
  });

  it('states the env runner: abap_unit in the base, manual from an overlay, nothing else', () => {
    expect(
      loadTestConfigFrom(directory, undefined, EXTENSIONS).config.legacy_env
        .runner,
    ).toBe('abap_unit');
    const manual = put(
      'test-config.overlay.sys.yaml',
      overlayText({ ...FULL_OVERLAY, 'legacy_env.runner': 'manual' }),
    );
    expect(
      loadTestConfigFrom(directory, manual, EXTENSIONS).config.legacy_env
        .runner,
    ).toBe('manual');
    const other = put(
      'test-config.overlay.sys.yaml',
      overlayText({ ...FULL_OVERLAY, 'legacy_env.runner': 'sm37' }),
    );
    expect(
      refusal(() => loadTestConfigFrom(directory, other, EXTENSIONS)),
    ).toContain('"legacy_env.runner" must be one of abap_unit, manual');
  });

  it('refuses is_legacy written as a string', () => {
    const named = put(
      'test-config.overlay.sys.yaml',
      overlayText({ ...FULL_OVERLAY, 'environment.is_legacy': 'true' }),
    );
    expect(
      refusal(() => loadTestConfigFrom(directory, named, EXTENSIONS)),
    ).toContain('"environment.is_legacy" must be true or false');
  });
});

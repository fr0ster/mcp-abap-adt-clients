import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as yaml from 'yaml';

const HELPERS = path.resolve(__dirname, '..', '..', 'helpers');

/**
 * The overlay lets `""` stand where it means something (a cloud system has no
 * master system, a local package no transport, ...). A consumer that read the
 * value with `||` would replace that statement with an environment variable or
 * another key. These tests put a competing value in place and ask each consumer.
 */
const COMPETING = {
  SAP_SYSTEM_ID: 'STALE_SID',
  SAP_TRANSPORT: 'STALE_TRK',
  SAP_PACKAGE: 'STALE_PKG',
};

const EMPTY_STATEMENTS: Record<string, string | boolean> = {
  'environment.system': 'cloud',
  'environment.default_package': 'ZPKG',
  'environment.default_transport': '',
  'environment.default_master_system': '',
  'environment.verify_lock_released': true,
  'environment.read_message_class_after_create': true,
  'shared_dependencies.package': 'ZSHR',
  'shared_dependencies.super_package': 'ZPKG',
  'shared_dependencies.software_component': '',
  'shared_dependencies.transport_layer': '',
  'shared_dependencies.record_changes': false,
  'create_package.test_cases[adt_package].params.package_name': 'ZPARENT',
  'create_package.test_cases[adt_package].params.software_component': 'ZLOCAL',
  'create_package.test_cases[adt_package].params.transport_layer': '',
  'create_transport.test_cases[builder_transport].params.target_system': '',
  'atc_run.test_cases[adt_atc_run].enabled': true,
  'atc_run.test_cases[adt_atc_run].params.check_variant': '',
};

let directory: string;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'empty-statements-'));
  fs.copyFileSync(
    path.join(HELPERS, 'test-config.yaml.template'),
    path.join(directory, 'test-config.yaml.template'),
  );
  fs.writeFileSync(
    path.join(directory, 'test-config.overlay.yaml'),
    yaml.stringify(EMPTY_STATEMENTS),
  );
  for (const [name, value] of Object.entries(COMPETING)) {
    saved[name] = process.env[name];
    process.env[name] = value;
  }
});

afterEach(() => {
  fs.rmSync(directory, { recursive: true, force: true });
  for (const name of Object.keys(COMPETING)) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
});

function withHelper(use: (helper: any) => void): void {
  jest.isolateModules(() => {
    const helper = require('../../helpers/test-helper');
    helper.loadTestConfig(directory); // the getters read this one
    use(helper);
  });
}

describe('an explicit "" in the overlay is kept by its consumers', () => {
  it('default_master_system is not replaced by SAP_SYSTEM_ID', () => {
    withHelper((helper) => {
      expect(helper.getDefaultMasterSystem()).toBe('');
      expect(helper.resolveMasterSystem(undefined)).toBe('');
    });
  });

  it('default_master_system still falls back to SAP_SYSTEM_ID when the key is absent', () => {
    withHelper((helper) => {
      const config = helper.loadTestConfig();
      delete config.environment.default_master_system;
      expect(helper.getDefaultMasterSystem()).toBe('STALE_SID');
    });
  });

  it('default_transport is not replaced by SAP_TRANSPORT', () => {
    withHelper((helper) => {
      expect(helper.getDefaultTransport()).toBe('');
      expect(helper.resolveTransportRequest(undefined)).toBe('');
    });
  });

  it('the other documented "" values reach the merged config as ""', () => {
    withHelper((helper) => {
      const config = helper.loadTestConfig();
      expect(config.shared_dependencies.software_component).toBe('');
      expect(config.shared_dependencies.transport_layer).toBe('');
      const pkg = config.create_package.test_cases[0].params;
      expect(pkg.transport_layer).toBe('');
      expect(config.create_transport.test_cases[0].params.target_system).toBe(
        '',
      );
      const atc = config.atc_run.test_cases.find(
        (c: { name: string }) => c.name === 'adt_atc_run',
      );
      expect(atc.params.check_variant).toBe('');
      // The shared package is its own key: the dev package does not stand in.
      expect(helper.getSharedPackage()).toBe('ZSHR');
    });
  });
});

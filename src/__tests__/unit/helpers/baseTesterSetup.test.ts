/**
 * Whether a case applies is decided when the test is registered (`gate`), so
 * `BaseTester` never reports "does not apply": a case it cannot set up is a
 * test that fails with the reason.
 */
let mockConfig: unknown;

jest.mock('../../helpers/test-helper', () => ({
  ...jest.requireActual('../../helpers/test-helper'),
  loadTestConfig: () => mockConfig,
  ensurePackageConfig: (params: { package_name?: string }) =>
    params.package_name
      ? { success: true }
      : { success: false, reason: 'package_name is not configured' },
}));

import { BaseTester } from '../../helpers/BaseTester';

interface ICase {
  name: string;
  enabled?: boolean;
  params: Record<string, unknown>;
}

const KEY = 'create_thing';
const NAME = 'adt_thing';

function config(testCase?: ICase) {
  return {
    environment: { system: 'onprem' },
    [KEY]: { test_cases: testCase ? [testCase] : [] },
  };
}

function testerFor(
  hasConfig = true,
  buildConfig: (testCase: unknown) => unknown = () => ({ thingName: 'ZTHING' }),
) {
  const tester = new BaseTester<{ thingName: string }>(
    {} as never,
    'Thing',
    KEY,
    NAME,
  );
  tester.setup({
    connection: {} as never,
    client: {} as never,
    hasConfig,
    isCloudSystem: false,
    buildConfig: buildConfig as never,
  });
  return tester;
}

const ready = (): ICase => ({
  name: NAME,
  enabled: true,
  params: { package_name: 'ZPKG' },
});

describe('BaseTester setup of a registered case', () => {
  it('hands the config of an enabled case to the test', async () => {
    mockConfig = config(ready());
    const tester = testerFor();
    await tester.beforeEach()();
    await expect(tester.requireConfig()).resolves.toEqual({
      thingName: 'ZTHING',
    });
  });

  it('fails for a case missing from the configuration, naming it', async () => {
    mockConfig = config();
    const tester = testerFor();
    await tester.beforeEach()();
    await expect(tester.requireConfig()).rejects.toThrow(
      `case ${KEY}/${NAME} not in test-config.yaml`,
    );
    await expect(tester.flowTestAuto()).rejects.toThrow(
      `case ${KEY}/${NAME} not in test-config.yaml`,
    );
  });

  it('fails for a case that is not enabled, rather than running it', async () => {
    mockConfig = config({ ...ready(), enabled: false });
    const tester = testerFor();
    await tester.beforeEach()();
    await expect(tester.requireConfig()).rejects.toThrow('is not enabled');
  });

  it('fails for a case with no package', async () => {
    mockConfig = config({ name: NAME, enabled: true, params: {} });
    const tester = testerFor();
    await tester.beforeEach()();
    await expect(tester.requireConfig()).rejects.toThrow(
      'package_name is not configured',
    );
  });

  it('fails when the SAP setup did not complete', async () => {
    mockConfig = config(ready());
    const tester = testerFor(false);
    await tester.beforeEach()();
    await expect(tester.requireConfig()).rejects.toThrow(
      'No SAP configuration',
    );
  });

  it('fails when the config cannot be built', async () => {
    mockConfig = config(ready());
    const tester = testerFor(true, () => {
      throw new Error('no thing_name');
    });
    await tester.beforeEach()();
    await expect(tester.flowTestAuto()).rejects.toThrow(
      'Failed to build config: no thing_name',
    );
  });

  it('leaves availability to the gate', async () => {
    // A case unavailable here is registered as skipped by the gate; setup does
    // not decide a second time, and so cannot turn it into a quiet return.
    mockConfig = config({ ...ready(), available_in: ['cloud'] } as ICase);
    const tester = testerFor();
    await tester.beforeEach()();
    await expect(tester.requireConfig()).resolves.toEqual({
      thingName: 'ZTHING',
    });
  });

  it('asks to be set up before it reads the config', async () => {
    mockConfig = config(ready());
    await expect(testerFor().requireConfig()).rejects.toThrow(
      'ensure beforeEach() was called',
    );
  });
});

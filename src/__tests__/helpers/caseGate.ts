import { TestConfigResolver } from './TestConfigResolver';

const { loadTestConfig, loadTestEnv, isTestConfigTemplate } =
  require('./test-helper');

export { isTestConfigTemplate };

export const MISSING_TEST_CONFIG =
  'test-config.overlay.yaml missing — run `npm run test:init -- onprem` (or `cloud`) and fill it in';

export function missingCaseMessage(
  handlerName: string,
  testCaseName: string,
): string {
  return `case ${handlerName}/${testCaseName} not in test-config.yaml`;
}

type ConfigLoader = () => any;

/** Named-case lookup without test-helper's implicit environment filtering. */
export function configuredCase(
  handlerName: string,
  testCaseName: string,
  loadConfig: ConfigLoader = loadTestConfig,
): any {
  const config = loadConfig();
  return config?.[handlerName]?.test_cases?.find(
    (testCase: { name: string }) => testCase.name === testCaseName,
  );
}

/**
 * How a test is registered when the configuration itself is defective (broken,
 * a template, a case or section missing): it runs, so the setup can fail with
 * the reason. It is `it` under another name so that `gateAll` can tell it from
 * an applicable case, and no applicability predicate can turn it into a skip.
 */
export const configurationDefect: jest.It = Object.assign(
  ((...args: Parameters<jest.It>) => it(...args)) as jest.It,
  it,
);

type GateDependencies = {
  loadEnv?: () => void;
  sapConfigured?: () => boolean;
  templateInUse?: () => boolean;
};

type Preflight =
  | { register: jest.It }
  | { register?: undefined; config: any; environment: any };

/**
 * What every registration decides first, before it looks at a case or an
 * object: a machine with no SAP skips, a broken configuration registers
 * normally so the setup failure surfaces.
 */
function preflight(
  loadConfig: ConfigLoader,
  dependencies: GateDependencies,
): Preflight {
  // Reuse the helper loader in this Jest context; globalSetup is separate.
  (dependencies.loadEnv ?? loadTestEnv)();
  if (!(dependencies.sapConfigured ?? (() => !!process.env.SAP_URL?.trim()))())
    return { register: it.skip };

  let config: ReturnType<ConfigLoader>;
  try {
    config = loadConfig();
    if ((dependencies.templateInUse ?? isTestConfigTemplate)())
      return { register: configurationDefect };
  } catch {
    // Broken configuration must still reach the normal setup failure path.
    return { register: configurationDefect };
  }
  const environment = config?.environment;
  if (!['onprem', 'cloud'].includes(environment?.system))
    return { register: configurationDefect };
  return { config, environment };
}

/**
 * Decide applicability before Jest starts the test body.
 *
 * | Configuration | Registration |
 * | --- | --- |
 * | No SAP system configured | it.skip |
 * | Template in use (no overlay) | it (configuration defect) |
 * | Loader throws, or system is missing/invalid | it (normal failure path) |
 * | Case or handler section is absent | it (configuration defect) |
 * | Case exists with enabled !== true | it.skip |
 * | Enabled case unavailable per isTestAvailable | it.skip |
 * | Enabled, available case | it |
 *
 * Availability follows TestConfigResolver, including legacy systems and
 * unrestricted absent, non-array, or empty available_in values.
 */
export function gate(
  handlerName: string,
  testCaseName: string,
  loadConfig: ConfigLoader = loadTestConfig,
  dependencies: GateDependencies = {},
): jest.It {
  const decided = preflight(loadConfig, dependencies);
  if (decided.register) return decided.register;
  const { config, environment } = decided;

  // Match TestConfigResolver's named lookup and strict enabled semantics;
  // getTestCaseDefinition cannot be used because it filters via getEnvironmentType.
  const testCase = configuredCase(handlerName, testCaseName, () => config);
  if (!testCase) return configurationDefect;
  return testCase.enabled === true &&
    TestConfigResolver.isTestAvailable(
      testCase,
      environment.system === 'cloud',
      environment.is_legacy === true,
    )
    ? it
    : it.skip;
}

/**
 * Decide applicability of a test that names no case of its own: it applies
 * where `applies` says so for the configured system.
 *
 * | Configuration | Registration |
 * | --- | --- |
 * | No SAP configured | it.skip |
 * | Template, loader throws, or system is missing/invalid | it |
 * | `applies` answers false | it.skip |
 * | `applies` answers true, or throws | it |
 */
export function gateOn(
  applies: (system: { isCloud: boolean; isLegacy: boolean }) => boolean,
  loadConfig: ConfigLoader = loadTestConfig,
  dependencies: GateDependencies = {},
): jest.It {
  const decided = preflight(loadConfig, dependencies);
  if (decided.register) return decided.register;
  const { environment } = decided;
  try {
    return applies({
      isCloud: environment.system === 'cloud',
      isLegacy: environment.is_legacy === true,
    })
      ? it
      : it.skip;
  } catch {
    // A configuration that cannot be read must fail the test, not skip it.
    return configurationDefect;
  }
}

/**
 * Decide applicability of a read-standard-object case, which names no case of
 * its own: it applies where the configuration holds a standard object of that
 * type for the system (`standard_objects`, cloud or on-premise).
 */
export function gateStandardObject(
  objectType: string,
  loadConfig: ConfigLoader = loadTestConfig,
  dependencies: GateDependencies & {
    standardObject?: (
      objectType: string,
      isCloud: boolean,
      isLegacy: boolean,
    ) => unknown;
  } = {},
): jest.It {
  const standardObject =
    dependencies.standardObject ??
    ((type, isCloud, isLegacy) =>
      new TestConfigResolver({ isCloud, isLegacy }).getStandardObject(type));
  return gateOn(
    ({ isCloud, isLegacy }) => !!standardObject(objectType, isCloud, isLegacy),
    loadConfig,
    dependencies,
  );
}

/**
 * A test that needs every one of its gates: it.skip as soon as one skips,
 * except that a configuration defect in any gate wins over every skip, so a
 * deleted or misspelled case fails instead of removing the coverage.
 */
export function gateAll(...gates: jest.It[]): jest.It {
  if (gates.includes(configurationDefect)) return configurationDefect;
  return gates.every((registered) => registered === it) ? it : it.skip;
}

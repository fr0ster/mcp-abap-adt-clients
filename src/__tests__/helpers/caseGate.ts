import { sapIsConfigured } from './sessionConfig';
import { TestConfigResolver } from './TestConfigResolver';

const { loadTestConfig, loadTestEnv, isTestConfigTemplate } =
  require('./test-helper');

export { isTestConfigTemplate };

export const MISSING_TEST_CONFIG =
  'test-config.yaml missing — copy the template and fill it in';

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
 * Decide applicability before Jest starts the test body.
 *
 * | Configuration | Registration |
 * | --- | --- |
 * | No SAP system configured | it.skip |
 * | Template in use | it (configuration defect) |
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
  dependencies: {
    loadEnv?: () => void;
    sapConfigured?: () => boolean;
    templateInUse?: () => boolean;
  } = {},
): jest.It {
  // Reuse the helper loader in this Jest context; globalSetup is separate.
  (dependencies.loadEnv ?? loadTestEnv)();
  if (!(dependencies.sapConfigured ?? sapIsConfigured)()) return it.skip;

  let config: ReturnType<ConfigLoader>;
  try {
    config = loadConfig();
    if ((dependencies.templateInUse ?? isTestConfigTemplate)()) return it;
  } catch {
    // Broken configuration must still reach the normal setup failure path.
    return it;
  }
  const environment = config?.environment;
  if (!['onprem', 'cloud'].includes(environment?.system)) return it;

  // Match TestConfigResolver's named lookup and strict enabled semantics;
  // getTestCaseDefinition cannot be used because it filters via getEnvironmentType.
  const testCase = configuredCase(handlerName, testCaseName, () => config);
  if (!testCase) return it;
  return testCase.enabled === true &&
    TestConfigResolver.isTestAvailable(
      testCase,
      environment.system === 'cloud',
      environment.is_legacy === true,
    )
    ? it
    : it.skip;
}

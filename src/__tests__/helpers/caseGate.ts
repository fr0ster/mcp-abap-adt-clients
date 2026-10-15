import { TestConfigResolver } from './TestConfigResolver';

const { loadTestConfig } = require('./test-helper');

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
): jest.It {
  let config: ReturnType<ConfigLoader>;
  try {
    config = loadConfig();
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

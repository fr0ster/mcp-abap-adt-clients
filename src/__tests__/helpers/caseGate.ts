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

/** Decide applicability before Jest starts the test body. */
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
  return testCase?.enabled === true &&
    TestConfigResolver.isTestAvailable(
      testCase,
      environment.system === 'cloud',
      environment.is_legacy === true,
    )
    ? it
    : it.skip;
}

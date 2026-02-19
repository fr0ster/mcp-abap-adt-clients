/**
 * Integration tests for class local includes (AdtClass sub-objects):
 * - LocalDefinitions (definitions include: "data in class"/private types)
 * - LocalTypes (implementations include: local helper class)
 * - LocalTestClass (testclasses include: local ABAP Unit tests)
 * - LocalMacros (macros include: on-premise only; skipped on cloud)
 *
 * Run: npm test -- --testPathPatterns=class/LocalIncludes
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtClient } from '../../../../clients/AdtClient';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { BaseTester } from '../../../helpers/BaseTester';
import { getConfig } from '../../../helpers/sessionConfig';
import {
  createConnectionLogger,
  createLibraryLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';
import {
  logTestEnd,
  logTestSkip,
  logTestStart,
} from '../../../helpers/testProgressLogger';

const {
  getTestCaseDefinition,
  resolvePackageName,
  resolveTransportRequest,
  getTimeout,
} = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger: ILogger = createConnectionLogger();
const libraryLogger: ILogger = createLibraryLogger();
const testsLogger: ILogger = createTestsLogger();

type ParentClassConfig = {
  className: string;
  packageName: string;
  transportRequest?: string;
  description?: string;
};

describe('Class local includes (using BaseTester)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;

  function logSkip(
    testName: string,
    definitionKey: string,
    definitionName: string,
    reason: string,
  ): void {
    const definition = getTestCaseDefinition(definitionKey, definitionName);
    logTestStart(testsLogger, testName, definition);
    logTestSkip(testsLogger, testName, reason);
    logTestEnd(testsLogger, testName);
  }

  async function ensureParentClassExists(
    config: ParentClassConfig,
  ): Promise<{ success: boolean; reason?: string; created?: boolean }> {
    try {
      const existing = await client
        .getClass()
        .read({ className: config.className });
      if (existing) {
        await client.getClass().readMetadata({ className: config.className });
        return { success: true, created: false };
      }

      await client.getClass().create({
        className: config.className,
        packageName: config.packageName,
        transportRequest: config.transportRequest,
        description: config.description || `Test class ${config.className}`,
      });

      await client.getClass().activate({ className: config.className });
      return { success: true, created: true };
    } catch (error: any) {
      return {
        success: false,
        reason: `Failed to ensure parent class '${config.className}': ${error.message}`,
      };
    }
  }

  let definitionsTester: BaseTester<any, any>;
  let localTypesTester: BaseTester<any, any>;
  let localTestClassTester: BaseTester<any, any>;
  let localMacrosTester: BaseTester<any, any>;
  const parentClassCreatedMap = new Map<
    BaseTester<any, any>,
    { created: boolean; className: string | null }
  >();

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, libraryLogger);
      hasConfig = true;
      isCloudSystem = await isCloudEnvironment(connection);

      definitionsTester = new BaseTester(
        client.getLocalDefinitions() as any,
        'Class',
        'update_class_local_definitions',
        'local_definitions',
        testsLogger,
      );
      localTypesTester = new BaseTester(
        client.getLocalTypes() as any,
        'Class',
        'update_class_local_types',
        'local_types',
        testsLogger,
      );
      localTestClassTester = new BaseTester(
        client.getLocalTestClass() as any,
        'Class',
        'update_class_local_testclass',
        'local_testclass',
        testsLogger,
      );
      localMacrosTester = new BaseTester(
        client.getLocalMacros() as any,
        'Class',
        'update_class_local_macros',
        'local_macros',
        testsLogger,
      );

      const setupCommon = (
        tester: BaseTester<any, any>,
        testDescription: string,
        codeField: string,
        options?: { skipEnsureParentClass?: () => boolean },
      ) => {
        tester.setup({
          connection,
          client,
          hasConfig,
          isCloudSystem,
          testDescription,
          buildConfig: (testCase: any, resolver?: any) => {
            const params = testCase?.params || {};
            // Use resolver to get resolved parameters (from test case params or global defaults)
            const packageName =
              resolver?.getPackageName?.() ||
              resolvePackageName(params.package_name);
            if (!packageName) throw new Error('package_name not configured');
            const transportRequest =
              resolver?.getTransportRequest?.() ||
              resolveTransportRequest(params.transport_request);
            return {
              className: params.class_name,
              packageName,
              transportRequest,
              description:
                params.description || `Test class ${params.class_name}`,
              [codeField]: params[`${codeField}_create`] ?? params[codeField],
            };
          },
          ensureObjectReady: async (className: string) => {
            if (options?.skipEnsureParentClass?.()) {
              parentClassCreatedMap.set(tester, {
                created: false,
                className: null,
              });
              return { success: true };
            }
            const tc = tester.getTestCase();
            const params = tc?.params || {};
            const packageName = resolvePackageName(params.package_name);
            if (!packageName) {
              parentClassCreatedMap.set(tester, {
                created: false,
                className: null,
              });
              return { success: false, reason: 'package_name not configured' };
            }
            const result = await ensureParentClassExists({
              className,
              packageName,
              transportRequest: resolveTransportRequest(
                params.transport_request,
              ),
              description: params.description,
            });
            parentClassCreatedMap.set(tester, {
              created: result.created === true,
              className: result.created ? className : null,
            });
            return result;
          },
        });
      };

      setupCommon(
        definitionsTester,
        'LocalDefinitions - full workflow',
        'definitionsCode',
      );
      setupCommon(
        localTypesTester,
        'LocalTypes - full workflow',
        'localTypesCode',
      );
      setupCommon(
        localTestClassTester,
        'LocalTestClass - full workflow',
        'testClassCode',
      );
      setupCommon(
        localMacrosTester,
        'LocalMacros - full workflow',
        'macrosCode',
        {
          skipEnsureParentClass: () => isCloudSystem,
        },
      );
    } catch (_error) {
      hasConfig = false;
    }
  });

  afterAll(() => {
    if (definitionsTester) {
      return definitionsTester.afterAll()();
    }
    if (connection) {
      (connection as any).reset();
    }
    return Promise.resolve();
  });

  describe('LocalDefinitions', () => {
    beforeEach(() => definitionsTester?.beforeEach()());

    afterEach(async () => {
      await definitionsTester?.afterEach()();
      // Cleanup parent class if it was created in ensureObjectReady
      const parentInfo = parentClassCreatedMap.get(definitionsTester);
      if (parentInfo?.created && parentInfo.className) {
        const {
          getEnvironmentConfig,
        } = require('../../../helpers/test-helper');
        const envConfig = getEnvironmentConfig();
        const cleanupAfterTest = envConfig.cleanup_after_test !== false;
        const globalSkipCleanup = envConfig.skip_cleanup === true;
        const tc = definitionsTester?.getTestCase();
        const skipCleanup =
          tc?.params?.skip_cleanup !== undefined
            ? tc.params.skip_cleanup === true
            : globalSkipCleanup;
        const shouldCleanup = cleanupAfterTest && !skipCleanup;

        if (shouldCleanup) {
          try {
            await client.getClass().delete({
              className: parentInfo.className,
              transportRequest: resolveTransportRequest(
                tc?.params?.transport_request,
              ),
            });
          } catch (cleanupError: any) {
            testsLogger.warn?.(
              `⚠️ Failed to cleanup parent class ${parentInfo.className}: ${cleanupError.message}`,
            );
          }
        } else {
          testsLogger.info?.(
            `⚠️ Cleanup skipped (cleanup_after_test=${cleanupAfterTest}, skip_cleanup=${skipCleanup}) - parent class left for analysis: ${parentInfo.className}`,
          );
        }
      }
    });

    it(
      'should execute full workflow for definitions include',
      async () => {
        const testName = 'Class - LocalDefinitions - full workflow';
        if (!hasConfig || !definitionsTester) {
          logSkip(
            testName,
            'update_class_local_definitions',
            'local_definitions',
            'No SAP configuration',
          );
          return;
        }
        if (definitionsTester.shouldSkip()) {
          await definitionsTester.flowTestAuto();
          return;
        }

        const config = definitionsTester.getConfig();
        const tc = definitionsTester.getTestCase();
        const params = tc?.params || {};
        const updateCode =
          params.definitionsCode_update ??
          params.definitionsCode ??
          config?.definitionsCode;

        await definitionsTester.flowTestAuto({
          updateConfig: { definitionsCode: updateCode },
          readMetadata: true,
        });
      },
      getTimeout('test'),
    );
  });

  describe('LocalTypes', () => {
    beforeEach(() => localTypesTester?.beforeEach()());

    afterEach(async () => {
      await localTypesTester?.afterEach()();
      // Cleanup parent class if it was created in ensureObjectReady
      const parentInfo = parentClassCreatedMap.get(localTypesTester);
      if (parentInfo?.created && parentInfo.className) {
        const {
          getEnvironmentConfig,
        } = require('../../../helpers/test-helper');
        const envConfig = getEnvironmentConfig();
        const cleanupAfterTest = envConfig.cleanup_after_test !== false;
        const globalSkipCleanup = envConfig.skip_cleanup === true;
        const tc = localTypesTester?.getTestCase();
        const skipCleanup =
          tc?.params?.skip_cleanup !== undefined
            ? tc.params.skip_cleanup === true
            : globalSkipCleanup;
        const shouldCleanup = cleanupAfterTest && !skipCleanup;

        if (shouldCleanup) {
          try {
            await client.getClass().delete({
              className: parentInfo.className,
              transportRequest: resolveTransportRequest(
                tc?.params?.transport_request,
              ),
            });
          } catch (cleanupError: any) {
            testsLogger.warn?.(
              `⚠️ Failed to cleanup parent class ${parentInfo.className}: ${cleanupError.message}`,
            );
          }
        } else {
          testsLogger.info?.(
            `⚠️ Cleanup skipped (cleanup_after_test=${cleanupAfterTest}, skip_cleanup=${skipCleanup}) - parent class left for analysis: ${parentInfo.className}`,
          );
        }
      }
    });

    it(
      'should execute full workflow for implementations include (local helper class)',
      async () => {
        const testName = 'Class - LocalTypes - full workflow';
        if (!hasConfig || !localTypesTester) {
          logSkip(
            testName,
            'update_class_local_types',
            'local_types',
            'No SAP configuration',
          );
          return;
        }
        if (localTypesTester.shouldSkip()) {
          await localTypesTester.flowTestAuto();
          return;
        }

        const config = localTypesTester.getConfig();
        const tc = localTypesTester.getTestCase();
        const params = tc?.params || {};
        const updateCode =
          params.localTypesCode_update ??
          params.localTypesCode ??
          config?.localTypesCode;

        await localTypesTester.flowTestAuto({
          updateConfig: { localTypesCode: updateCode },
          readMetadata: true,
        });
      },
      getTimeout('test'),
    );
  });

  describe('LocalTestClass', () => {
    beforeEach(() => localTestClassTester?.beforeEach()());

    afterEach(async () => {
      await localTestClassTester?.afterEach()();
      // Cleanup parent class if it was created in ensureObjectReady
      const parentInfo = parentClassCreatedMap.get(localTestClassTester);
      if (parentInfo?.created && parentInfo.className) {
        const {
          getEnvironmentConfig,
        } = require('../../../helpers/test-helper');
        const envConfig = getEnvironmentConfig();
        const cleanupAfterTest = envConfig.cleanup_after_test !== false;
        const globalSkipCleanup = envConfig.skip_cleanup === true;
        const tc = localTestClassTester?.getTestCase();
        const skipCleanup =
          tc?.params?.skip_cleanup !== undefined
            ? tc.params.skip_cleanup === true
            : globalSkipCleanup;
        const shouldCleanup = cleanupAfterTest && !skipCleanup;

        if (shouldCleanup) {
          try {
            await client.getClass().delete({
              className: parentInfo.className,
              transportRequest: resolveTransportRequest(
                tc?.params?.transport_request,
              ),
            });
          } catch (cleanupError: any) {
            testsLogger.warn?.(
              `⚠️ Failed to cleanup parent class ${parentInfo.className}: ${cleanupError.message}`,
            );
          }
        } else {
          testsLogger.info?.(
            `⚠️ Cleanup skipped (cleanup_after_test=${cleanupAfterTest}, skip_cleanup=${skipCleanup}) - parent class left for analysis: ${parentInfo.className}`,
          );
        }
      }
    });

    it(
      'should execute full workflow for testclasses include (local ABAP Unit tests)',
      async () => {
        const testName = 'Class - LocalTestClass - full workflow';
        if (!hasConfig || !localTestClassTester) {
          logSkip(
            testName,
            'update_class_local_testclass',
            'local_testclass',
            'No SAP configuration',
          );
          return;
        }
        if (localTestClassTester.shouldSkip()) {
          await localTestClassTester.flowTestAuto();
          return;
        }

        const config = localTestClassTester.getConfig();
        const tc = localTestClassTester.getTestCase();
        const params = tc?.params || {};
        const updateCode =
          params.testClassCode_update ??
          params.testClassCode ??
          config?.testClassCode;

        await localTestClassTester.flowTestAuto({
          updateConfig: { testClassCode: updateCode },
          readMetadata: true,
        });
      },
      getTimeout('test'),
    );
  });

  describe('LocalMacros', () => {
    beforeEach(() => localMacrosTester?.beforeEach()());

    afterEach(async () => {
      await localMacrosTester?.afterEach()();
      // Cleanup parent class if it was created in ensureObjectReady
      const parentInfo = parentClassCreatedMap.get(localMacrosTester);
      if (parentInfo?.created && parentInfo.className) {
        const {
          getEnvironmentConfig,
        } = require('../../../helpers/test-helper');
        const envConfig = getEnvironmentConfig();
        const cleanupAfterTest = envConfig.cleanup_after_test !== false;
        const globalSkipCleanup = envConfig.skip_cleanup === true;
        const tc = localMacrosTester?.getTestCase();
        const skipCleanup =
          tc?.params?.skip_cleanup !== undefined
            ? tc.params.skip_cleanup === true
            : globalSkipCleanup;
        const shouldCleanup = cleanupAfterTest && !skipCleanup;

        if (shouldCleanup) {
          try {
            await client.getClass().delete({
              className: parentInfo.className,
              transportRequest: resolveTransportRequest(
                tc?.params?.transport_request,
              ),
            });
          } catch (cleanupError: any) {
            testsLogger.warn?.(
              `⚠️ Failed to cleanup parent class ${parentInfo.className}: ${cleanupError.message}`,
            );
          }
        } else {
          testsLogger.info?.(
            `⚠️ Cleanup skipped (cleanup_after_test=${cleanupAfterTest}, skip_cleanup=${skipCleanup}) - parent class left for analysis: ${parentInfo.className}`,
          );
        }
      }
    });

    it(
      'should execute full workflow for macros include (on-premise only)',
      async () => {
        if (isCloudSystem) {
          const definition = getTestCaseDefinition(
            'update_class_local_macros',
            'local_macros',
          );
          const testName = 'Class - LocalMacros - full workflow';
          logTestStart(testsLogger, testName, definition);
          logTestSkip(
            testsLogger,
            testName,
            'Macros are not supported in cloud systems (BTP ABAP Environment)',
          );
          logTestEnd(testsLogger, testName);
          return;
        }

        const testName = 'Class - LocalMacros - full workflow';
        if (!hasConfig || !localMacrosTester) {
          logSkip(
            testName,
            'update_class_local_macros',
            'local_macros',
            'No SAP configuration',
          );
          return;
        }
        if (localMacrosTester.shouldSkip()) {
          await localMacrosTester.flowTestAuto();
          return;
        }

        const config = localMacrosTester.getConfig();
        if (!config) {
          await localMacrosTester.flowTestAuto();
          return;
        }

        // Some on-premise systems may still not expose the macros include; skip if absent.
        const existing = await client
          .getLocalMacros()
          .read({ className: config.className }, 'active');
        if (!existing) {
          const definition = getTestCaseDefinition(
            'update_class_local_macros',
            'local_macros',
          );
          logTestStart(testsLogger, testName, definition);
          logTestSkip(
            testsLogger,
            testName,
            'Macros include is not available in this system',
          );
          logTestEnd(testsLogger, testName);
          return;
        }

        const tc = localMacrosTester.getTestCase();
        const params = tc?.params || {};
        const updateCode = params.macrosCode_update ?? params.macrosCode;

        await localMacrosTester.flowTestAuto({
          updateConfig: { macrosCode: updateCode },
          readMetadata: true,
        });
      },
      getTimeout('test'),
    );
  });
});

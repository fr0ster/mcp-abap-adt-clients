/**
 * Integration tests for class local includes (AdtClass sub-objects).
 *
 * These are driven through `modifyFlowTestAuto()`, not `flowTestAuto()`: an
 * include is not created and not deleted, it is read, written and activated
 * with its class. See `BaseTester.modifyFlowTest` for why the create step does
 * not exist here.
 *
 * Covers:
 * - LocalDefinitions (definitions include: "data in class"/private types)
 * - LocalTypes (implementations include: local helper class)
 * - LocalTestClass (testclasses include: local ABAP Unit tests)
 * - LocalMacros (macros include: on-premise only; skipped on cloud)
 *
 * Run: npm test -- --testPathPatterns=class/LocalIncludes
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { integrationHeadersOf } from '../../../helpers/adtHeaders';
import { BaseTester } from '../../../helpers/BaseTester';
import { gate } from '../../../helpers/caseGate';
import { expectResult } from '../../../helpers/contract';
import { presenceOf } from '../../../helpers/objectPresence';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
  resolveSystemContext,
  skipUnlessConfigured,
} from '../../../helpers/sessionConfig';
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
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;
  let isLegacy = false;

  async function ensureParentClassExists(
    config: ParentClassConfig,
  ): Promise<{ success: boolean; reason?: string; created?: boolean }> {
    try {
      // The answer decides: `if (existing)` was true for an answer object
      // either way, so this reported "the class is already there" for a class
      // that was not, and never created it.
      const existing = presenceOf(
        await client.getClass().read({ className: config.className }),
        `class ${config.className}`,
      );
      if (existing.present === 'unknown') {
        // "Could not find out" is never "absent": no create over a class
        // that may be there.
        return { success: false, reason: existing.reason };
      }
      if (existing.present === true) {
        return { success: true, created: false };
      }

      expectResult(
        await client.getClass().create(
          {
            className: config.className,
            packageName: config.packageName,
            transportRequest: config.transportRequest,
            description: config.description || `Test class ${config.className}`,
          },
          { headers: integrationHeadersOf(client.getClass(), 'create') },
        ),
        `create parent class ${config.className}`,
      );

      expectResult(
        await client
          .getClass()
          .activate(
            { className: config.className },
            { headers: integrationHeadersOf(client.getClass(), 'activate') },
          ),
        `activate parent class ${config.className}`,
      );
      return { success: true, created: true };
    } catch (error: any) {
      return {
        success: false,
        reason: `Failed to ensure parent class '${config.className}': ${error.message}`,
      };
    }
  }

  let definitionsTester: BaseTester<any>;
  let localTypesTester: BaseTester<any>;
  let localTestClassTester: BaseTester<any>;
  let localMacrosTester: BaseTester<any>;
  const parentClassCreatedMap = new Map<
    BaseTester<any>,
    { created: boolean; className: string | null }
  >();

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
      isCloudSystem = await isCloudEnvironment(connection);
      const systemContext = await resolveSystemContext(
        connection,
        isCloudSystem,
      );
      const { client: resolvedClient, isLegacy: legacy } =
        await createTestAdtClient(connection, libraryLogger, systemContext);
      client = resolvedClient;
      isLegacy = legacy;
      hasConfig = true;

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
        tester: BaseTester<any>,
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
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      hasConfig = skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(async () => {
    if (definitionsTester) {
      await definitionsTester.afterAll()();
      return;
    }
    if (connection) {
      await releaseTestConnection(connection);
    }
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
          // A parent class this test created and could not remove fails the
          // test: the next run's create meets it.
          expectResult(
            await client.getClass().delete(
              {
                className: parentInfo.className,
                transportRequest: resolveTransportRequest(
                  tc?.params?.transport_request,
                ),
              },
              { headers: integrationHeadersOf(client.getClass(), 'delete') },
            ),
            `cleanup parent class ${parentInfo.className}`,
          );
        } else {
          testsLogger.info?.(
            `⚠️ Cleanup skipped (cleanup_after_test=${cleanupAfterTest}, skip_cleanup=${skipCleanup}) - parent class left for analysis: ${parentInfo.className}`,
          );
        }
      }
    });

    gate('update_class_local_definitions', 'local_definitions')(
      'should execute full workflow for definitions include',
      async () => {
        const config = await definitionsTester.requireConfig();
        const tc = definitionsTester.getTestCase();
        const params = tc?.params || {};
        const updateCode =
          params.definitionsCode_update ??
          params.definitionsCode ??
          config?.definitionsCode;

        await definitionsTester.modifyFlowTestAuto({
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
          // A parent class this test created and could not remove fails the
          // test: the next run's create meets it.
          expectResult(
            await client.getClass().delete(
              {
                className: parentInfo.className,
                transportRequest: resolveTransportRequest(
                  tc?.params?.transport_request,
                ),
              },
              { headers: integrationHeadersOf(client.getClass(), 'delete') },
            ),
            `cleanup parent class ${parentInfo.className}`,
          );
        } else {
          testsLogger.info?.(
            `⚠️ Cleanup skipped (cleanup_after_test=${cleanupAfterTest}, skip_cleanup=${skipCleanup}) - parent class left for analysis: ${parentInfo.className}`,
          );
        }
      }
    });

    gate('update_class_local_types', 'local_types')(
      'should execute full workflow for implementations include (local helper class)',
      async () => {
        const config = await localTypesTester.requireConfig();
        const tc = localTypesTester.getTestCase();
        const params = tc?.params || {};
        const updateCode =
          params.localTypesCode_update ??
          params.localTypesCode ??
          config?.localTypesCode;

        await localTypesTester.modifyFlowTestAuto({
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
          // A parent class this test created and could not remove fails the
          // test: the next run's create meets it.
          expectResult(
            await client.getClass().delete(
              {
                className: parentInfo.className,
                transportRequest: resolveTransportRequest(
                  tc?.params?.transport_request,
                ),
              },
              { headers: integrationHeadersOf(client.getClass(), 'delete') },
            ),
            `cleanup parent class ${parentInfo.className}`,
          );
        } else {
          testsLogger.info?.(
            `⚠️ Cleanup skipped (cleanup_after_test=${cleanupAfterTest}, skip_cleanup=${skipCleanup}) - parent class left for analysis: ${parentInfo.className}`,
          );
        }
      }
    });

    gate('update_class_local_testclass', 'local_testclass')(
      'should execute full workflow for testclasses include (local ABAP Unit tests)',
      async () => {
        const config = await localTestClassTester.requireConfig();
        const tc = localTestClassTester.getTestCase();
        const params = tc?.params || {};
        const updateCode =
          params.testClassCode_update ??
          params.testClassCode ??
          config?.testClassCode;

        await localTestClassTester.modifyFlowTestAuto({
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
          // A parent class this test created and could not remove fails the
          // test: the next run's create meets it.
          expectResult(
            await client.getClass().delete(
              {
                className: parentInfo.className,
                transportRequest: resolveTransportRequest(
                  tc?.params?.transport_request,
                ),
              },
              { headers: integrationHeadersOf(client.getClass(), 'delete') },
            ),
            `cleanup parent class ${parentInfo.className}`,
          );
        } else {
          testsLogger.info?.(
            `⚠️ Cleanup skipped (cleanup_after_test=${cleanupAfterTest}, skip_cleanup=${skipCleanup}) - parent class left for analysis: ${parentInfo.className}`,
          );
        }
      }
    });

    gate('update_class_local_macros', 'local_macros')(
      'should execute full workflow for macros include (on-premise only)',
      async () => {
        // No environment branch here. `available_in` decides and
        // `skip_reason` explains, both in test-config.yaml, and
        // the registration gate is what reads them. This case
        // used to carry its own `if (isCloudSystem)` saying "Macros are not
        // supported in cloud systems" — a second source of truth, and a wrong
        // one: a cloud class has a writable macros include, ADT 3.60.3 against
        // the ABAP Cloud system answers `PUT …/includes/macros` with 200. What the ABAP for
        // Cloud language version forbids is `DEFINE`, which is what this case's
        // source contains, and that sentence now lives in the config.

        const testName = 'Class - LocalMacros - full workflow';
        const config = await localMacrosTester.requireConfig();

        // The case is on-premise only (its `available_in`), where the macros
        // include is there; a refused read fails with the reason.
        expectResult(
          await client
            .getLocalMacros()
            .read({ className: config.className }, 'active'),
          'read the macros include',
        );

        const tc = localMacrosTester.getTestCase();
        const params = tc?.params || {};
        const updateCode = params.macrosCode_update ?? params.macrosCode;

        await localMacrosTester.modifyFlowTestAuto({
          updateConfig: { macrosCode: updateCode },
          readMetadata: true,
        });
      },
      getTimeout('test'),
    );
  });
});

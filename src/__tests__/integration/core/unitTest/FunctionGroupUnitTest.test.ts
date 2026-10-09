/**
 * Integration test for a function group's ABAP Unit tests: the group and its
 * module through getFunctionGroup() and getFunctionModule(), the test include
 * through getFunctionInclude(), the runs through
 * AdtExecutor.getFunctionGroupTestRunner() and getFunctionModuleTestRunner().
 *
 * Creating the include adds its INCLUDE to the group's main program; the group
 * run finds every test of the group, the module run the tests that exercise it.
 *
 * Run: npm test -- --testPathPatterns=unitTest/FunctionGroupUnitTest
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { unitTestRunId } from '@mcp-abap-adt/adt-strategies';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import { AdtExecutor } from '../../../../clients/AdtExecutor';
import { abapUnitRunnerDocuments } from '../../../../executors/abapUnitRunner';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { runToCompletion } from '../../../helpers/abapUnitRun';
import { expectResult } from '../../../helpers/contract';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
  resolveSystemContext,
  skipUnlessConfigured,
} from '../../../helpers/sessionConfig';
import { TestConfigResolver } from '../../../helpers/TestConfigResolver';
import {
  createConnectionLogger,
  createLibraryLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';
import {
  logTestEnd,
  logTestError,
  logTestSkip,
  logTestStart,
  logTestStep,
  logTestSuccess,
} from '../../../helpers/testProgressLogger';

const {
  getTestCaseDefinition,
  getTimeout,
  resolvePackageName,
  resolveTransportRequest,
} = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger: ILogger = createConnectionLogger();
const libraryLogger: ILogger = createLibraryLogger();
const testsLogger: ILogger = createTestsLogger();

const TITLE = "FunctionGroupUnitTest - run a function group's tests";

describe('ABAP Unit on a function group (AdtClient + AdtExecutor)', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;
  let isLegacy = false;

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
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      hasConfig = skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(async () => {
    if (connection) {
      await releaseTestConnection(connection);
    }
  });

  it(
    'runs the tests of a function group, and of one of its modules',
    async () => {
      const testCase = getTestCaseDefinition(
        'run_function_group_unit_test',
        'adt_function_group_unit_test',
      );
      logTestStart(testsLogger, TITLE, {
        name: 'run_function_group_unit_test',
        params: {},
      });
      if (!hasConfig) {
        logTestSkip(testsLogger, TITLE, 'No SAP configuration');
        return;
      }
      if (
        !testCase ||
        !TestConfigResolver.isTestAvailable(testCase, isCloudSystem, isLegacy)
      ) {
        logTestSkip(
          testsLogger,
          TITLE,
          'Test case not configured or not available for this environment',
        );
        return;
      }
      const params = testCase.params;
      const packageName = resolvePackageName(params.package_name);
      const transportRequest = resolveTransportRequest(
        params.transport_request,
      );
      if (!packageName) {
        logTestSkip(testsLogger, TITLE, 'Package name not configured');
        return;
      }
      const expected: string[] = params.expected_test_methods ?? [];
      const skipCleanup = params.skip_cleanup === true;

      const functionGroupName: string = params.function_group_name;
      const functionModuleName: string = params.function_module_name;
      const group = { functionGroupName };
      const module = { functionGroupName, functionModuleName };
      const include = { functionGroupName, includeName: params.include_name };

      try {
        // Step 1: the group and the module under test
        logTestStep('create group', testsLogger);
        expectResult(
          await client.getFunctionGroup().create({
            ...group,
            packageName,
            transportRequest,
            description: 'ABAP Unit test group',
          }),
          'create group',
        );
        expectResult(
          await client.getFunctionModule().create({
            ...module,
            transportRequest,
            description: 'ABAP Unit test module',
          }),
          'create module',
        );
        const moduleHandle = String(
          expectResult(
            await client.getFunctionModule().lock(module),
            'lock module',
          ),
        );
        try {
          expectResult(
            await client.getFunctionModule().update(
              { ...module, transportRequest },
              {
                lockHandle: moduleHandle,
                source: params.function_module_source,
              },
            ),
            'write the module',
          );
        } finally {
          await client.getFunctionModule().unlock(module, moduleHandle);
        }

        // Step 2: the include holding the test class
        logTestStep('create test include', testsLogger);
        expectResult(
          await client.getFunctionInclude().create({
            ...include,
            transportRequest,
            description: 'ABAP Unit tests',
          }),
          'create include',
        );
        const includeHandle = String(
          expectResult(
            await client.getFunctionInclude().lock(include),
            'lock include',
          ),
        );
        try {
          expectResult(
            await client
              .getFunctionInclude()
              .update(
                { ...include, transportRequest },
                { lockHandle: includeHandle, source: params.include_source },
              ),
            'write the test class',
          );
        } finally {
          await client.getFunctionInclude().unlock(include, includeHandle);
        }

        logTestStep('activate', testsLogger);
        expectResult(
          await client.getFunctionModule().activate(module),
          'activate module',
        );
        expectResult(
          await client.getFunctionInclude().activate(include),
          'activate include',
        );
        expectResult(
          await client.getFunctionGroup().activate(group),
          'activate group',
        );

        const executor = new AdtExecutor(connection, libraryLogger);
        const documents = { ...abapUnitRunnerDocuments, run: unitTestRunId };

        // Step 3: every test of the group
        logTestStep('run (function group)', testsLogger);
        const groupRun = await runToCompletion(
          executor.getFunctionGroupTestRunner(documents),
          functionGroupName,
        );
        testsLogger.info?.(
          `Group run ${groupRun.runId}: ${groupRun.methods.join(', ')}`,
        );
        expect(groupRun.methods).toEqual(expect.arrayContaining(expected));
        expect(groupRun.alerts).toEqual([]);

        // Step 4: the tests that exercise the module
        logTestStep('run (function module)', testsLogger);
        const moduleRun = await runToCompletion(
          executor.getFunctionModuleTestRunner(documents),
          functionModuleName,
        );
        testsLogger.info?.(
          `Module run ${moduleRun.runId}: ${moduleRun.methods.join(', ')}`,
        );
        expect(moduleRun.methods).toEqual(expect.arrayContaining(expected));
        expect(moduleRun.alerts).toEqual([]);

        logTestSuccess(testsLogger, TITLE);
      } catch (error) {
        logTestError(testsLogger, TITLE, error);
        throw error;
      } finally {
        if (!skipCleanup) {
          logTestStep('delete (cleanup)', testsLogger);
          await client
            .getFunctionGroup()
            .delete({ ...group, transportRequest })
            .catch(() => undefined);
        }
        logTestEnd(testsLogger, TITLE);
      }
    },
    getTimeout('test'),
  );
});

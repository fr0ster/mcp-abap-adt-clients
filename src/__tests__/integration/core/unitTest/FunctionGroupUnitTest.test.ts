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
import { integrationHeadersOf } from '../../../helpers/adtHeaders';
import {
  configuredCase,
  gate,
  missingCaseMessage,
} from '../../../helpers/caseGate';
import {
  cleanupRefusal,
  expectResult,
  raiseAfterCleanup,
  releasing,
} from '../../../helpers/contract';
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
  logTestError,
  logTestStart,
  logTestStep,
  logTestSuccess,
} from '../../../helpers/testProgressLogger';

const {
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
  let isCloudSystem = false;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
      isCloudSystem = await isCloudEnvironment(connection);
      const systemContext = await resolveSystemContext(
        connection,
        isCloudSystem,
      );
      const { client: resolvedClient } = await createTestAdtClient(
        connection,
        libraryLogger,
        systemContext,
      );
      client = resolvedClient;
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(async () => {
    if (connection) {
      await releaseTestConnection(connection);
    }
  });

  gate('run_function_group_unit_test', 'adt_function_group_unit_test')(
    'runs the tests of a function group, and of one of its modules',
    async () => {
      const testCase = configuredCase(
        'run_function_group_unit_test',
        'adt_function_group_unit_test',
      );
      logTestStart(testsLogger, TITLE, {
        name: 'run_function_group_unit_test',
        params: {},
      });
      if (!testCase)
        throw new Error(
          missingCaseMessage(
            'run_function_group_unit_test',
            'adt_function_group_unit_test',
          ),
        );
      const params = testCase.params;
      const packageName = resolvePackageName(params.package_name);
      const transportRequest = resolveTransportRequest(
        params.transport_request,
      );
      if (!packageName) throw new Error('Package name not configured');
      const expected: string[] = params.expected_test_methods ?? [];
      const skipCleanup = params.skip_cleanup === true;

      const functionGroupName: string = params.function_group_name;
      const functionModuleName: string = params.function_module_name;
      const group = { functionGroupName };
      const module = { functionGroupName, functionModuleName };
      const include = { functionGroupName, includeName: params.include_name };

      let failed: { error: unknown } | undefined;
      try {
        // Step 1: the group and the module under test
        logTestStep('create group', testsLogger);
        expectResult(
          await client.getFunctionGroup().create(
            {
              ...group,
              packageName,
              transportRequest,
              description: 'ABAP Unit test group',
            },
            {
              headers: integrationHeadersOf(
                client.getFunctionGroup(),
                'create',
              ),
            },
          ),
          'create group',
        );
        expectResult(
          await client.getFunctionModule().create(
            {
              ...module,
              transportRequest,
              description: 'ABAP Unit test module',
            },
            {
              headers: integrationHeadersOf(
                client.getFunctionModule(),
                'create',
              ),
            },
          ),
          'create module',
        );
        const moduleHandle = String(
          expectResult(
            await client.getFunctionModule().lock(module),
            'lock module',
          ),
        );
        await releasing(
          async () =>
            expectResult(
              await client.getFunctionModule().update(
                { ...module, transportRequest },
                {
                  headers: integrationHeadersOf(
                    client.getFunctionModule(),
                    'update',
                  ),
                  lockHandle: moduleHandle,
                  source: params.function_module_source,
                },
              ),
              'write the module',
            ),
          () => client.getFunctionModule().unlock(module, moduleHandle),
          'unlock after write the module',
        );

        // Step 2: the include holding the test class
        logTestStep('create test include', testsLogger);
        expectResult(
          await client.getFunctionInclude().create(
            {
              ...include,
              transportRequest,
              description: 'ABAP Unit tests',
            },
            {
              headers: integrationHeadersOf(
                client.getFunctionInclude(),
                'create',
              ),
            },
          ),
          'create include',
        );
        const includeHandle = String(
          expectResult(
            await client.getFunctionInclude().lock(include),
            'lock include',
          ),
        );
        await releasing(
          async () =>
            expectResult(
              await client.getFunctionInclude().update(
                { ...include, transportRequest },
                {
                  headers: integrationHeadersOf(
                    client.getFunctionInclude(),
                    'update',
                  ),
                  lockHandle: includeHandle,
                  source: params.include_source,
                },
              ),
              'write the test class',
            ),
          () => client.getFunctionInclude().unlock(include, includeHandle),
          'unlock after write the test class',
        );

        logTestStep('activate', testsLogger);
        expectResult(
          await client.getFunctionModule().activate(module, {
            headers: integrationHeadersOf(
              client.getFunctionModule(),
              'activate',
            ),
          }),
          'activate module',
        );
        expectResult(
          await client.getFunctionInclude().activate(include, {
            headers: integrationHeadersOf(
              client.getFunctionInclude(),
              'activate',
            ),
          }),
          'activate include',
        );
        expectResult(
          await client.getFunctionGroup().activate(group, {
            headers: integrationHeadersOf(
              client.getFunctionGroup(),
              'activate',
            ),
          }),
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
        failed = { error };
        logTestError(testsLogger, TITLE, error);
      }
      // Cleanup runs whatever the body did. A refused delete fails the test;
      // when the body already failed it is added to that failure instead,
      // never replacing it. Absent — the body failed before creating it — is
      // no refusal.
      const refusals: string[] = [];
      if (!skipCleanup) {
        logTestStep('delete (cleanup)', testsLogger);
        refusals.push(
          await cleanupRefusal(
            () =>
              client.getFunctionGroup().delete(
                { ...group, transportRequest },
                {
                  headers: integrationHeadersOf(
                    client.getFunctionGroup(),
                    'delete',
                  ),
                },
              ),
            `delete function group ${group.functionGroupName}`,
          ),
        );
      }
      logTestEnd(testsLogger, TITLE);
      raiseAfterCleanup(failed, refusals);
    },
    getTimeout('test'),
  );
});

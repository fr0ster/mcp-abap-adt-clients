/**
 * Integration test for AccessControl
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_ADT_LIBS=true    - AccessControl library logs
 *  DEBUG_CONNECTORS=true   - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPatterns=accessControl/AccessControl
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtClient } from '../../../../clients/AdtClient';
import type {
  IAccessControlConfig,
  IAccessControlState,
} from '../../../../core/accessControl';
import { getAccessControl } from '../../../../core/accessControl/read';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { BaseTester } from '../../../helpers/BaseTester';
import {
  getConfig,
  resolveSystemContext,
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
  logTestSuccess,
} from '../../../helpers/testProgressLogger';

const {
  getEnabledTestCase,
  resolvePackageName,
  resolveTransportRequest,
  getTimeout,
} = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code uses DEBUG_ADT_LIBS
const libraryLogger: ILogger = createLibraryLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('AccessControl (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;
  let tester: BaseTester<IAccessControlConfig, IAccessControlState>;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      isCloudSystem = await isCloudEnvironment(connection);
      const systemContext = await resolveSystemContext(
        connection,
        isCloudSystem,
      );
      client = new AdtClient(connection, libraryLogger, systemContext);
      hasConfig = true;

      tester = new BaseTester(
        client.getAccessControl(),
        'AccessControl',
        'create_access_control',
        'adt_access_control',
        testsLogger,
      );

      tester.setup({
        connection,
        client,
        hasConfig,
        isCloudSystem,
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
            accessControlName: params.access_control_name,
            packageName,
            transportRequest,
            description: params.description,
            sourceCode: params.source_code,
          };
        },
        ensureObjectReady: async (accessControlName: string) => {
          if (!connection) return { success: true };
          try {
            await getAccessControl(connection, accessControlName);
            return {
              success: false,
              reason: `SAFETY: Access Control ${accessControlName} already exists!`,
            };
          } catch (error: any) {
            if (error.response?.status !== 404) {
              return {
                success: false,
                reason: `Cannot verify access control existence: ${error.message}`,
              };
            }
          }
          return { success: true };
        },
      });
    } catch (_error) {
      hasConfig = false;
    }
  });

  afterAll(() => tester?.afterAll()());

  describe('Full workflow', () => {
    beforeEach(() => tester?.beforeEach()());
    afterEach(() => tester?.afterEach()());

    it(
      'should execute full workflow and store all results',
      async () => {
        if (!tester) {
          return;
        }
        if (!hasConfig) {
          await tester.flowTestAuto();
          return;
        }
        const config = tester.getConfig();
        if (!config) {
          await tester.flowTestAuto();
          return;
        }

        const testCase = tester.getTestCaseDefinition();
        const sourceCode =
          testCase?.params?.source_code ||
          config.sourceCode ||
          `@EndUserText.label: '${config.description || config.accessControlName}'\n@MappingRole: true\ndefine role ${config.accessControlName} {\n  grant select on ${config.accessControlName}\n  where ( ) = aspect pfcg_auth( , , );\n}`;

        await tester.flowTestAuto({
          sourceCode: sourceCode,
          updateConfig: {
            accessControlName: config.accessControlName,
            packageName: config.packageName,
            description: config.description || '',
            sourceCode: sourceCode,
          },
        });
      },
      getTimeout('test'),
    );
  });

  describe('Read standard object', () => {
    it(
      'should read standard SAP access control',
      async () => {
        const {
          getTestCaseDefinition,
        } = require('../../../helpers/test-helper');
        const testCase = getTestCaseDefinition(
          'read_access_control',
          'read_standard_access_control',
        );

        if (!testCase) {
          logTestStart(testsLogger, 'AccessControl - read standard object', {
            name: 'read_standard',
            params: {},
          });
          logTestSkip(
            testsLogger,
            'AccessControl - read standard object',
            'Test case not defined in test-config.yaml',
          );
          return;
        }

        const enabledTestCase = getEnabledTestCase(
          'read_access_control',
          'read_standard_access_control',
        );
        if (!enabledTestCase) {
          logTestStart(testsLogger, 'AccessControl - read standard object', {
            name: 'read_standard',
            params: {},
          });
          logTestSkip(
            testsLogger,
            'AccessControl - read standard object',
            'Test case disabled or not found',
          );
          return;
        }

        // Get access control name from test case params
        let accessControlName =
          enabledTestCase.params?.access_control_name_cloud && isCloudSystem
            ? enabledTestCase.params.access_control_name_cloud
            : enabledTestCase.params?.access_control_name_onprem &&
                !isCloudSystem
              ? enabledTestCase.params.access_control_name_onprem
              : enabledTestCase.params?.access_control_name;

        if (!accessControlName) {
          // Fallback to standard_objects registry using TestConfigResolver
          const resolver = new TestConfigResolver({
            isCloud: isCloudSystem,
            logger: testsLogger,
          });
          const standardObject = resolver.getStandardObject('accessControl');
          if (!standardObject) {
            logTestStart(testsLogger, 'AccessControl - read standard object', {
              name: 'read_standard',
              params: {},
            });
            logTestSkip(
              testsLogger,
              'AccessControl - read standard object',
              `Standard access control not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`,
            );
            return;
          }
          accessControlName = standardObject.name;
        }

        logTestStart(testsLogger, 'AccessControl - read standard object', {
          name: 'read_standard',
          params: { access_control_name: accessControlName },
        });

        if (!hasConfig) {
          logTestSkip(
            testsLogger,
            'AccessControl - read standard object',
            'No SAP configuration',
          );
          return;
        }

        try {
          const resultState = await tester.readTest({
            accessControlName: accessControlName,
          });
          if (!resultState) {
            logTestSkip(
              testsLogger,
              'AccessControl - read standard object',
              `Standard access control ${accessControlName} not found in system`,
            );
            return;
          }
          expect(resultState.readResult).toBeDefined();

          logTestSuccess(testsLogger, 'AccessControl - read standard object');
        } catch (error: any) {
          logTestError(
            testsLogger,
            'AccessControl - read standard object',
            error,
          );
          throw error;
        } finally {
          logTestEnd(testsLogger, 'AccessControl - read standard object');
        }
      },
      getTimeout('test'),
    );
  });
});

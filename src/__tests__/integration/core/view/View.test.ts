/**
 * Integration test for View
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - View library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPatterns=view/View
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtClient } from '../../../../clients/AdtClient';
import type { IViewConfig, IViewState } from '../../../../core/view';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { BaseTester } from '../../../helpers/BaseTester';
import {
  getConfig,
  resolveSystemContext,
} from '../../../helpers/sessionConfig';
import {
  createConnectionLogger,
  createLibraryLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';

const {
  resolvePackageName,
  resolveTransportRequest,
  checkDefaultTestEnvironment,
  logDefaultTestEnvironment,
  createDependencyTable,
  getTimeout,
  getEnvironmentConfig,
} = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code (View) uses DEBUG_ADT_LIBS
const libraryLogger: ILogger = createLibraryLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('View (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let defaultPackage: string = '';
  let defaultTransport: string = '';
  let systemContext: Awaited<ReturnType<typeof resolveSystemContext>>;
  let tester: BaseTester<IViewConfig, IViewState>;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      const isCloudSystem = await isCloudEnvironment(connection);
      systemContext = await resolveSystemContext(connection, isCloudSystem);
      client = new AdtClient(connection, libraryLogger, systemContext);
      hasConfig = true;

      const envCheck = await checkDefaultTestEnvironment(connection);
      if (!envCheck.success) {
        const reason = envCheck.reason || 'Unknown reason';
        testsLogger.error?.(
          `Environment check failed: ${reason}. All tests will be skipped.`,
        );
        hasConfig = false;
        return;
      }

      defaultPackage = envCheck.defaultPackage || '';
      defaultTransport = envCheck.defaultTransport || '';
      logDefaultTestEnvironment(testsLogger, defaultPackage, defaultTransport);

      tester = new BaseTester(
        client.getView(),
        'View',
        'create_view',
        'adt_view',
        testsLogger,
      );

      tester.setup({
        connection,
        client,
        hasConfig,
        isCloudSystem: false,
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
            viewName: params.view_name,
            packageName,
            transportRequest,
            description: params.description,
            ddlSource: params.ddl_source,
          };
        },
        ensureObjectReady: async () => ({ success: true }),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorDetails =
        error instanceof Error && error.stack ? error.stack : errorMessage;

      // Log error with full details using the provided logger
      testsLogger.error?.('Failed to setup test environment:', {
        message: errorMessage,
        details: errorDetails,
        error: error,
      });

      // Check for specific error types
      if (
        errorMessage.includes('JWT token has expired') ||
        errorMessage.includes('token has expired')
      ) {
        testsLogger.error?.(
          'JWT token has expired. Please re-authenticate and update your .env file with fresh tokens.',
        );
      } else if (
        errorMessage.includes('authentication') ||
        errorMessage.includes('unauthorized')
      ) {
        testsLogger.error?.(
          'Authentication failed. Please check your credentials in .env file.',
        );
      } else if (
        errorMessage.includes('connection') ||
        errorMessage.includes('ECONNREFUSED')
      ) {
        testsLogger.error?.(
          'Connection failed. Please check your SAP system URL and network connectivity.',
        );
      }

      hasConfig = false;
    }
  });

  afterAll(() => tester?.afterAll()());

  describe('Full workflow', () => {
    let tableCreated = false;
    let tableName: string | null = null;

    beforeEach(async () => {
      if (!hasConfig || !tester) {
        if (!hasConfig) {
          testsLogger.warn?.(
            'Skipping test setup: hasConfig=false (check beforeAll errors above)',
          );
        }
        if (!tester) {
          testsLogger.warn?.(
            'Skipping test setup: tester is undefined (check beforeAll errors above)',
          );
        }
        return;
      }
      // Create table before test if needed (after tester.beforeEach() has loaded testCase)
      const testCase = tester.getTestCaseDefinition();
      // Call tester.beforeEach() first to load test case and config
      await tester.beforeEach()();
      if (testCase?.params?.table_name && testCase?.params?.table_source) {
        const packageName = resolvePackageName(testCase.params.package_name);
        if (packageName) {
          tableName = testCase.params.table_name;
          const tableConfig = {
            tableName: tableName,
            packageName: packageName,
            description: `Test table for ${testCase.params.view_name}`,
            ddlCode: testCase.params.table_source,
            transportRequest: resolveTransportRequest(
              testCase.params.transport_request,
            ),
          };

          // Use AdtClient for dependency table creation
          const tempAdtClient = new AdtClient(
            connection,
            libraryLogger,
            systemContext,
          );
          const tableResult = await createDependencyTable(
            tempAdtClient,
            tableConfig,
            testCase,
          );
          tableCreated = tableResult.created || false;
        }
      }
    });

    afterEach(async () => {
      if (!hasConfig || !tester) {
        return;
      }
      await tester.afterEach()();
      // Cleanup table if it was created in beforeEach
      const envConfig = getEnvironmentConfig();
      const cleanupAfterTest = envConfig.cleanup_after_test !== false;
      const globalSkipCleanup = envConfig.skip_cleanup === true;
      const skipCleanup =
        tester.getTestCaseDefinition()?.params?.skip_cleanup !== undefined
          ? tester.getTestCaseDefinition()?.params?.skip_cleanup === true
          : globalSkipCleanup;
      const shouldCleanup = cleanupAfterTest && !skipCleanup;

      if (shouldCleanup && tableCreated && tableName && connection) {
        try {
          await client.getTable().delete({
            tableName: tableName,
            transportRequest: resolveTransportRequest(
              tester.getTestCaseDefinition()?.params?.transport_request,
            ),
          });
        } catch (error) {
          testsLogger.warn?.(`Failed to cleanup table ${tableName}:`, error);
        }
      }
    });

    it(
      'should execute full workflow and store all results',
      async () => {
        if (!tester) {
          testsLogger.warn?.(
            'Skipping test: hasConfig=false or tester is undefined (check beforeAll errors above)',
          );
          return;
        }
        if (!hasConfig) {
          await tester.flowTestAuto();
          testsLogger.warn?.(
            'Skipping test: hasConfig=false or tester is undefined (check beforeAll errors above)',
          );
          return;
        }

        const config = tester.getConfig();
        if (!config) {
          await tester.flowTestAuto();
          const skipReason = tester.getSkipReason() || 'Config is null';
          testsLogger.warn?.(`Skipping test: ${skipReason}`);
          return;
        }

        const testCase = tester.getTestCaseDefinition();
        if (!testCase) {
          await tester.flowTestAuto();
          testsLogger.warn?.(
            'Skipping test: Test case not found in test-config.yaml',
          );
          return;
        }

        const ddlSource =
          testCase?.params?.ddl_source || config.ddlSource || '';
        const updatedDdlSource =
          testCase?.params?.updated_ddl_source || ddlSource;

        await tester.flowTestAuto({
          sourceCode: updatedDdlSource,
          updateConfig: {
            viewName: config.viewName,
            packageName: config.packageName,
            description: config.description || '',
            ddlSource: updatedDdlSource,
          },
        });
      },
      getTimeout('test'),
    );
  });
});

/**
 * Integration test for View
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - View library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=view/View
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { AdtClient } from '../../../clients/AdtClient';
import { getView } from '../../../core/view/read';
import { getTable } from '../../../core/table/read';
import { getClass } from '../../../core/class/read';
import { getConfig } from '../../helpers/sessionConfig';
import {
  logBuilderTestStart,
  logBuilderTestSkip,
  logBuilderTestSuccess,
  logBuilderTestError,
  logBuilderTestEnd
} from '../../helpers/builderTestLogger';
import { createConnectionLogger, createBuilderLogger, createTestsLogger } from '../../helpers/testLogger';
import { BaseTester } from '../../helpers/BaseTester';
import { IViewConfig, IViewState } from '../../../core/view';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const {
  getTestCaseDefinition,
  resolvePackageName,
  resolveTransportRequest,
  checkDefaultTestEnvironment,
  logDefaultTestEnvironment,
  createDependencyTable,
  getTimeout,
  getEnvironmentConfig
} = require('../../helpers/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code (View) uses DEBUG_ADT_LIBS
const builderLogger: ILogger = createBuilderLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('View (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let defaultPackage: string = '';
  let defaultTransport: string = '';
  let tester: BaseTester<IViewConfig, IViewState>;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, builderLogger);
      hasConfig = true;

      const envCheck = await checkDefaultTestEnvironment(connection);
      if (!envCheck.success) {
        testsLogger.error?.(`${envCheck.reason}. All tests will be skipped.`);
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
        testsLogger
      );

      tester.setup({
        connection,
        client,
        hasConfig,
        isCloudSystem: false,
        buildConfig: (testCase: any) => {
          const params = testCase?.params || {};
          const packageName = resolvePackageName(params.package_name);
          if (!packageName) throw new Error('package_name not configured');
          return {
            viewName: params.view_name,
            packageName,
            transportRequest: resolveTransportRequest(params.transport_request),
            description: params.description,
            ddlSource: params.ddl_source
          };
        },
        ensureObjectReady: async () => ({ success: true })
      });
    } catch (error) {
      hasConfig = false;
    }
  });

  afterAll(() => tester?.afterAll()());

  describe('Full workflow', () => {
    let tableCreated = false;
    let tableName: string | null = null;

    beforeEach(async () => {
      // Create table before test if needed
      const testCase = tester.getTestCaseDefinition();
      if (testCase?.params?.table_name && testCase?.params?.table_source) {
        const packageName = resolvePackageName(testCase.params.package_name);
        if (packageName) {
          tableName = testCase.params.table_name;
          const tableConfig = {
            tableName: tableName,
            packageName: packageName,
            description: `Test table for ${testCase.params.view_name}`,
            ddlCode: testCase.params.table_source,
            transportRequest: resolveTransportRequest(testCase.params.transport_request)
          };

          const tempCrudClient = new (require('../../../clients/CrudClient').CrudClient)(connection);
          const tableResult = await createDependencyTable(tempCrudClient, tableConfig, testCase);
          tableCreated = tableResult.created || false;
        }
      }
      tester?.beforeEach()();
    });

    afterEach(async () => {
      tester?.afterEach()();
      // Cleanup table if it was created in beforeEach
      const envConfig = getEnvironmentConfig();
      const cleanupAfterTest = envConfig.cleanup_after_test !== false;
      const globalSkipCleanup = envConfig.skip_cleanup === true;
      const skipCleanup = tester.getTestCaseDefinition()?.params?.skip_cleanup !== undefined
        ? tester.getTestCaseDefinition()?.params?.skip_cleanup === true
        : globalSkipCleanup;
      const shouldCleanup = cleanupAfterTest && !skipCleanup;
      
      if (shouldCleanup && tableCreated && tableName && connection) {
        try {
          await client.getTable().delete({
            tableName: tableName,
            transportRequest: resolveTransportRequest(tester.getTestCaseDefinition()?.params?.transport_request)
          });
        } catch (error) {
          testsLogger.warn?.(`Failed to cleanup table ${tableName}:`, error);
        }
      }
    });

    it('should execute full workflow and store all results', async () => {
      if (!hasConfig || !tester) {
        return;
      }
      const config = tester.getConfig();
      if (!config) {
        return;
      }

      const testCase = tester.getTestCaseDefinition();
      const ddlSource = testCase?.params?.ddl_source || config.ddlSource || '';
      const updatedDdlSource = testCase?.params?.updated_ddl_source || ddlSource;

      await tester.flowTestAuto({
        sourceCode: updatedDdlSource,
        updateConfig: {
          viewName: config.viewName,
          packageName: config.packageName,
          description: config.description || '',
          ddlSource: updatedDdlSource
        }
      });
    }, getTimeout('test'));
  });


});

/**
 * Integration test for TableBuilder
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - TableBuilder library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=table/TableBuilder
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { AdtClient } from '../../../../clients/AdtClient';
import { getTable } from '../../../../core/table/read';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { getConfig } from '../../../helpers/sessionConfig';
import {
  logBuilderTestStart,
  logBuilderTestSkip,
  logBuilderTestSuccess,
  logBuilderTestError,
  logBuilderTestEnd
} from '../../../helpers/builderTestLogger';
import { createConnectionLogger, createBuilderLogger, createTestsLogger } from '../../../helpers/testLogger';
import { BaseTester } from '../../../helpers/BaseTester';
import { ITableConfig, ITableState } from '../../../../core/table';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const {
  getTestCaseDefinition,
  resolvePackageName,
  resolveTransportRequest,
  resolveStandardObject,
  getTimeout
} = require('../../../helpers/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}


// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code uses DEBUG_ADT_LIBS
const builderLogger: ILogger = createBuilderLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('TableBuilder (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;
  let tester: BaseTester<ITableConfig, ITableState>;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, builderLogger);
      hasConfig = true;
      isCloudSystem = await isCloudEnvironment(connection);

      tester = new BaseTester(
        client.getTable(),
        'Table',
        'create_table',
        'adt_table',
        testsLogger
      );

      tester.setup({
        connection,
        client,
        hasConfig,
        isCloudSystem,
        buildConfig: (testCase: any) => {
          const params = testCase?.params || {};
          const packageName = resolvePackageName(params.package_name);
          if (!packageName) throw new Error('package_name not configured');
          return {
            tableName: params.table_name,
            packageName,
            transportRequest: resolveTransportRequest(params.transport_request),
            description: params.description,
            ddlCode: params.ddl_code
          };
        },
        ensureObjectReady: async (tableName: string) => {
          if (!connection) return { success: true };
          try {
            await getTable(connection, tableName);
            return { success: false, reason: `⚠️ SAFETY: Table ${tableName} already exists!` };
          } catch (error: any) {
            if (error.response?.status !== 404) {
              return { success: false, reason: `Cannot verify table existence: ${error.message}` };
            }
          }
          return { success: true };
        }
      });
    } catch (error) {
      hasConfig = false;
    }
  });

  afterAll(() => tester?.afterAll()());

  describe('Full workflow', () => {
    beforeEach(() => tester?.beforeEach()());
    afterEach(() => tester?.afterEach()());

    it('should execute full workflow and store all results', async () => {
      if (!hasConfig || !tester) {
        return;
      }
      const config = tester.getConfig();
      if (!config) {
        return;
      }

      const testCase = tester.getTestCaseDefinition();
      const updatedDdlCode = testCase?.params?.updated_ddl_code || config.ddlCode || '';

      await tester.flowTestAuto({
        sourceCode: updatedDdlCode,
        updateConfig: {
          tableName: config.tableName,
          packageName: config.packageName,
          description: config.description || '',
          ddlCode: updatedDdlCode
        }
      });
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP table', async () => {
      const testCase = getTestCaseDefinition('create_table', 'adt_table');
      const standardObject = resolveStandardObject('table', isCloudSystem, testCase);

      if (!standardObject) {
        logBuilderTestStart(testsLogger, 'Table - read standard object', {
          name: 'read_standard',
          params: {}
        });
        logBuilderTestSkip(testsLogger, 'Table - read standard object',
          `Standard table not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`);
        return;
      }

      const standardTableName = standardObject.name;
      logBuilderTestStart(testsLogger, 'Table - read standard object', {
        name: 'read_standard',
        params: { table_name: standardTableName }
      });

      if (!hasConfig) {
        logBuilderTestSkip(testsLogger, 'Table - read standard object', 'No SAP configuration');
        return;
      }

      try {
        const resultState = await tester.readTest({ tableName: standardTableName });
        expect(resultState?.readResult).toBeDefined();
        const tableConfig = resultState?.readResult;
        if (tableConfig && typeof tableConfig === 'object' && 'tableName' in tableConfig) {
          expect((tableConfig as any).tableName).toBe(standardTableName);
        }

        logBuilderTestSuccess(testsLogger, 'Table - read standard object');
      } catch (error) {
        logBuilderTestError(testsLogger, 'Table - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'Table - read standard object');
      }
    }, getTimeout('test'));
  });
});

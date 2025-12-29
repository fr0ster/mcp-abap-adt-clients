/**
 * Integration test for TableType (DDIC Table Type)
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - TableType library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=tabletype/TableType
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtClient } from '../../../../clients/AdtClient';
import type {
  ITableTypeConfig,
  ITableTypeState,
} from '../../../../core/tabletype';
import { getTableType } from '../../../../core/tabletype/read';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { BaseTester } from '../../../helpers/BaseTester';
import {
  logTestEnd,
  logTestError,
  logTestSkip,
  logTestStart,
  logTestSuccess,
} from '../../../helpers/testProgressLogger';
import { getConfig } from '../../../helpers/sessionConfig';
import { TestConfigResolver } from '../../../helpers/TestConfigResolver';
import {
  createLibraryLogger,
  createConnectionLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';

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

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code uses DEBUG_ADT_LIBS
const libraryLogger: ILogger = createLibraryLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('TableType (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;
  let tester: BaseTester<ITableTypeConfig, ITableTypeState>;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, libraryLogger);
      hasConfig = true;
      isCloudSystem = await isCloudEnvironment(connection);

      tester = new BaseTester(
        client.getTableType(),
        'TableType',
        'create_tabletype',
        'adt_tabletype',
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
            tableTypeName: params.tabletype_name,
            packageName,
            transportRequest,
            description: params.description,
            // TableType is XML-based (like Domain/DataElement), uses structure as rowType
            rowTypeName: params.row_type_name,
            rowTypeKind: params.row_type_kind || 'dictionaryType',
            accessType: params.access_type || 'standard',
            primaryKeyDefinition: params.primary_key_definition || 'standard',
            primaryKeyKind: params.primary_key_kind || 'nonUnique',
          };
        },
        ensureObjectReady: async (tableTypeName: string) => {
          if (!connection) return { success: true };
          try {
            await getTableType(connection, tableTypeName);
            return {
              success: false,
              reason: `SAFETY: TableType ${tableTypeName} already exists!`,
            };
          } catch (error: any) {
            if (error.response?.status !== 404) {
              return {
                success: false,
                reason: `Cannot verify tabletype existence: ${error.message}`,
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

        const _testCase = tester.getTestCaseDefinition();
        const config = tester.getConfig();

        // TableType is XML-based, no sourceCode needed
        // Update config contains XML parameters (rowTypeName, etc.)
        await tester.flowTestAuto({
          updateConfig: config
            ? {
                tableTypeName: config.tableTypeName,
                packageName: config.packageName,
                description: config.description || '',
                rowTypeName: config.rowTypeName,
                rowTypeKind: config.rowTypeKind,
                accessType: config.accessType,
                primaryKeyDefinition: config.primaryKeyDefinition,
                primaryKeyKind: config.primaryKeyKind,
              }
            : undefined,
        });
      },
      getTimeout('test'),
    );
  });

  describe('Read standard object', () => {
    it(
      'should read standard SAP table type',
      async () => {
        // Use TestConfigResolver for consistent parameter resolution
        const resolver = new TestConfigResolver({
          isCloud: isCloudSystem,
          logger: testsLogger,
        });
        const standardObject = resolver.getStandardObject('tabletype');

        if (!standardObject) {
          logTestStart(testsLogger, 'TableType - read standard object', {
            name: 'read_standard',
            params: {},
          });
          logTestSkip(
            testsLogger,
            'TableType - read standard object',
            `Standard table type not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`,
          );
          return;
        }

        const standardTableTypeName = standardObject.name;
        logTestStart(testsLogger, 'TableType - read standard object', {
          name: 'read_standard',
          params: { tabletype_name: standardTableTypeName },
        });

        if (!hasConfig) {
          logTestSkip(
            testsLogger,
            'TableType - read standard object',
            'No SAP configuration',
          );
          return;
        }

        try {
          const resultState = await tester.readTest({
            tableTypeName: standardTableTypeName,
          });
          expect(resultState?.readResult).toBeDefined();
          const tableTypeConfig = resultState?.readResult;
          if (
            tableTypeConfig &&
            typeof tableTypeConfig === 'object' &&
            'tableTypeName' in tableTypeConfig
          ) {
            expect((tableTypeConfig as any).tableTypeName).toBe(
              standardTableTypeName,
            );
          }

          logTestSuccess(
            testsLogger,
            'TableType - read standard object',
          );
        } catch (error) {
          logTestError(
            testsLogger,
            'TableType - read standard object',
            error,
          );
          throw error;
        } finally {
          logTestEnd(testsLogger, 'TableType - read standard object');
        }
      },
      getTimeout('test'),
    );
  });
});

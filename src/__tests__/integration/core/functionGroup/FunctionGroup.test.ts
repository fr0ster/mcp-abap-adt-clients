/**
 * Integration test for FunctionGroupBuilder
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - FunctionGroupBuilder library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=functionGroup/FunctionGroupBuilder
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtClient } from '../../../../clients/AdtClient';
import type {
  IFunctionGroupConfig,
  IFunctionGroupState,
} from '../../../../core/functionGroup';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { BaseTester } from '../../../helpers/BaseTester';
import {
  logBuilderTestEnd,
  logBuilderTestError,
  logBuilderTestSkip,
  logBuilderTestStart,
  logBuilderTestSuccess,
} from '../../../helpers/builderTestLogger';
import { getConfig } from '../../../helpers/sessionConfig';
import { TestConfigResolver } from '../../../helpers/TestConfigResolver';
import {
  createBuilderLogger,
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
const builderLogger: ILogger = createBuilderLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('FunctionGroupBuilder (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;
  let tester: BaseTester<IFunctionGroupConfig, IFunctionGroupState>;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, builderLogger);
      hasConfig = true;
      isCloudSystem = await isCloudEnvironment(connection);

      tester = new BaseTester(
        client.getFunctionGroup(),
        'FunctionGroup',
        'create_function_group',
        'adt_function_group',
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
            functionGroupName: params.function_group_name,
            packageName,
            transportRequest,
            description: params.description,
          };
        },
        ensureObjectReady: async () => ({ success: true }),
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

        await tester.flowTestAuto({
          updateConfig: {
            functionGroupName: config.functionGroupName,
            packageName: config.packageName,
            description: config.description || '',
            transportRequest: config.transportRequest,
          },
        });
      },
      getTimeout('test'),
    );
  });

  describe('Read standard object', () => {
    it(
      'should read standard SAP function group',
      async () => {
        // Use TestConfigResolver for consistent parameter resolution
        const resolver = new TestConfigResolver({
          isCloud: isCloudSystem,
          logger: testsLogger,
        });
        const standardObject = resolver.getStandardObject('function_group');

        if (!standardObject) {
          logBuilderTestStart(
            testsLogger,
            'FunctionGroupBuilder - read standard object',
            {
              name: 'read_standard',
              params: {},
            },
          );
          logBuilderTestSkip(
            builderLogger,
            'FunctionGroupBuilder - read standard object',
            `Standard function group not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`,
          );
          return;
        }

        const standardFunctionGroupName = standardObject.name;
        logBuilderTestStart(
          testsLogger,
          'FunctionGroupBuilder - read standard object',
          {
            name: 'read_standard',
            params: { function_group_name: standardFunctionGroupName },
          },
        );

        if (!hasConfig) {
          logBuilderTestSkip(
            testsLogger,
            'FunctionGroupBuilder - read standard object',
            'No SAP configuration',
          );
          return;
        }

        try {
          const resultState = await tester.readTest({
            functionGroupName: standardFunctionGroupName,
          });
          expect(resultState).toBeDefined();
          expect(resultState?.readResult).toBeDefined();
          // FunctionGroup read returns function group config - check if functionGroupName is present
          const functionGroupConfig = resultState?.readResult;
          if (
            functionGroupConfig &&
            typeof functionGroupConfig === 'object' &&
            'functionGroupName' in functionGroupConfig
          ) {
            expect((functionGroupConfig as any).functionGroupName).toBe(
              standardFunctionGroupName,
            );
          }

          logBuilderTestSuccess(
            testsLogger,
            'FunctionGroupBuilder - read standard object',
          );
        } catch (error) {
          logBuilderTestError(
            testsLogger,
            'FunctionGroupBuilder - read standard object',
            error,
          );
          throw error;
        } finally {
          logBuilderTestEnd(
            testsLogger,
            'FunctionGroupBuilder - read standard object',
          );
        }
      },
      getTimeout('test'),
    );
  });
});

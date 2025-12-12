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

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { AdtClient } from '../../../clients/AdtClient';
import { isCloudEnvironment } from '../../../utils/systemInfo';
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
import { IFunctionGroupConfig, IFunctionGroupState } from '../../../core/functionGroup';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const {
  getTestCaseDefinition,
  resolvePackageName,
  resolveTransportRequest,
  resolveStandardObject,
  getTimeout
} = require('../../helpers/test-helper');

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
            functionGroupName: params.function_group_name,
            packageName,
            transportRequest: resolveTransportRequest(params.transport_request),
            description: params.description
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
    beforeEach(() => tester?.beforeEach()());
    afterEach(() => tester?.afterEach()());

    it('should execute full workflow and store all results', async () => {
      const config = tester.getConfig();
      if (!config) return;

      await tester.flowTestAuto({
        updateConfig: {
          functionGroupName: config.functionGroupName,
          packageName: config.packageName,
          description: config.description || '',
          transportRequest: config.transportRequest
        }
      });
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP function group', async () => {
      const testCase = getTestCaseDefinition('create_function_group', 'adt_function_group');
      const standardObject = resolveStandardObject('function_group', isCloudSystem, testCase);

      if (!standardObject) {
        logBuilderTestStart(testsLogger, 'FunctionGroupBuilder - read standard object', {
          name: 'read_standard',
          params: {}
        });
        logBuilderTestSkip(
          builderLogger,
          'FunctionGroupBuilder - read standard object',
          `Standard function group not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`
        );
        return;
      }

      const standardFunctionGroupName = standardObject.name;
      logBuilderTestStart(testsLogger, 'FunctionGroupBuilder - read standard object', {
        name: 'read_standard',
        params: { function_group_name: standardFunctionGroupName }
      });

      if (!hasConfig) {
        logBuilderTestSkip(testsLogger, 'FunctionGroupBuilder - read standard object', 'No SAP configuration');
        return;
      }

      try {
        const resultState = await client.getFunctionGroup().read({ functionGroupName: standardFunctionGroupName });
        expect(resultState).toBeDefined();
        expect(resultState?.readResult).toBeDefined();
        // FunctionGroup read returns function group config - check if functionGroupName is present
        const functionGroupConfig = resultState?.readResult;
        if (functionGroupConfig && typeof functionGroupConfig === 'object' && 'functionGroupName' in functionGroupConfig) {
          expect((functionGroupConfig as any).functionGroupName).toBe(standardFunctionGroupName);
        }

        logBuilderTestSuccess(testsLogger, 'FunctionGroupBuilder - read standard object');
      } catch (error) {
        logBuilderTestError(testsLogger, 'FunctionGroupBuilder - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'FunctionGroupBuilder - read standard object');
      }
    }, getTimeout('test'));
  });
});

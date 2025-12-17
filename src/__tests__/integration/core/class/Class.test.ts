/**
 * Integration test for ClassBuilder
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - ClassBuilder library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=class/ClassBuilder
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { AdtClient } from '../../../../clients/AdtClient';
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
import { IClassConfig, IClassState } from '../../../../core/class';
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

// Library code (ClassBuilder) uses DEBUG_ADT_LIBS
const builderLogger: ILogger = createBuilderLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('ClassBuilder (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;
  let tester: BaseTester<IClassConfig, IClassState>;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, builderLogger);
      hasConfig = true;
      isCloudSystem = await isCloudEnvironment(connection);

      tester = new BaseTester(
        client.getClass(),
        'Class',
        'create_class',
        'adt_class',
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
            className: params.class_name,
            packageName,
            transportRequest: resolveTransportRequest(params.transport_request),
            description: params.description || `Test class ${params.class_name}`,
            sourceCode: params.source_code
          };
        },
        ensureObjectReady: async (className: string) => {
          if (!connection) return { success: true };
          try {
            const cleanupClient = new AdtClient(connection, builderLogger);
            const existingClass = await cleanupClient.getClass().read({ className });
            if (existingClass) {
              try {
                await cleanupClient.getClass().delete({
                  className,
                  transportRequest: resolveTransportRequest(undefined)
                });
                await new Promise(resolve => setTimeout(resolve, 3000));
              } catch (cleanupError: any) {
                return { success: false, reason: `Failed to delete existing class ${className}: ${cleanupError.message}` };
              }
            }
          } catch (error: any) {
            if (error.response?.status !== 404) {
              return { success: false, reason: `Cannot verify class existence: ${error.message}` };
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
      const sourceCode = testCase?.params?.source_code || config.sourceCode || 
        `CLASS ${config.className} DEFINITION PUBLIC FINAL CREATE PUBLIC. ENDCLASS.`;

      await tester.flowTestAuto({
        sourceCode: sourceCode,
        updateConfig: {
          className: config.className,
          packageName: config.packageName,
          description: config.description || '',
          sourceCode: sourceCode
        }
      });
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP class', async () => {
      const testCase = getTestCaseDefinition('create_class', 'adt_class');
      const standardObject = resolveStandardObject('class', isCloudSystem, testCase);

      if (!standardObject) {
        logBuilderTestStart(testsLogger, 'Class - read standard object', {
          name: 'read_standard',
          params: {}
        });
        logBuilderTestSkip(testsLogger, 'Class - read standard object',
          `Standard class not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`);
        return;
      }

      const standardClassName = standardObject.name;
      logBuilderTestStart(testsLogger, 'Class - read standard object', {
        name: 'read_standard',
        params: { class_name: standardClassName }
      });

      if (!hasConfig) {
        logBuilderTestSkip(testsLogger, 'Class - read standard object', 'No SAP configuration');
        return;
      }

      try {
        const result = await client.getClass().read({ className: standardClassName });
        expect(result).toBeDefined();
        // IClassState doesn't have className directly, check readResult
        expect(result?.readResult).toBeDefined();

        logBuilderTestSuccess(testsLogger, 'Class - read standard object');
      } catch (error) {
        logBuilderTestError(testsLogger, 'Class - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'Class - read standard object');
      }
    }, getTimeout('test'));
  });

  describe('Read transport request', () => {
    it('should read transport request for class', async () => {
      const testCase = getTestCaseDefinition('create_class', 'adt_class');
      const standardObject = resolveStandardObject('class', isCloudSystem, testCase);

      if (!standardObject) {
        logBuilderTestStart(testsLogger, 'Class - read transport request', {
          name: 'read_transport',
          params: {}
        });
        logBuilderTestSkip(testsLogger, 'Class - read transport request',
          `Standard class not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`);
        return;
      }

      const standardClassName = standardObject.name;

      // Check if transport_request is configured in YAML
      const transportRequest = resolveTransportRequest(testCase?.params?.transport_request);
      if (!transportRequest) {
      logBuilderTestStart(testsLogger, 'Class - read transport request', {
        name: 'read_transport',
        params: { class_name: standardClassName }
      });
      logBuilderTestSkip(testsLogger, 'Class - read transport request',
        'transport_request not configured in test-config.yaml (required for transport read test)');
        return;
      }

      logBuilderTestStart(testsLogger, 'Class - read transport request', {
        name: 'read_transport',
        params: { class_name: standardClassName, transport_request: transportRequest }
      });

      if (!hasConfig) {
        logBuilderTestSkip(testsLogger, 'Class - read transport request', 'No SAP configuration');
        return;
      }

      try {
        const result = await client.getRequest().read({ transportNumber: transportRequest });
        expect(result).toBeDefined();
        expect(result?.transportNumber || result?.readResult?.data?.transport_request).toBe(transportRequest);

        logBuilderTestSuccess(testsLogger, 'Class - read transport request');
      } catch (error) {
        logBuilderTestError(testsLogger, 'Class - read transport request', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'Class - read transport request');
      }
    }, getTimeout('test'));
  });
});

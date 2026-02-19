/**
 * Integration test for Class
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_ADT_LIBS=true    - Class library logs
 *  DEBUG_CONNECTORS=true   - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPatterns=class/Class
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtClient } from '../../../../clients/AdtClient';
import type { IClassConfig, IClassState } from '../../../../core/class';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { BaseTester } from '../../../helpers/BaseTester';
import { getConfig } from '../../../helpers/sessionConfig';
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

// Library code (Class) uses DEBUG_ADT_LIBS
const libraryLogger: ILogger = createLibraryLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('Class (using AdtClient)', () => {
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
      client = new AdtClient(connection, libraryLogger);
      hasConfig = true;
      isCloudSystem = await isCloudEnvironment(connection);

      tester = new BaseTester(
        client.getClass(),
        'Class',
        'create_class',
        'adt_class',
        testsLogger,
      );

      tester.setup({
        connection,
        client,
        hasConfig,
        isCloudSystem,
        buildConfig: (testCase: any, resolver?: TestConfigResolver) => {
          // Use resolver to get resolved parameters (from test case params or global defaults)
          const packageName =
            resolver?.getPackageName() ||
            resolvePackageName(testCase?.params?.package_name);
          if (!packageName) throw new Error('package_name not configured');
          const transportRequest =
            resolver?.getTransportRequest() ||
            resolveTransportRequest(testCase?.params?.transport_request);
          const params = testCase?.params || {};
          return {
            className: params.class_name,
            packageName,
            transportRequest,
            description:
              params.description || `Test class ${params.class_name}`,
            sourceCode: params.source_code,
          };
        },
        ensureObjectReady: async (className: string) => {
          if (!connection) return { success: true };
          try {
            const cleanupClient = new AdtClient(connection, libraryLogger);
            const existingClass = await cleanupClient
              .getClass()
              .read({ className });
            if (existingClass) {
              await cleanupClient.getClass().readMetadata({ className });
              try {
                // Use BaseTester's config resolver to get transport request (allows overriding global params)
                const transportRequest = tester.getTransportRequest();
                await cleanupClient.getClass().delete({
                  className,
                  transportRequest,
                });
                await new Promise((resolve) => setTimeout(resolve, 3000));
              } catch (cleanupError: any) {
                return {
                  success: false,
                  reason: `Failed to delete existing class ${className}: ${cleanupError.message}`,
                };
              }
            }
          } catch (error: any) {
            if (error.response?.status !== 404) {
              return {
                success: false,
                reason: `Cannot verify class existence: ${error.message}`,
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
          `CLASS ${config.className} DEFINITION PUBLIC FINAL CREATE PUBLIC. ENDCLASS.`;

        await tester.flowTestAuto({
          sourceCode: sourceCode,
          updateConfig: {
            className: config.className,
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
      'should read standard SAP class',
      async () => {
        if (!hasConfig || !tester) {
          logTestSkip(
            testsLogger,
            'Class - read standard object',
            'No SAP configuration or tester not initialized',
          );
          return;
        }

        // Use BaseTester's method to get standard object (prioritizes standard_objects registry)
        const standardObject = tester.getStandardObject('class');

        if (!standardObject) {
          logTestStart(testsLogger, 'Class - read standard object', {
            name: 'read_standard',
            params: {},
          });
          logTestSkip(
            testsLogger,
            'Class - read standard object',
            `Standard class not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`,
          );
          return;
        }

        const standardClassName = standardObject.name;
        logTestStart(testsLogger, 'Class - read standard object', {
          name: 'read_standard',
          params: { class_name: standardClassName },
        });

        if (!hasConfig) {
          logTestSkip(
            testsLogger,
            'Class - read standard object',
            'No SAP configuration',
          );
          return;
        }

        try {
          const resultState = await tester.readTest({
            className: standardClassName,
          });
          expect(resultState).toBeDefined();
          // IClassState doesn't have className directly, check readResult
          expect(resultState?.readResult).toBeDefined();

          logTestSuccess(testsLogger, 'Class - read standard object');
        } catch (error) {
          logTestError(testsLogger, 'Class - read standard object', error);
          throw error;
        } finally {
          logTestEnd(testsLogger, 'Class - read standard object');
        }
      },
      getTimeout('test'),
    );
  });

  describe('Read transport request', () => {
    it(
      'should read transport request for class',
      async () => {
        if (!hasConfig || !tester) {
          logTestSkip(
            testsLogger,
            'Class - read transport request',
            'No SAP configuration or tester not initialized',
          );
          return;
        }

        // Use BaseTester's method to get standard object (prioritizes standard_objects registry)
        const standardObject = tester.getStandardObject('class');
        if (!standardObject) {
          logTestStart(testsLogger, 'Class - read transport request', {
            name: 'read_transport',
            params: {},
          });
          logTestSkip(
            testsLogger,
            'Class - read transport request',
            `Standard class not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`,
          );
          return;
        }

        const standardClassName = standardObject.name;

        // Try to get resolver for read_transport test case, fallback to create_class
        // Use BaseTester's config resolver if available, otherwise create new one
        let transportRequest = '';
        const resolver = new TestConfigResolver({
          isCloud: isCloudSystem,
          logger: testsLogger,
        }).tryMultipleHandlers([
          { handlerName: 'read_transport', testCaseName: 'read_transport' },
          { handlerName: 'create_class', testCaseName: 'adt_class' },
        ]);
        transportRequest =
          resolver?.getTransportRequest() || tester.getTransportRequest() || '';

        if (!transportRequest) {
          logTestStart(testsLogger, 'Class - read transport request', {
            name: 'read_transport',
            params: { class_name: standardClassName },
          });
          logTestSkip(
            testsLogger,
            'Class - read transport request',
            'transport_request not configured in test-config.yaml (required for transport read test)',
          );
          return;
        }

        logTestStart(testsLogger, 'Class - read transport request', {
          name: 'read_transport',
          params: {
            class_name: standardClassName,
            transport_request: transportRequest,
          },
        });

        if (!hasConfig) {
          logTestSkip(
            testsLogger,
            'Class - read transport request',
            'No SAP configuration',
          );
          return;
        }

        try {
          const result = await client
            .getRequest()
            .read({ transportNumber: transportRequest });
          expect(result).toBeDefined();
          expect(
            result?.transportNumber ||
              result?.readResult?.data?.transport_request,
          ).toBe(transportRequest);
          const metadataState = await client
            .getRequest()
            .readMetadata({ transportNumber: transportRequest });
          expect(metadataState).toBeDefined();
          expect(
            metadataState.transportNumber ||
              metadataState.readResult?.data?.transport_request,
          ).toBe(transportRequest);

          logTestSuccess(testsLogger, 'Class - read transport request');
        } catch (error) {
          logTestError(testsLogger, 'Class - read transport request', error);
          throw error;
        } finally {
          logTestEnd(testsLogger, 'Class - read transport request');
        }
      },
      getTimeout('test'),
    );
  });
});

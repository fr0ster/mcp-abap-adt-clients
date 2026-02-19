/**
 * Integration test for ServiceDefinition
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_ADT_LIBS=true    - ServiceDefinition library logs
 *  DEBUG_CONNECTORS=true   - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPatterns=serviceDefinition/ServiceDefinition
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtClient } from '../../../../clients/AdtClient';
import type {
  IServiceDefinitionConfig,
  IServiceDefinitionState,
} from '../../../../core/serviceDefinition';
import { getServiceDefinition } from '../../../../core/serviceDefinition/read';
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

// E2E tests use DEBUG_ADT_E2E_TESTS for test code
// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
// Library code (ServiceDefinition) uses DEBUG_ADT_LIBS

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code uses DEBUG_ADT_LIBS
const libraryLogger: ILogger = createLibraryLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('ServiceDefinition (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;
  let tester: BaseTester<IServiceDefinitionConfig, IServiceDefinitionState>;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, libraryLogger);
      hasConfig = true;
      isCloudSystem = await isCloudEnvironment(connection);

      tester = new BaseTester(
        client.getServiceDefinition(),
        'ServiceDefinition',
        'create_service_definition',
        'adt_service_definition',
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
            serviceDefinitionName: params.service_definition_name,
            packageName,
            transportRequest,
            description: params.description,
            sourceCode: params.source_code,
          };
        },
        ensureObjectReady: async (serviceDefinitionName: string) => {
          if (!connection) return { success: true };
          try {
            await getServiceDefinition(connection, serviceDefinitionName);
            return {
              success: false,
              reason: `⚠️ SAFETY: Service Definition ${serviceDefinitionName} already exists!`,
            };
          } catch (error: any) {
            if (error.response?.status !== 404) {
              return {
                success: false,
                reason: `Cannot verify service definition existence: ${error.message}`,
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
          `@EndUserText.label: '${config.description || config.serviceDefinitionName}'\ndefine service ${config.serviceDefinitionName} {\n expose ZOK_C_CDS_TEST;\n}`;

        await tester.flowTestAuto({
          sourceCode: sourceCode,
          updateConfig: {
            serviceDefinitionName: config.serviceDefinitionName,
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
      'should read standard SAP service definition',
      async () => {
        const {
          getTestCaseDefinition,
        } = require('../../../helpers/test-helper');
        const testCase = getTestCaseDefinition(
          'read_service_definition',
          'read_standard_service_definition',
        );

        if (!testCase) {
          logTestStart(
            testsLogger,
            'ServiceDefinition - read standard object',
            {
              name: 'read_standard',
              params: {},
            },
          );
          logTestSkip(
            testsLogger,
            'ServiceDefinition - read standard object',
            'Test case not defined in test-config.yaml',
          );
          return;
        }

        const enabledTestCase = getEnabledTestCase(
          'read_service_definition',
          'read_standard_service_definition',
        );
        if (!enabledTestCase) {
          logTestStart(
            testsLogger,
            'ServiceDefinition - read standard object',
            {
              name: 'read_standard',
              params: {},
            },
          );
          logTestSkip(
            testsLogger,
            'ServiceDefinition - read standard object',
            'Test case disabled or not found',
          );
          return;
        }

        // Get service definition name from test case params
        let serviceDefinitionName =
          enabledTestCase.params?.service_definition_name_cloud && isCloudSystem
            ? enabledTestCase.params.service_definition_name_cloud
            : enabledTestCase.params?.service_definition_name_onprem &&
                !isCloudSystem
              ? enabledTestCase.params.service_definition_name_onprem
              : enabledTestCase.params?.service_definition_name;

        if (!serviceDefinitionName) {
          // Fallback to standard_objects registry using TestConfigResolver
          const resolver = new TestConfigResolver({
            isCloud: isCloudSystem,
            logger: testsLogger,
          });
          const standardObject =
            resolver.getStandardObject('serviceDefinition');
          if (!standardObject) {
            logTestStart(
              testsLogger,
              'ServiceDefinition - read standard object',
              {
                name: 'read_standard',
                params: {},
              },
            );
            logTestSkip(
              testsLogger,
              'ServiceDefinition - read standard object',
              `Standard service definition not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`,
            );
            return;
          }
          serviceDefinitionName = standardObject.name;
        }

        logTestStart(testsLogger, 'ServiceDefinition - read standard object', {
          name: 'read_standard',
          params: { service_definition_name: serviceDefinitionName },
        });

        if (!hasConfig) {
          logTestSkip(
            testsLogger,
            'ServiceDefinition - read standard object',
            'No SAP configuration',
          );
          return;
        }

        try {
          const resultState = await tester.readTest({
            serviceDefinitionName: serviceDefinitionName,
          });
          if (!resultState) {
            logTestSkip(
              testsLogger,
              'ServiceDefinition - read standard object',
              `Standard service definition ${serviceDefinitionName} not found in system`,
            );
            return;
          }
          expect(resultState.readResult).toBeDefined();
          // ServiceDefinition read returns service definition config - check if serviceDefinitionName is present
          const serviceDefinitionConfig = resultState.readResult;
          if (
            serviceDefinitionConfig &&
            typeof serviceDefinitionConfig === 'object' &&
            'serviceDefinitionName' in serviceDefinitionConfig
          ) {
            expect((serviceDefinitionConfig as any).serviceDefinitionName).toBe(
              serviceDefinitionName,
            );
          }

          logTestSuccess(
            testsLogger,
            'ServiceDefinition - read standard object',
          );
        } catch (error: any) {
          logTestError(
            testsLogger,
            'ServiceDefinition - read standard object',
            error,
          );
          throw error;
        } finally {
          logTestEnd(testsLogger, 'ServiceDefinition - read standard object');
        }
      },
      getTimeout('test'),
    );
  });
});

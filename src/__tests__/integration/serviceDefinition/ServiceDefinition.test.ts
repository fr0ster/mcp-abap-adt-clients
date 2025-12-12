/**
 * Integration test for ServiceDefinitionBuilder
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - ServiceDefinitionBuilder library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=serviceDefinition/ServiceDefinitionBuilder
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { AdtClient } from '../../../clients/AdtClient';
import { getServiceDefinition } from '../../../core/serviceDefinition/read';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import { getConfig } from '../../helpers/sessionConfig';
import {
  logBuilderTestStart,
  logBuilderTestSkip,
  logBuilderTestSuccess,
  logBuilderTestError,
  logBuilderTestEnd
} from '../../helpers/builderTestLogger';
import { createBuilderLogger, createConnectionLogger, createTestsLogger } from '../../helpers/testLogger';
import { BaseTester } from '../../helpers/BaseTester';
import { IServiceDefinitionConfig, IServiceDefinitionState } from '../../../core/serviceDefinition';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const {
  getEnabledTestCase,
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

// E2E tests use DEBUG_ADT_E2E_TESTS for test code
// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
// Library code (ServiceDefinitionBuilder) uses DEBUG_ADT_LIBS

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code uses DEBUG_ADT_LIBS
const builderLogger: ILogger = createBuilderLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('ServiceDefinitionBuilder (using AdtClient)', () => {
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
      client = new AdtClient(connection, builderLogger);
      hasConfig = true;
      isCloudSystem = await isCloudEnvironment(connection);

      tester = new BaseTester(
        client.getServiceDefinition(),
        'ServiceDefinition',
        'create_service_definition',
        'adt_service_definition',
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
            serviceDefinitionName: params.service_definition_name,
            packageName,
            transportRequest: resolveTransportRequest(params.transport_request),
            description: params.description,
            sourceCode: params.source_code
          };
        },
        ensureObjectReady: async (serviceDefinitionName: string) => {
          if (!connection) return { success: true };
          try {
            await getServiceDefinition(connection, serviceDefinitionName);
            return { success: false, reason: `⚠️ SAFETY: Service Definition ${serviceDefinitionName} already exists!` };
          } catch (error: any) {
            if (error.response?.status !== 404) {
              return { success: false, reason: `Cannot verify service definition existence: ${error.message}` };
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
      const config = tester.getConfig();
      if (!config) return;

      const testCase = tester.getTestCaseDefinition();
      const sourceCode = testCase?.params?.source_code || config.sourceCode || 
        `@EndUserText.label: '${config.description || config.serviceDefinitionName}'\ndefine service ${config.serviceDefinitionName} {\n  expose ZOK_C_CDS_TEST;\n}`;

      await tester.flowTestAuto({
        sourceCode: sourceCode,
        updateConfig: {
          serviceDefinitionName: config.serviceDefinitionName,
          packageName: config.packageName,
          description: config.description || '',
          sourceCode: sourceCode
        }
      });
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP service definition', async () => {
      const testCase = getTestCaseDefinition('read_service_definition', 'read_standard_service_definition');
      
      if (!testCase) {
        logBuilderTestStart(testsLogger, 'ServiceDefinitionBuilder - read standard object', {
          name: 'read_standard',
          params: {}
        });
        logBuilderTestSkip(testsLogger, 'ServiceDefinitionBuilder - read standard object',
          'Test case not defined in test-config.yaml');
        return;
      }

      const enabledTestCase = getEnabledTestCase('read_service_definition', 'read_standard_service_definition');
      if (!enabledTestCase) {
        logBuilderTestStart(testsLogger, 'ServiceDefinitionBuilder - read standard object', {
          name: 'read_standard',
          params: {}
        });
        logBuilderTestSkip(testsLogger, 'ServiceDefinitionBuilder - read standard object',
          'Test case disabled or not found');
        return;
      }

      // Get service definition name from test case params
      let serviceDefinitionName = enabledTestCase.params?.service_definition_name_cloud && isCloudSystem
        ? enabledTestCase.params.service_definition_name_cloud
        : enabledTestCase.params?.service_definition_name_onprem && !isCloudSystem
        ? enabledTestCase.params.service_definition_name_onprem
        : enabledTestCase.params?.service_definition_name;

      if (!serviceDefinitionName) {
        // Fallback to standard_objects registry
        const standardObject = resolveStandardObject('serviceDefinition', isCloudSystem, testCase);
        if (!standardObject) {
          logBuilderTestStart(testsLogger, 'ServiceDefinitionBuilder - read standard object', {
            name: 'read_standard',
            params: {}
          });
          logBuilderTestSkip(testsLogger, 'ServiceDefinitionBuilder - read standard object',
            `Standard service definition not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`);
          return;
        }
        serviceDefinitionName = standardObject.name;
      }

      logBuilderTestStart(testsLogger, 'ServiceDefinitionBuilder - read standard object', {
        name: 'read_standard',
        params: { service_definition_name: serviceDefinitionName }
      });

      if (!hasConfig) {
        logBuilderTestSkip(testsLogger, 'ServiceDefinitionBuilder - read standard object', 'No SAP configuration');
        return;
      }

      try {
        const resultState = await client.getServiceDefinition().read({ serviceDefinitionName: serviceDefinitionName });
        expect(resultState).toBeDefined();
        expect(resultState?.readResult).toBeDefined();
        // ServiceDefinition read returns service definition config - check if serviceDefinitionName is present
        const serviceDefinitionConfig = resultState?.readResult;
        if (serviceDefinitionConfig && typeof serviceDefinitionConfig === 'object' && 'serviceDefinitionName' in serviceDefinitionConfig) {
          expect((serviceDefinitionConfig as any).serviceDefinitionName).toBe(serviceDefinitionName);
        }

        logBuilderTestSuccess(testsLogger, 'ServiceDefinitionBuilder - read standard object');
      } catch (error: any) {
        // If object doesn't exist (404), skip the test instead of failing
        if (error.response?.status === 404) {
          logBuilderTestSkip(testsLogger, 'ServiceDefinitionBuilder - read standard object',
            `Standard service definition ${serviceDefinitionName} not found in system`);
          return;
        }
        logBuilderTestError(testsLogger, 'ServiceDefinitionBuilder - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'ServiceDefinitionBuilder - read standard object');
      }
    }, getTimeout('test'));
  });
});


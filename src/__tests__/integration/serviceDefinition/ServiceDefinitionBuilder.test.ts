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
import { IAdtLogger } from '../../../utils/logger';
import { getServiceDefinition } from '../../../core/serviceDefinition/read';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import { getConfig } from '../../helpers/sessionConfig';
import {
  logBuilderTestStart,
  logBuilderTestSkip,
  logBuilderTestSuccess,
  logBuilderTestError,
  logBuilderTestEnd,
  logBuilderTestStep,
  logBuilderTestStepError,
  getHttpStatusText
} from '../../helpers/builderTestLogger';
import { createBuilderLogger, createConnectionLogger, createTestsLogger } from '../../helpers/testLogger';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const {
  getEnabledTestCase,
  getTestCaseDefinition,
  resolvePackageName,
  resolveTransportRequest,
  ensurePackageConfig,
  resolveStandardObject,
  getTimeout,
  getOperationDelay,
  retryCheckAfterActivate
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
const builderLogger: IAdtLogger = createBuilderLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: IAdtLogger = createTestsLogger();

describe('ServiceDefinitionBuilder (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, builderLogger);
      hasConfig = true;
      // Check if this is a cloud system
      isCloudSystem = await isCloudEnvironment(connection);
    } catch (error) {
      testsLogger.warn?.('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterAll(async () => {
    if (connection) {
      connection.reset();
    }
  });

  /**
   * Pre-check: Verify test service definition doesn't exist
   * Safety: Skip test if object exists to avoid accidental deletion
   */
  async function ensureServiceDefinitionReady(serviceDefinitionName: string): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: true };
    }

    // Check if service definition exists
    try {
      await getServiceDefinition(connection, serviceDefinitionName);
      return {
        success: false,
        reason: `⚠️ SAFETY: Service Definition ${serviceDefinitionName} already exists! ` +
                `Delete manually or use different test name to avoid accidental deletion.`
      };
    } catch (error: any) {
      // 404 is expected - object doesn't exist, we can proceed
      if (error.response?.status !== 404) {
        return {
          success: false,
          reason: `Cannot verify service definition existence: ${error.message}`
        };
      }
    }

    return { success: true };
  }

  function getBuilderTestDefinition() {
    return getTestCaseDefinition('create_service_definition', 'builder_service_definition');
  }

  function buildBuilderConfig(testCase: any) {
    const params = testCase?.params || {};
    const packageName = resolvePackageName(params.package_name);
    if (!packageName) {
      throw new Error('package_name not configured for ServiceDefinitionBuilder test');
    }
    return {
      serviceDefinitionName: params.service_definition_name,
      packageName,
      transportRequest: resolveTransportRequest(params.transport_request),
      description: params.description,
      sourceCode: params.source_code
    };
  }


  describe('Full workflow', () => {
    let testCase: any = null;
    let serviceDefinitionName: string | null = null;
    let skipReason: string | null = null;

    beforeEach(async () => {
      skipReason = null;
      testCase = null;
      serviceDefinitionName = null;

      if (!hasConfig) {
        skipReason = 'No SAP configuration';
        return;
      }

      const definition = getBuilderTestDefinition();
      if (!definition) {
        skipReason = 'Test case not defined in test-config.yaml';
        return;
      }

      const tc = getEnabledTestCase('create_service_definition', 'builder_service_definition');
      if (!tc) {
        skipReason = 'Test case disabled or not found';
        return;
      }

      const packageCheck = ensurePackageConfig(tc.params, 'ServiceDefinitionBuilder - full workflow');
      if (!packageCheck.success) {
        skipReason = packageCheck.reason || 'Default package is not configured';
        return;
      }

      testCase = tc;
      serviceDefinitionName = tc.params.service_definition_name;

      // Cleanup before test
      if (serviceDefinitionName) {
        const cleanup = await ensureServiceDefinitionReady(serviceDefinitionName);
        if (!cleanup.success) {
          skipReason = cleanup.reason || 'Failed to cleanup service definition before test';
          testCase = null;
          serviceDefinitionName = null;
        }
      }
    });

    it('should execute full workflow and store all results', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(testsLogger, 'ServiceDefinitionBuilder - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(testsLogger, 'ServiceDefinitionBuilder - full workflow', skipReason);
        return;
      }

      if (!testCase || !serviceDefinitionName) {
        logBuilderTestSkip(testsLogger, 'ServiceDefinitionBuilder - full workflow', skipReason || 'Test case not available');
        return;
      }

      const config = buildBuilderConfig(testCase);
      let serviceDefinitionCreated = false;
      let currentStep = '';

      try {
        // Ensure packageName is set
        if (!config.packageName) {
          throw new Error('packageName is required but not set in config');
        }

        currentStep = 'validate';
        logBuilderTestStep(currentStep);
        const validationState = await client.getServiceDefinition().validate({
          serviceDefinitionName: config.serviceDefinitionName,
          description: config.description || ''
        });
        const validationResponse = validationState?.validationResponse;
        if (validationResponse?.status !== 200) {
          const errorData = typeof validationResponse?.data === 'string' 
            ? validationResponse.data 
            : JSON.stringify(validationResponse?.data);
          console.error(`Validation failed (HTTP ${validationResponse?.status}): ${errorData}`);
        }
        expect(validationResponse?.status).toBe(200);
        
        currentStep = 'create';
        logBuilderTestStep(currentStep);
        const sourceCode = config.sourceCode || `@EndUserText.label: '${config.description || config.serviceDefinitionName}'\ndefine service ${config.serviceDefinitionName} {\n  expose ZOK_C_CDS_TEST;\n}`;
        await client.getServiceDefinition().create({
          serviceDefinitionName: config.serviceDefinitionName,
          packageName: config.packageName,
          description: config.description || ''
        }, { activateOnCreate: false, sourceCode: sourceCode });
        serviceDefinitionCreated = true;
        // Wait for SAP to finish create operation
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('create', testCase)));
        
        currentStep = 'check before update';
        logBuilderTestStep(currentStep);
        const checkBeforeUpdateState = await client.getServiceDefinition().check({ 
          serviceDefinitionName: config.serviceDefinitionName,
          sourceCode: sourceCode
        }, 'inactive');
        const checkBeforeUpdate = checkBeforeUpdateState?.checkResult;
        expect(checkBeforeUpdate?.status).toBeDefined();
        
        currentStep = 'update';
        logBuilderTestStep(currentStep);
        await client.getServiceDefinition().update({
          serviceDefinitionName: config.serviceDefinitionName
        }, { sourceCode: sourceCode });
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('update', testCase)));
        
        logBuilderTestStep('check(inactive)');
        const checkResultInactiveState = await client.getServiceDefinition().check({ serviceDefinitionName: config.serviceDefinitionName }, 'inactive');
        const checkResultInactive = checkResultInactiveState?.checkResult;
        expect(checkResultInactive?.status).toBeDefined();
        
        logBuilderTestStep('activate');
        await client.getServiceDefinition().activate({ serviceDefinitionName: config.serviceDefinitionName });
        // Wait for activation to complete (activation is asynchronous)
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('activate', testCase) || 2000));
        
        logBuilderTestStep('check(active)');
        // Retry check for active version - activation may take time
        const checkResultActiveState = await retryCheckAfterActivate(
          async () => {
            const state = await client.getServiceDefinition().check({ serviceDefinitionName: config.serviceDefinitionName }, 'active');
            return state?.checkResult;
          },
          {
            maxAttempts: 5,
            delay: 1000,
            logger: testsLogger,
            objectName: config.serviceDefinitionName
          }
        );
        expect(checkResultActiveState?.status).toBeDefined();

        logBuilderTestSuccess(testsLogger, 'ServiceDefinitionBuilder - full workflow');
      } catch (error: any) {
        // Log step error with details before failing test
        logBuilderTestStepError(currentStep || 'unknown', error);

        // Cleanup: delete if object was created
        if (serviceDefinitionCreated) {
          try {
            logBuilderTestStep('delete (cleanup)');
            await client.getServiceDefinition().delete({
              serviceDefinitionName: config.serviceDefinitionName,
              transportRequest: config?.transportRequest
            });
          } catch (cleanupError) {
            // Log cleanup error but don't fail test - original error is more important
            testsLogger.warn?.(`Cleanup failed for ${config.serviceDefinitionName}:`, cleanupError);
          }
        }

        const statusText = getHttpStatusText(error);
        const enhancedError = statusText !== 'HTTP ?'
          ? Object.assign(new Error(`[${statusText}] ${error.message}`), { stack: error.stack })
          : error;
        logBuilderTestError(testsLogger, 'ServiceDefinitionBuilder - full workflow', enhancedError);
        throw enhancedError;
      } finally {
        // Cleanup: delete
        if (serviceDefinitionName && serviceDefinitionCreated) {
          try {
            logBuilderTestStep('cleanup: delete');
            await client.getServiceDefinition().delete({
              serviceDefinitionName: serviceDefinitionName,
              transportRequest: config?.transportRequest
            }).catch((deleteError: any) => {
              testsLogger.warn?.('Failed to delete service definition during cleanup:', deleteError);
            });
          } catch (cleanupError: any) {
            testsLogger.warn?.('Cleanup error:', cleanupError);
          }
        }
        
        logBuilderTestEnd(testsLogger, 'ServiceDefinitionBuilder - full workflow');
      }
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
        logBuilderTestStep('read');
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


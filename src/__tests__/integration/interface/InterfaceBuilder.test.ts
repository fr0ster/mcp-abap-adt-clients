/**
 * Integration test for InterfaceBuilder
 * Tests using CrudClient for unified CRUD operations
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - InterfaceBuilder library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=interface/InterfaceBuilder
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { CrudClient } from '../../../clients/CrudClient';
import { InterfaceBuilder } from '../../../core/interface';
import { IAdtLogger } from '../../../utils/logger';
import { getInterface } from '../../../core/interface/read';
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
import { createConnectionLogger, createBuilderLogger, createTestsLogger } from '../../helpers/testLogger';
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

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code (InterfaceBuilder) uses DEBUG_ADT_LIBS
const builderLogger: IAdtLogger = createBuilderLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: IAdtLogger = createTestsLogger();

describe('InterfaceBuilder (using CrudClient)', () => {
  let connection: IAbapConnection;
  let client: CrudClient;
  let hasConfig = false;
  let isCloudSystem = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new CrudClient(connection);
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


  function getBuilderTestDefinition() {
    return getTestCaseDefinition('create_interface', 'builder_interface');
  }

  function buildBuilderConfig(testCase: any) {
    const params = testCase?.params || {};
    const packageName = resolvePackageName(params.package_name);
    if (!packageName) {
      throw new Error('package_name not configured for InterfaceBuilder test');
    }
    return {
      interfaceName: params.interface_name,
      packageName,
      transportRequest: resolveTransportRequest(params.transport_request),
      description: params.description,
      sourceCode: params.source_code
    };
  }

  async function waitForInterfaceCreation(interfaceName: string, maxAttempts = 5, delayMs = 2000): Promise<void> {
    if (!connection) {
      return;
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await getInterface(connection, interfaceName);
        if (process.env.DEBUG_ADT_TESTS === 'true') {
          console.log(`[waitForInterfaceCreation] Interface ${interfaceName} found on attempt ${attempt}`);
        }
        return;
      } catch (error: any) {
        if (error.response?.status !== 404) {
          throw error;
        }
        if (process.env.DEBUG_ADT_TESTS === 'true') {
          console.log(`[waitForInterfaceCreation] Interface ${interfaceName} not found yet (attempt ${attempt}/${maxAttempts})`);
        }
        if (attempt === maxAttempts) {
          throw new Error(`Interface ${interfaceName} was not created after ${maxAttempts} attempts (${maxAttempts * delayMs}ms total wait time)`);
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  describe('Full workflow', () => {
    let testCase: any = null;
    let interfaceName: string | null = null;
    let skipReason: string | null = null;

    beforeEach(async () => {
      skipReason = null;
      testCase = null;
      interfaceName = null;

      if (!hasConfig) {
        skipReason = 'No SAP configuration';
        return;
      }

      const definition = getBuilderTestDefinition();
      if (!definition) {
        skipReason = 'Test case not defined in test-config.yaml';
        return;
      }

      const tc = getEnabledTestCase('create_interface', 'builder_interface');
      if (!tc) {
        skipReason = 'Test case disabled or not found';
        return;
      }

      const packageCheck = ensurePackageConfig(tc.params, 'InterfaceBuilder - full workflow');
      if (!packageCheck.success) {
        skipReason = packageCheck.reason || 'Default package is not configured';
        return;
      }

      testCase = tc;
      interfaceName = tc.params.interface_name;
    });

    it('should execute full workflow and store all results', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(testsLogger, 'InterfaceBuilder - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(testsLogger, 'InterfaceBuilder - full workflow', skipReason);
        return;
      }

      if (!testCase || !interfaceName) {
        logBuilderTestSkip(testsLogger, 'InterfaceBuilder - full workflow', skipReason || 'Test case not available');
        return;
      }

      const config = buildBuilderConfig(testCase);

      logBuilderTestStep('validate');
      const validationResponse = await client.validateInterface({
        interfaceName: config.interfaceName,
        packageName: config.packageName!,
        description: config.description || ''
      });
      if (validationResponse?.status !== 200) {
        const errorData = typeof validationResponse?.data === 'string' 
          ? validationResponse.data 
          : JSON.stringify(validationResponse?.data);
        console.error(`Validation failed (HTTP ${validationResponse?.status}): ${errorData}`);
      }
      expect(validationResponse?.status).toBe(200);

      let interfaceCreated = false;
      let interfaceLocked = false;
      let currentStep = '';
      
      try {
        currentStep = 'create';
        logBuilderTestStep(currentStep);
        await client.createInterface({
          interfaceName: config.interfaceName,
          packageName: config.packageName!,
          description: config.description || '',
          transportRequest: config.transportRequest
        });
        
        // Verify create was successful
        const createResult = client.getCreateResult();
        if (!createResult) {
          throw new Error('Interface creation did not return a result');
        }
        if (createResult.status !== 201 && createResult.status !== 200) {
          const errorData = typeof createResult.data === 'string' 
            ? createResult.data 
            : JSON.stringify(createResult.data);
          console.error(`Create failed (HTTP ${createResult.status}): ${errorData}`);
          throw new Error(`Interface creation failed with status ${createResult.status}`);
        }
        
        interfaceCreated = true;
        
        if (process.env.DEBUG_ADT_TESTS === 'true') {
          console.log(`[InterfaceBuilder test] Create successful - Status: ${createResult.status}`);
        }
        
        // Wait for SAP to commit the object creation (metadata only)
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('create', testCase)));
        
        // Wait for interface to be available for lock
        await waitForInterfaceCreation(interfaceName!);

        currentStep = 'lock';
        logBuilderTestStep(currentStep);
        await client.lockInterface({ interfaceName: config.interfaceName });
        interfaceLocked = true;
        
        // Wait for SAP to commit lock operation
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('lock', testCase)));

        currentStep = 'update';
        logBuilderTestStep(currentStep);
        await client.updateInterface({
          interfaceName: config.interfaceName,
          sourceCode: config.sourceCode || ''
        });
        
        // Wait for SAP to commit update operation
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('update', testCase)));

        currentStep = 'check(inactive)';
        logBuilderTestStep(currentStep);
        const checkResultInactive = await client.checkInterface({ interfaceName: config.interfaceName });
        expect(checkResultInactive?.status).toBeDefined();

        currentStep = 'unlock';
        logBuilderTestStep(currentStep);
        await client.unlockInterface({ interfaceName: config.interfaceName });
        interfaceLocked = false; // Unlocked successfully
        
        // Wait for SAP to commit unlock operation
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('unlock', testCase)));

        currentStep = 'activate';
        logBuilderTestStep(currentStep);
        await client.activateInterface({ interfaceName: config.interfaceName });
        // Wait for activation to complete (activation is asynchronous)
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('activate', testCase) || 2000));

        currentStep = 'check(active)';
        logBuilderTestStep(currentStep);
        // Retry check for active version - activation may take time
        const checkResultActive = await retryCheckAfterActivate(
          () => client.checkInterface({ interfaceName: config.interfaceName }),
          {
            maxAttempts: 5,
            delay: 1000,
            logger: testsLogger,
            objectName: config.interfaceName
          }
        );
        expect(checkResultActive?.status).toBeDefined();

        currentStep = 'delete (cleanup)';
        logBuilderTestStep(currentStep);
        await client.deleteInterface({
          interfaceName: config.interfaceName,
          transportRequest: config.transportRequest
        });

        expect(client.getCreateResult()).toBeDefined();
        expect(client.getActivateResult()).toBeDefined();

        logBuilderTestSuccess(testsLogger, 'InterfaceBuilder - full workflow');
      } catch (error: any) {
        // Log step error with details before failing test
        logBuilderTestStepError(currentStep || 'unknown', error);
        
        // Cleanup: unlock and delete if object was created/locked
        if (interfaceLocked || interfaceCreated) {
          try {
            if (interfaceLocked) {
              logBuilderTestStep('unlock (cleanup)');
              await client.unlockInterface({ interfaceName: config.interfaceName });
            }
            if (interfaceCreated) {
              logBuilderTestStep('delete (cleanup)');
              await client.deleteInterface({
                interfaceName: config.interfaceName,
                transportRequest: config.transportRequest
              });
            }
          } catch (cleanupError) {
            // Log cleanup error but don't fail test - original error is more important
            testsLogger.warn?.(`Cleanup failed for ${config.interfaceName}:`, cleanupError);
          }
        }
        
        const statusText = getHttpStatusText(error);
        const enhancedError = statusText !== 'HTTP ?'
          ? Object.assign(new Error(`[${statusText}] ${error.message}`), { stack: error.stack })
          : error;
        logBuilderTestError(testsLogger, 'InterfaceBuilder - full workflow', enhancedError);
        throw enhancedError;
      } finally {
        logBuilderTestEnd(testsLogger, 'InterfaceBuilder - full workflow');
      }
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP interface', async () => {
      const testCase = getTestCaseDefinition('create_interface', 'builder_interface');
      const standardObject = resolveStandardObject('interface', isCloudSystem, testCase);

      if (!standardObject) {
        logBuilderTestStart(testsLogger, 'InterfaceBuilder - read standard object', {
          name: 'read_standard',
          params: {}
        });
        logBuilderTestSkip(
          builderLogger,
          'InterfaceBuilder - read standard object',
          `Standard interface not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`
        );
        return;
      }

      const standardInterfaceName = standardObject.name;
      logBuilderTestStart(testsLogger, 'InterfaceBuilder - read standard object', {
        name: 'read_standard',
        params: { interface_name: standardInterfaceName }
      });

      if (!hasConfig) {
        logBuilderTestSkip(testsLogger, 'InterfaceBuilder - read standard object', 'No SAP configuration');
        return;
      }

      try {
        logBuilderTestStep('read');
        const result = await client.readInterface(standardInterfaceName);
        expect(result).toBeDefined();
        expect(result?.interfaceName).toBe(standardInterfaceName);

        logBuilderTestSuccess(testsLogger, 'InterfaceBuilder - read standard object');
      } catch (error) {
        logBuilderTestError(testsLogger, 'InterfaceBuilder - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'InterfaceBuilder - read standard object');
      }
    }, getTimeout('test'));
  });
});


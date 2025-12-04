/**
 * Integration test for StructureBuilder
 * Tests using CrudClient for unified CRUD operations
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - StructureBuilder library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=structure/StructureBuilder
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { CrudClient } from '../../../clients/CrudClient';
import { StructureBuilder } from '../../../core/structure';
import { IAdtLogger } from '../../../utils/logger';
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
import { createBuilderLogger, createConnectionLogger, createTestsLogger, isDebugEnabled } from '../../helpers/testLogger';
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

// Library code uses DEBUG_ADT_LIBS
const builderLogger: IAdtLogger = createBuilderLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: IAdtLogger = createTestsLogger();

describe('StructureBuilder (using CrudClient)', () => {
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
    return getTestCaseDefinition('create_structure', 'builder_structure');
  }

  function buildBuilderConfig(testCase: any) {
    const params = testCase?.params || {};
    const packageName = resolvePackageName(params.package_name);
    if (!packageName) {
      throw new Error('package_name not configured for StructureBuilder test');
    }
    return {
      structureName: params.structure_name,
      packageName,
      transportRequest: resolveTransportRequest(params.transport_request),
      description: params.description,
      ddlCode: params.ddl_code
    };
  }

  describe('Full workflow', () => {
    let testCase: any = null;
    let structureName: string | null = null;
    let skipReason: string | null = null;

    beforeEach(async () => {
      skipReason = null;
      testCase = null;
      structureName = null;

      if (!hasConfig) {
        skipReason = 'No SAP configuration';
        return;
      }

      const definition = getBuilderTestDefinition();
      if (!definition) {
        skipReason = 'Test case not defined in test-config.yaml';
        return;
      }

      const tc = getEnabledTestCase('create_structure', 'builder_structure');
      if (!tc) {
        skipReason = 'Test case disabled or not found';
        return;
      }

      const packageCheck = ensurePackageConfig(tc.params, 'StructureBuilder - full workflow');
      if (!packageCheck.success) {
        skipReason = packageCheck.reason || 'Default package is not configured';
        return;
      }

      testCase = tc;
      structureName = tc.params.structure_name;
    });

    it('should execute full workflow and store all results', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(testsLogger, 'StructureBuilder - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(testsLogger, 'StructureBuilder - full workflow', skipReason);
        return;
      }

      if (!testCase || !structureName) {
        logBuilderTestSkip(testsLogger, 'StructureBuilder - full workflow', skipReason || 'Test case not available');
        return;
      }

      const config = buildBuilderConfig(testCase);

      logBuilderTestStep('validate');
      const validationResponse = await client.validateStructure({
        structureName: config.structureName,
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
      
      let structureCreated = false;
      let structureLocked = false;
      let currentStep = '';
      
      try {
        currentStep = 'create';
        logBuilderTestStep(currentStep);
        await client.createStructure({
          structureName: config.structureName,
          packageName: config.packageName!,
          description: config.description || '',
          ddlCode: config.ddlCode || '',
          transportRequest: config.transportRequest
        });
        structureCreated = true;
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('create', testCase)));
        
        currentStep = 'lock';
        logBuilderTestStep(currentStep);
        await client.lockStructure({ structureName: config.structureName });
        structureLocked = true;
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('lock', testCase)));
        
        currentStep = 'update';
        logBuilderTestStep(currentStep);
        await client.updateStructure({
          structureName: config.structureName,
          ddlCode: config.ddlCode || ''
        });
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('update', testCase)));
        
        currentStep = 'check(inactive)';
        logBuilderTestStep(currentStep);
        const checkResultInactive = await client.checkStructure({ structureName: config.structureName });
        expect(checkResultInactive?.status).toBeDefined();
        
        currentStep = 'unlock';
        logBuilderTestStep(currentStep);
        await client.unlockStructure({ structureName: config.structureName });
        structureLocked = false; // Unlocked successfully
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('unlock', testCase)));
        
        currentStep = 'activate';
        logBuilderTestStep(currentStep);
        await client.activateStructure({ structureName: config.structureName });
        // Wait for activation to complete (activation is asynchronous)
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('activate', testCase) || 2000));
        
        currentStep = 'check(active)';
        logBuilderTestStep(currentStep);
        // Retry check for active version - activation may take time
        const checkResultActive = await retryCheckAfterActivate(
          () => client.checkStructure({ structureName: config.structureName }),
          {
            maxAttempts: 5,
            delay: 1000,
            logger: testsLogger,
            objectName: config.structureName
          }
        );
        expect(checkResultActive?.status).toBeDefined();
        
        currentStep = 'delete (cleanup)';
        logBuilderTestStep(currentStep);
        await client.deleteStructure({
          structureName: config.structureName,
          transportRequest: config.transportRequest
        });

        expect(client.getCreateResult()).toBeDefined();
        expect(client.getActivateResult()).toBeDefined();

        logBuilderTestSuccess(testsLogger, 'StructureBuilder - full workflow');
      } catch (error: any) {
        // Log step error with details before failing test
        logBuilderTestStepError(currentStep || 'unknown', error);
        
        // Cleanup: unlock and delete if object was created/locked
        if (structureLocked || structureCreated) {
          try {
            if (structureLocked) {
              logBuilderTestStep('unlock (cleanup)');
              await client.unlockStructure({ structureName: config.structureName });
            }
            if (structureCreated) {
              logBuilderTestStep('delete (cleanup)');
              await client.deleteStructure({
                structureName: config.structureName,
                transportRequest: config.transportRequest
              });
            }
          } catch (cleanupError) {
            // Log cleanup error but don't fail test - original error is more important
            testsLogger.warn?.(`Cleanup failed for ${config.structureName}:`, cleanupError);
          }
        }
        
        const statusText = getHttpStatusText(error);
        const enhancedError = statusText !== 'HTTP ?'
          ? Object.assign(new Error(`[${statusText}] ${error.message}`), { stack: error.stack })
          : error;
        logBuilderTestError(testsLogger, 'StructureBuilder - full workflow', enhancedError);
        throw enhancedError;
      } finally {
        logBuilderTestEnd(testsLogger, 'StructureBuilder - full workflow');
      }
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP structure', async () => {
      const testCase = getTestCaseDefinition('create_structure', 'builder_structure');
      const standardObject = resolveStandardObject('structure', isCloudSystem, testCase);

      if (!standardObject) {
        logBuilderTestStart(testsLogger, 'StructureBuilder - read standard object', {
          name: 'read_standard',
          params: {}
        });
        logBuilderTestSkip(testsLogger, 'StructureBuilder - read standard object',
          `Standard structure not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`);
        return;
      }

      const standardStructureName = standardObject.name;
      logBuilderTestStart(testsLogger, 'StructureBuilder - read standard object', {
        name: 'read_standard',
        params: { structure_name: standardStructureName }
      });

      if (!hasConfig) {
        logBuilderTestSkip(testsLogger, 'StructureBuilder - read standard object', 'No SAP configuration');
        return;
      }

      try {
        logBuilderTestStep('read');
        const result = await client.readStructure(standardStructureName);
        expect(result).toBeDefined();
        expect(result?.structureName).toBe(standardStructureName);

        logBuilderTestSuccess(testsLogger, 'StructureBuilder - read standard object');
      } catch (error) {
        logBuilderTestError(testsLogger, 'StructureBuilder - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'StructureBuilder - read standard object');
      }
    }, getTimeout('test'));
  });
});

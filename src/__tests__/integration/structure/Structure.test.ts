/**
 * Integration test for StructureBuilder
 * Tests using AdtClient for unified CRUD operations
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
import { AdtClient } from '../../../clients/AdtClient';
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

describe('StructureBuilder (using AdtClient)', () => {
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


  function getBuilderTestDefinition() {
    return getTestCaseDefinition('create_structure', 'adt_structure');
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

      const tc = getEnabledTestCase('create_structure', 'adt_structure');
      if (!tc) {
        skipReason = 'Test case disabled or not found';
        return;
      }

      const packageCheck = ensurePackageConfig(tc.params, 'Structure - full workflow');
      if (!packageCheck.success) {
        skipReason = packageCheck.reason || 'Default package is not configured';
        return;
      }

      testCase = tc;
      structureName = tc.params.structure_name;
    });

    it('should execute full workflow and store all results', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(testsLogger, 'Structure - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(testsLogger, 'Structure - full workflow', skipReason);
        return;
      }

      if (!testCase || !structureName) {
        logBuilderTestSkip(testsLogger, 'Structure - full workflow', skipReason || 'Test case not available');
        return;
      }

      const config = buildBuilderConfig(testCase);

      logBuilderTestStep('validate');
      const validationState = await client.getStructure().validate({
        structureName: config.structureName,
        packageName: config.packageName!,
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
      
      let structureCreated = false;
      let currentStep = '';
      
      try {
        currentStep = 'create';
        logBuilderTestStep(currentStep);
        // Use updated_ddl_code if available, otherwise use ddlCode
        const updatedDdlCode = testCase.params.updated_ddl_code || config.ddlCode || '';
        await client.getStructure().create({
          structureName: config.structureName,
          packageName: config.packageName!,
          description: config.description || '',
          ddlCode: config.ddlCode || '',
          transportRequest: config.transportRequest
        }, { activateOnCreate: false, sourceCode: updatedDdlCode });
        structureCreated = true;
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('create', testCase)));
        
        currentStep = 'check before update';
        logBuilderTestStep(currentStep);
        const checkBeforeUpdateState = await client.getStructure().check({ 
          structureName: config.structureName,
          ddlCode: updatedDdlCode
        }, 'inactive');
        const checkBeforeUpdate = checkBeforeUpdateState?.checkResult;
        expect(checkBeforeUpdate?.status).toBeDefined();
        
        currentStep = 'update';
        logBuilderTestStep(currentStep);
        await client.getStructure().update({
          structureName: config.structureName
        }, { sourceCode: updatedDdlCode });
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('update', testCase)));
        
        // Check with new code (before unlock) - validates unsaved code
        currentStep = 'check(new_code)';
        logBuilderTestStep(currentStep);
        const checkResultNewCodeState = await client.getStructure().check({ 
          structureName: config.structureName,
          ddlCode: updatedDdlCode
        }, 'inactive');
        const checkResultNewCode = checkResultNewCodeState?.checkResult;
        expect(checkResultNewCode?.status).toBeDefined();
        testsLogger.info?.(`✅ Check with new code completed: ${checkResultNewCode?.status === 200 ? 'OK' : 'Has errors/warnings'}`);
        
        currentStep = 'check(inactive)';
        logBuilderTestStep(currentStep);
        const checkResultInactiveState = await client.getStructure().check({ structureName: config.structureName }, 'inactive');
        const checkResultInactive = checkResultInactiveState?.checkResult;
        expect(checkResultInactive?.status).toBeDefined();
        
        currentStep = 'activate';
        logBuilderTestStep(currentStep);
        await client.getStructure().activate({ structureName: config.structureName });
        // Wait for activation to complete (activation is asynchronous)
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('activate', testCase) || 2000));
        
        currentStep = 'check(active)';
        logBuilderTestStep(currentStep);
        // Retry check for active version - activation may take time
        const checkResultActiveState = await retryCheckAfterActivate(
          async () => {
            const state = await client.getStructure().check({ structureName: config.structureName }, 'active');
            return state?.checkResult;
          },
          {
            maxAttempts: 5,
            delay: 1000,
            logger: testsLogger,
            objectName: config.structureName
          }
        );
        expect(checkResultActiveState?.status).toBeDefined();
        
        currentStep = 'delete (cleanup)';
        logBuilderTestStep(currentStep);
        await client.getStructure().delete({
          structureName: config.structureName,
          transportRequest: config.transportRequest
        });

        logBuilderTestSuccess(testsLogger, 'Structure - full workflow');
      } catch (error: any) {
        // Log step error with details before failing test
        logBuilderTestStepError(currentStep || 'unknown', error);
        
        // Cleanup: delete if object was created
        if (structureCreated) {
          try {
            logBuilderTestStep('delete (cleanup)');
            await client.getStructure().delete({
              structureName: config.structureName,
              transportRequest: config.transportRequest
            });
          } catch (cleanupError) {
            // Log cleanup error but don't fail test - original error is more important
            testsLogger.warn?.(`Cleanup failed for ${config.structureName}:`, cleanupError);
          }
        }
        
        const statusText = getHttpStatusText(error);
        const enhancedError = statusText !== 'HTTP ?'
          ? Object.assign(new Error(`[${statusText}] ${error.message}`), { stack: error.stack })
          : error;
        logBuilderTestError(testsLogger, 'Structure - full workflow', enhancedError);
        throw enhancedError;
      } finally {
        logBuilderTestEnd(testsLogger, 'Structure - full workflow');
      }
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP structure', async () => {
      const testCase = getTestCaseDefinition('create_structure', 'adt_structure');
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
        const resultState = await client.getStructure().read({ structureName: standardStructureName });
        expect(resultState).toBeDefined();
        expect(resultState?.readResult).toBeDefined();
        // Structure read returns structure config - check if structureName is present
        const structureConfig = resultState?.readResult;
        if (structureConfig && typeof structureConfig === 'object' && 'structureName' in structureConfig) {
          expect((structureConfig as any).structureName).toBe(standardStructureName);
        }

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

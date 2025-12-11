/**
 * Integration test for BehaviorDefinitionBuilder
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 * - DEBUG_ADT_TESTS=true npm test -- --testPathPattern=behaviorDefinition    (ADT-clients logs)
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { AdtClient } from '../../../clients/AdtClient';
import { IAdtLogger } from '../../../utils/logger';
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
  resolveStandardObject,
  getEnvironmentConfig,
  getTimeout,
  getOperationDelay
} = require('../../helpers/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const debugEnabled = process.env.DEBUG_ADT_TESTS === 'true' || process.env.DEBUG_ADT === 'true';
const debugConnection = process.env.DEBUG_CONNECTORS === 'true'; // Connection uses DEBUG_CONNECTORS

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code uses DEBUG_ADT_LIBS
const builderLogger: IAdtLogger = createBuilderLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: IAdtLogger = createTestsLogger();

describe('BehaviorDefinitionBuilder (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let connectionConfig: any = null;
  let hasConfig = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connectionConfig = config;
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, builderLogger);
      hasConfig = true;
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
    return getTestCaseDefinition('create_behavior_definition', 'adt_behavior_definition');
  }

  function buildBuilderConfig(testCase: any) {
    const params = testCase?.params || {};

    // All parameters are required - no defaults, no auto-generation
    const bdefName = params.bdef_name;
    if (!bdefName) {
      throw new Error('bdef_name is required in test-config.yaml');
    }

    const rootEntity = params.root_entity;
    if (!rootEntity) {
      throw new Error('root_entity is required in test-config.yaml');
    }

    const sourceCode = params.source_code;
    if (!sourceCode) {
      throw new Error('source_code is required in test-config.yaml');
    }

    const packageName = params.package_name || resolvePackageName(undefined);
    if (!packageName) {
      throw new Error('Package name is not configured. Set params.package_name or environment.default_package');
    }

    const implementationType = params.implementation_type || params.implementationType;
    if (!implementationType) {
      throw new Error('implementation_type is required in test-config.yaml');
    }

    const description = params.description;
    if (!description) {
      throw new Error('description is required in test-config.yaml');
    }

    return {
      bdefName,
      packageName,
      rootEntity,
      implementationType,
      description,
      transportRequest: params.transport_request || getEnvironmentConfig().default_transport || '',
      sourceCode
    };
  }

  describe('Full workflow test', () => {
    let testCase: any = null;
    let skipReason: string | null = null;

    beforeAll(async () => {
      if (!hasConfig) {
        skipReason = 'No connection configuration available';
        return;
      }

      const tc = getEnabledTestCase('create_behavior_definition', 'adt_behavior_definition');
      if (!tc) {
        skipReason = 'Test case disabled or not found';
        return;
      }

      // Validate all required parameters are present
      if (!tc.params.bdef_name) {
        skipReason = 'bdef_name is required in test-config.yaml';
        return;
      }

      if (!tc.params.root_entity) {
        skipReason = 'root_entity is required in test-config.yaml';
        return;
      }

      if (!tc.params.source_code) {
        skipReason = 'source_code is required in test-config.yaml';
        return;
      }

      const packageName = tc.params.package_name || resolvePackageName(undefined);
      if (!packageName) {
        skipReason = 'Package name is not configured. Set params.package_name or environment.default_package';
        return;
      }

      if (!tc.params.implementation_type && !tc.params.implementationType) {
        skipReason = 'implementation_type is required in test-config.yaml';
        return;
      }

      if (!tc.params.description) {
        skipReason = 'description is required in test-config.yaml';
        return;
      }

      testCase = tc;
    });

    it('should execute full workflow and store all results', async () => {
      if (skipReason) {
        logBuilderTestSkip(testsLogger, 'BehaviorDefinition - full workflow', skipReason);
        return;
      }

      if (!testCase) {
        logBuilderTestSkip(testsLogger, 'BehaviorDefinition - full workflow', skipReason || 'Test case not available');
        return;
      }

      logBuilderTestStart(testsLogger, 'BehaviorDefinition - full workflow', testCase);

      const config = buildBuilderConfig(testCase);
      let behaviorDefinitionCreated = false;
      let currentStep = '';

      try {
        currentStep = 'validate';
        logBuilderTestStep(currentStep);
        const validationState = await client.getBehaviorDefinition().validate({
          name: config.bdefName,
          rootEntity: config.rootEntity,
          packageName: config.packageName,
          description: config.description,
          implementationType: config.implementationType as 'Managed' | 'Unmanaged' | 'Abstract' | 'Projection'
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
        await client.getBehaviorDefinition().create({
          name: config.bdefName,
          packageName: config.packageName,
          description: config.description,
          rootEntity: config.rootEntity,
          implementationType: config.implementationType as 'Managed' | 'Unmanaged' | 'Abstract' | 'Projection',
          transportRequest: config.transportRequest
        }, { activateOnCreate: false, sourceCode: config.sourceCode });
        behaviorDefinitionCreated = true;
        
        const createDelay = getOperationDelay('create', testCase);
        if (createDelay > 0) {
          logBuilderTestStep(`wait (after create ${createDelay}ms)`);
          await new Promise(resolve => setTimeout(resolve, createDelay));
        }
        
        logBuilderTestStep('read');
        // Read behavior definition source to verify it was created
        const readState = await client.getBehaviorDefinition().read({ name: config.bdefName });
        expect(readState).toBeDefined();
        expect(readState?.readResult).toBeDefined();
        
        currentStep = 'check before update';
        logBuilderTestStep(currentStep);
        await client.getBehaviorDefinition().check({ name: config.bdefName });
        
        currentStep = 'update';
        logBuilderTestStep(currentStep);
        await client.getBehaviorDefinition().update({
          name: config.bdefName
        }, { sourceCode: config.sourceCode });
        
        const updateDelay = getOperationDelay('update', testCase);
        if (updateDelay > 0) {
          logBuilderTestStep(`wait (after update ${updateDelay}ms)`);
          await new Promise(resolve => setTimeout(resolve, updateDelay));
        }
        
        logBuilderTestStep('check(inactive)');
        const checkResult1State = await client.getBehaviorDefinition().check({ name: config.bdefName }, 'inactive');
        const checkResult1 = checkResult1State?.checkResult;
        expect(checkResult1?.status).toBeDefined();
        
        logBuilderTestStep('activate');
        await client.getBehaviorDefinition().activate({ name: config.bdefName });
        
        const activateDelay = getOperationDelay('activate', testCase);
        if (activateDelay > 0) {
          logBuilderTestStep(`wait (after activate ${activateDelay}ms)`);
          await new Promise(resolve => setTimeout(resolve, activateDelay));
        }
        
        logBuilderTestStep('check(active)');
        const checkResult2State = await client.getBehaviorDefinition().check({ name: config.bdefName }, 'active');
        const checkResult2 = checkResult2State?.checkResult;
        expect(checkResult2?.status).toBeDefined();

        logBuilderTestSuccess(testsLogger, 'BehaviorDefinition - full workflow');
      } catch (error: any) {
        // Log step error with details before failing test
        logBuilderTestStepError(currentStep || 'unknown', error);

        // Cleanup: delete if object was created
        if (behaviorDefinitionCreated) {
          try {
            logBuilderTestStep('delete (cleanup)');
            await client.getBehaviorDefinition().delete({
              name: config.bdefName,
              transportRequest: config.transportRequest
            });
          } catch (cleanupError) {
            // Log cleanup error but don't fail test - original error is more important
            testsLogger.warn?.(`Cleanup failed for ${config.bdefName}:`, cleanupError);
          }
        }

        const statusText = getHttpStatusText(error);
        const enhancedError = statusText !== 'HTTP ?'
          ? Object.assign(new Error(`[${statusText}] ${error.message}`), { stack: error.stack })
          : error;
        logBuilderTestError(testsLogger, 'BehaviorDefinition - full workflow', enhancedError);
        throw enhancedError;
      } finally {
        // Cleanup: delete behavior definition
        if (config && behaviorDefinitionCreated) {
          try {
            logBuilderTestStep('delete (cleanup)');
            await client.getBehaviorDefinition().delete({
              name: config.bdefName,
              transportRequest: config.transportRequest
            });
            testsLogger.info?.('Behavior definition deleted successfully during cleanup');
          } catch (deleteError: any) {
            testsLogger.warn?.('Failed to delete behavior definition during cleanup:', deleteError.message || deleteError);
          }
        }
        logBuilderTestEnd(testsLogger, 'BehaviorDefinition - full workflow');
      }
    }, getTimeout('test'));
  });
});


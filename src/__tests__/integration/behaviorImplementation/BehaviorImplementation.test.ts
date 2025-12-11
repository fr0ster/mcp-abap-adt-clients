/**
 * Integration test for BehaviorImplementationBuilder
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 * - DEBUG_ADT_TESTS=true npm test -- --testPathPattern=behaviorImplementation    (ADT-clients logs)
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { AdtClient } from '../../../clients/AdtClient';
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
  getOperationDelay,
  resolveTransportRequest,
  createDependencyBehaviorDefinition,
  extractValidationErrorMessage
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
const builderLogger: ILogger = createBuilderLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('BehaviorImplementationBuilder (using AdtClient)', () => {
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
    return getTestCaseDefinition('create_behavior_implementation', 'adt_behavior_implementation');
  }

  function buildBuilderConfig(testCase: any) {
    const params = testCase?.params || {};

    const packageName =
      params.package_name ||
      resolvePackageName(undefined);
    if (!packageName) {
      throw new Error('Package name is not configured. Set params.package_name or environment.default_package');
    }

    const className =
      params.class_name ||
      params.test_class_name;

    if (!className) {
      throw new Error('class_name is not configured for BehaviorImplementationBuilder test');
    }

    const behaviorDefinition = (
      params.behavior_definition ||
      params.bdef_name ||
      params.root_entity
    )?.trim();

    if (!behaviorDefinition) {
      throw new Error('behavior_definition is not configured for BehaviorImplementationBuilder test');
    }

    const description = params.description || `Behavior Implementation for ${behaviorDefinition}`;

    return {
      className,
      packageName,
      behaviorDefinition,
      description,
      transportRequest: params.transport_request || getEnvironmentConfig().default_transport || '',
      sourceCode: params.source_code || generateDefaultImplementationCode(className, behaviorDefinition)
    };
  }

  function generateDefaultImplementationCode(className: string, behaviorDefinition: string): string {
    const localHandlerName = `lhc_${behaviorDefinition}`;
    return `CLASS ${localHandlerName} DEFINITION INHERITING FROM cl_abap_behavior_handler.
  PRIVATE SECTION.
    METHODS get_instance_authorizations FOR INSTANCE AUTHORIZATION
      IMPORTING keys REQUEST requested_authorizations FOR ${behaviorDefinition.toLowerCase()} RESULT result.

    METHODS get_global_authorizations FOR GLOBAL AUTHORIZATION
      IMPORTING REQUEST requested_authorizations FOR ${behaviorDefinition.toLowerCase()} RESULT result.

ENDCLASS.

CLASS ${localHandlerName} IMPLEMENTATION.

  METHOD get_instance_authorizations.

  ENDMETHOD.

  METHOD get_global_authorizations.

  ENDMETHOD.

ENDCLASS.`;
  }

  describe('Full workflow test', () => {
    let testCase: any = null;
    let className: string | null = null;
    let behaviorDefinitionName: string | null = null;
    let behaviorDefinitionCreated: boolean = false;
    let skipReason: string | null = null;

    beforeAll(async () => {
      if (!hasConfig) {
        skipReason = 'No connection configuration available';
        return;
      }

      const definition = getBuilderTestDefinition();
      if (!definition) {
        skipReason = 'Test case not defined in test-config.yaml';
        return;
      }

      const tc = getEnabledTestCase('create_behavior_implementation', 'adt_behavior_implementation');
      if (!tc) {
        skipReason = 'Test case disabled or not found';
        return;
      }

      const packageName = tc.params.package_name || resolvePackageName(undefined);
      if (!packageName) {
        skipReason = 'Package name is not configured. Set params.package_name or environment.default_package';
        return;
      }
      tc.params.package_name = packageName;

      testCase = tc;
      className = tc.params.class_name || tc.params.test_class_name;

      // Create behavior definition before test if behavior_definition_name and behavior_definition_source are provided
      if (tc.params.behavior_definition_name && tc.params.behavior_definition_source) {
        const behaviorDefinitionConfig = {
          bdefName: tc.params.behavior_definition_name,
          packageName: packageName,
          description: `Test behavior definition for ${className}`,
          rootEntity: tc.params.root_entity || tc.params.behavior_definition_name,
          implementationType: tc.params.implementation_type || 'Managed',
          sourceCode: tc.params.behavior_definition_source,
          transportRequest: resolveTransportRequest(tc.params.transport_request)
        };

        // Note: createDependencyBehaviorDefinition expects CrudClient, but we can use AdtClient.getBehaviorDefinition()
        const tempCrudClient = new (require('../../../clients/CrudClient').CrudClient)(connection);
        const behaviorDefinitionResult = await createDependencyBehaviorDefinition(tempCrudClient, behaviorDefinitionConfig, tc);
        
        if (!behaviorDefinitionResult.success) {
          skipReason = behaviorDefinitionResult.reason || `environment problem, test skipped: Failed to create required dependency behavior definition ${tc.params.behavior_definition_name}`;
          testCase = null;
          className = null;
          return;
        }

        behaviorDefinitionName = tc.params.behavior_definition_name;
        behaviorDefinitionCreated = behaviorDefinitionResult.created || false;
      }
    });

    afterAll(async () => {
      // Cleanup behavior definition if it was created in beforeAll
      if (behaviorDefinitionCreated && behaviorDefinitionName) {
        try {
          await client.getBehaviorDefinition().delete({
            name: behaviorDefinitionName,
            transportRequest: resolveTransportRequest(testCase?.params?.transport_request) || ''
          });
        } catch (cleanupError) {
          // Log but don't fail - cleanup errors are silent
          testsLogger.warn?.(`Cleanup failed for behavior definition ${behaviorDefinitionName}:`, cleanupError);
        }
      }
    });

    it('should execute full workflow and store all results', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(testsLogger, 'BehaviorImplementation - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(testsLogger, 'BehaviorImplementation - full workflow', skipReason);
        return;
      }

      if (!testCase || !className) {
        logBuilderTestSkip(testsLogger, 'BehaviorImplementation - full workflow', skipReason || 'Test case not available');
        return;
      }

      const config = buildBuilderConfig(testCase);
      
      // Check cleanup settings: cleanup_after_test (global) and skip_cleanup (test-specific or global)
      const envConfig = getEnvironmentConfig();
      const cleanupAfterTest = envConfig.cleanup_after_test !== false; // Default: true if not set
      const globalSkipCleanup = envConfig.skip_cleanup === true;
      const skipCleanup = testCase.params.skip_cleanup !== undefined
        ? testCase.params.skip_cleanup === true
        : globalSkipCleanup;
      const shouldCleanup = cleanupAfterTest && !skipCleanup;
      
      let behaviorImplementationCreated = false;
      let currentStep = '';

      try {
        currentStep = 'validate';
        logBuilderTestStep(currentStep);
        const validationState = await client.getBehaviorImplementation().validate({
          className: config.className,
          packageName: config.packageName,
          behaviorDefinition: config.behaviorDefinition,
          description: config.description
        });
        const validationResponse = validationState?.validationResponse;
        
        // If validation returns 400 and object already exists, skip test
        if (validationResponse?.status === 400) {
          const errorData = validationResponse?.data;
          const errorText = typeof errorData === 'string' ? errorData : JSON.stringify(errorData || {});
          if (errorText.toLowerCase().includes('already exists') ||
              errorText.toLowerCase().includes('does already exist') ||
              (errorText.toLowerCase().includes('global type') && errorText.toLowerCase().includes('already exists'))) {
            logBuilderTestSkip(testsLogger, 'BehaviorImplementation - full workflow', 
              `⚠️ SAFETY: Behavior implementation class ${config.className} already exists! ` +
              `Delete manually or use different test name to avoid accidental deletion.`);
            return;
          }
        }
        
        // Validation successful (200) - object can be created
        if (validationResponse?.status !== 200) {
          const errorMessage = extractValidationErrorMessage(validationResponse);
          logBuilderTestStepError('validate', {
            response: {
              status: validationResponse?.status,
              data: validationResponse?.data
            }
          });
          logBuilderTestSkip(testsLogger, 'BehaviorImplementation - full workflow', 
            `Validation failed: ${errorMessage} - environment problem, test skipped`);
          return;
        }
        
        currentStep = 'create';
        logBuilderTestStep(currentStep);
        await client.getBehaviorImplementation().create({
          className: config.className,
          packageName: config.packageName,
          behaviorDefinition: config.behaviorDefinition,
          description: config.description,
          transportRequest: config.transportRequest
        }, { activateOnCreate: false, sourceCode: config.sourceCode });
        behaviorImplementationCreated = true;
        
        logBuilderTestStep('check(inactive)');
        const checkResult1State = await client.getClass().check({ className: config.className }, 'inactive');
        const checkResult1 = checkResult1State?.checkResult;
        expect(checkResult1?.status).toBeDefined();
        
        const createDelay = getOperationDelay('create', testCase);
        if (createDelay > 0) {
          logBuilderTestStep(`wait (after create ${createDelay}ms)`);
          await new Promise(resolve => setTimeout(resolve, createDelay));
        }
        
        logBuilderTestStep('read');
        // Read behavior implementation class source to verify it was created
        const readState = await client.getBehaviorImplementation().read({ 
          className: config.className,
          behaviorDefinition: config.behaviorDefinition
        });
        expect(readState).toBeDefined();
        expect(readState?.readResult).toBeDefined();
        
        currentStep = 'check before update';
        logBuilderTestStep(currentStep);
        await client.getClass().check({ className: config.className });
        
        currentStep = 'update';
        logBuilderTestStep('update');
        await client.getBehaviorImplementation().update({
          className: config.className,
          behaviorDefinition: config.behaviorDefinition
        }, { sourceCode: config.sourceCode });
        
        const updateDelay = getOperationDelay('update', testCase);
        if (updateDelay > 0) {
          logBuilderTestStep(`wait (after update ${updateDelay}ms)`);
          await new Promise(resolve => setTimeout(resolve, updateDelay));
        }
        
        logBuilderTestStep('check(inactive)');
        const checkResult2State = await client.getClass().check({ className: config.className }, 'inactive');
        const checkResult2 = checkResult2State?.checkResult;
        expect(checkResult2?.status).toBeDefined();
        
        logBuilderTestStep('activate');
        await client.getClass().activate({ className: config.className });
        
        const activateDelay = getOperationDelay('activate', testCase);
        if (activateDelay > 0) {
          logBuilderTestStep(`wait (after activate ${activateDelay}ms)`);
          await new Promise(resolve => setTimeout(resolve, activateDelay));
        }
        
        logBuilderTestStep('check(active)');
        const checkResult3State = await client.getClass().check({ className: config.className }, 'active');
        const checkResult3 = checkResult3State?.checkResult;
        expect(checkResult3?.status).toBeDefined();

        logBuilderTestSuccess(testsLogger, 'BehaviorImplementation - full workflow');
      } catch (error: any) {
        // Log step error with details before failing test
        logBuilderTestStepError(currentStep || 'unknown', error);

        // Cleanup: delete if object was created and cleanup is enabled
        if (shouldCleanup && behaviorImplementationCreated) {
          try {
            logBuilderTestStep('delete (cleanup)');
            await client.getClass().delete({
              className: config.className,
              transportRequest: config.transportRequest
            });
          } catch (cleanupError) {
            // Log cleanup error but don't fail test - original error is more important
            testsLogger.warn?.(`Cleanup failed for ${config.className}:`, cleanupError);
          }
        } else if (!shouldCleanup && behaviorImplementationCreated) {
          testsLogger.info?.(`⚠️ Cleanup skipped (cleanup_after_test=${cleanupAfterTest}, skip_cleanup=${skipCleanup}) - behavior implementation left for analysis: ${config.className}`);
        }

        const statusText = getHttpStatusText(error);
        const enhancedError = statusText !== 'HTTP ?'
          ? Object.assign(new Error(`[${statusText}] ${error.message}`), { stack: error.stack })
          : error;
        logBuilderTestError(testsLogger, 'BehaviorImplementation - full workflow', enhancedError);
        throw enhancedError;
      } finally {
        // Cleanup: delete behavior implementation class if cleanup is enabled
        if (shouldCleanup && className && behaviorImplementationCreated) {
          try {
            logBuilderTestStep('delete (cleanup)');
            await client.getClass().delete({
              className: className,
              transportRequest: testCase?.params?.transport_request || getEnvironmentConfig().default_transport || ''
            });
            testsLogger.info?.('Behavior implementation class deleted successfully during cleanup');
          } catch (deleteError: any) {
            testsLogger.warn?.('Failed to delete behavior implementation class during cleanup:', deleteError.message || deleteError);
          }
        } else if (!shouldCleanup && className && behaviorImplementationCreated) {
          testsLogger.info?.(`⚠️ Cleanup skipped (cleanup_after_test=${cleanupAfterTest}, skip_cleanup=${skipCleanup}) - behavior implementation left for analysis: ${className}`);
        }
        logBuilderTestEnd(testsLogger, 'BehaviorImplementation - full workflow');
      }
    });
  });
});


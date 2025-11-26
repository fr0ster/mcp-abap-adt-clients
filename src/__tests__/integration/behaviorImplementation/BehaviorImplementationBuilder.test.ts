/**
 * Integration test for BehaviorImplementationBuilder
 * Tests using CrudClient for unified CRUD operations
 *
 * Enable debug logs:
 * - DEBUG_ADT_TESTS=true npm test -- --testPathPattern=behaviorImplementation    (ADT-clients logs)
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { CrudClient } from '../../../clients/CrudClient';
import { BehaviorImplementationBuilder } from '../../../core/behaviorImplementation';
import { IAdtLogger } from '../../../utils/logger';
import { getBehaviorImplementationSource } from '../../../core/behaviorImplementation/read';
import { getConfig } from '../../helpers/sessionConfig';
import {
  logBuilderTestStart,
  logBuilderTestSkip,
  logBuilderTestSuccess,
  logBuilderTestError,
  logBuilderTestEnd,
  logBuilderTestStep
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
} = require('../../../../tests/test-helper');

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

describe('BehaviorImplementationBuilder (using CrudClient)', () => {
  let connection: AbapConnection;
  let client: CrudClient;
  let connectionConfig: any = null;
  let hasConfig = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connectionConfig = config;
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new CrudClient(connection);
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

  /**
   * Pre-check: Verify test behavior implementation class doesn't exist
   * Safety: Skip test if object exists to avoid accidental deletion
   */
  async function ensureBehaviorImplementationReady(className: string): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: true };
    }

    // Check if class exists
    try {
      await getBehaviorImplementationSource(connection, className);
      // Class exists - skip test for safety
      return {
        success: false,
        reason: `⚠️ SAFETY: Behavior implementation class ${className} already exists! ` +
                `Delete manually or use different test name to avoid accidental deletion.`
      };
    } catch (error: any) {
      const status = error.response?.status;
      
      // 404 is expected - object doesn't exist, we can proceed
      if (status === 404) {
        return { success: true };
      }
      
      // Any other error (including locked state) means class might exist
      // Better to skip test for safety
      const errorMsg = error.message || 'Unknown error';
      if (debugEnabled) {
        builderLogger.warn?.(`[PRE-CHECK] Behavior implementation class ${className} check failed with status ${status}: ${errorMsg}`);
      }
      
      return {
        success: false,
        reason: `⚠️ SAFETY: Cannot verify behavior implementation class ${className} doesn't exist (HTTP ${status}). ` +
                `May be locked or inaccessible. Delete/unlock manually to proceed.`
      };
    }
  }

  function getBuilderTestDefinition() {
    return getTestCaseDefinition('create_behavior_implementation', 'builder_behavior_implementation');
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

      const tc = getEnabledTestCase('create_behavior_implementation', 'builder_behavior_implementation');
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

      // Pre-check: Verify behavior implementation class doesn't exist before test
      if (className) {
        const readyCheck = await ensureBehaviorImplementationReady(className);
        if (!readyCheck.success) {
          skipReason = readyCheck.reason || 'Behavior implementation class pre-check failed';
          testCase = null;
          className = null;
        }
      }
    });

    it('should execute full workflow and store all results', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(testsLogger, 'BehaviorImplementationBuilder - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(testsLogger, 'BehaviorImplementationBuilder - full workflow', skipReason);
        return;
      }

      if (!testCase || !className) {
        logBuilderTestSkip(testsLogger, 'BehaviorImplementationBuilder - full workflow', skipReason || 'Test case not available');
        return;
      }

      const config = buildBuilderConfig(testCase);

      try {
        logBuilderTestStep('validate');
        const validationResponse = await client.validateBehaviorImplementation({
          className: config.className,
          packageName: config.packageName,
          behaviorDefinition: config.behaviorDefinition,
          description: config.description
        });
        if (validationResponse?.status !== 200) {
          const errorData = typeof validationResponse?.data === 'string' 
            ? validationResponse.data 
            : JSON.stringify(validationResponse?.data);
          console.error(`Validation failed (HTTP ${validationResponse?.status}): ${errorData}`);
        }
        expect(validationResponse?.status).toBe(200);
        
        logBuilderTestStep('create');
        await client.createBehaviorImplementation({
          className: config.className,
          packageName: config.packageName,
          behaviorDefinition: config.behaviorDefinition,
          description: config.description,
          transportRequest: config.transportRequest
        });
        
        logBuilderTestStep('check(inactive)');
        const checkResult1 = await client.checkClass({ className: config.className }, 'inactive');
        expect(checkResult1?.status).toBeDefined();
        
        const createDelay = getOperationDelay('create', testCase);
        if (createDelay > 0) {
          logBuilderTestStep(`wait (after create ${createDelay}ms)`);
          await new Promise(resolve => setTimeout(resolve, createDelay));
        }
        
        logBuilderTestStep('read');
        // Read behavior implementation class source to verify it was created
        const builder = client.getBehaviorImplementationBuilderInstance({
          className: config.className,
          behaviorDefinition: config.behaviorDefinition
        });
        const readResult = await builder.read('active');
        expect(readResult).toBeDefined();
        expect(readResult?.className).toBe(config.className);
        
        logBuilderTestStep('lock');
        await client.lockClass({
          className: config.className
        });
        
        logBuilderTestStep('updateMainSource');
        await client.updateBehaviorImplementationMainSource({
          className: config.className,
          behaviorDefinition: config.behaviorDefinition
        });
        
        logBuilderTestStep('updateImplementations');
        await client.updateBehaviorImplementation({
          className: config.className,
          behaviorDefinition: config.behaviorDefinition
        });
        
        const updateDelay = getOperationDelay('update', testCase);
        if (updateDelay > 0) {
          logBuilderTestStep(`wait (after update ${updateDelay}ms)`);
          await new Promise(resolve => setTimeout(resolve, updateDelay));
        }
        
        logBuilderTestStep('check(inactive)');
        const checkResult2 = await client.checkClass({ className: config.className }, 'inactive');
        expect(checkResult2?.status).toBeDefined();
        
        logBuilderTestStep('unlock');
        await client.unlockClass({
          className: config.className
        });
        
        const unlockDelay = getOperationDelay('unlock', testCase);
        if (unlockDelay > 0) {
          logBuilderTestStep(`wait (after unlock ${unlockDelay}ms)`);
          await new Promise(resolve => setTimeout(resolve, unlockDelay));
        }
        
        logBuilderTestStep('activate');
        await client.activateClass({
          className: config.className
        });
        
        const activateDelay = getOperationDelay('activate', testCase);
        if (activateDelay > 0) {
          logBuilderTestStep(`wait (after activate ${activateDelay}ms)`);
          await new Promise(resolve => setTimeout(resolve, activateDelay));
        }
        
        logBuilderTestStep('check(active)');
        const checkResult3 = await client.checkClass({ className: config.className }, 'active');
        expect(checkResult3?.status).toBeDefined();

        expect(client.getCreateResult()).toBeDefined();
        expect(client.getUpdateResult()).toBeDefined();
        expect(client.getActivateResult()).toBeDefined();

        logBuilderTestSuccess(testsLogger, 'BehaviorImplementationBuilder - full workflow');
      } catch (error: any) {
        logBuilderTestError(testsLogger, 'BehaviorImplementationBuilder - full workflow', error);
        throw error;
      } finally {
        // Cleanup: delete behavior implementation class
        if (className) {
          try {
            logBuilderTestStep('delete (cleanup)');
            await client.deleteClass({
              className: className,
              transportRequest: testCase?.params?.transport_request || getEnvironmentConfig().default_transport || ''
            });
            testsLogger.info?.('Behavior implementation class deleted successfully during cleanup');
          } catch (deleteError: any) {
            testsLogger.warn?.('Failed to delete behavior implementation class during cleanup:', deleteError.message || deleteError);
          }
        }
        logBuilderTestEnd(testsLogger, 'BehaviorImplementationBuilder - full workflow');
      }
    });
  });
});


/**
 * Integration test for TableBuilder
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - TableBuilder library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=table/TableBuilder
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { AdtClient } from '../../../clients/AdtClient';
import { IAdtLogger } from '../../../utils/logger';
import { getTable } from '../../../core/table/read';
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
import { hasCheckErrorsFromResponse, getCheckErrorMessages } from '../../helpers/checkResultHelper';
import { parseCheckRunResponse } from '../../../utils/checkRun';
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
  retryCheckAfterActivate,
  getEnvironmentConfig
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

describe('TableBuilder (using AdtClient)', () => {
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
   * Pre-check: Verify test table doesn't exist
   * Safety: Skip test if object exists to avoid accidental deletion
   */
  async function ensureTableReady(tableName: string): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: true };
    }

    // Check if table exists
    try {
      await getTable(connection, tableName);
      return {
        success: false,
        reason: `⚠️ SAFETY: Table ${tableName} already exists! ` +
                `Delete manually or use different test name to avoid accidental deletion.`
      };
    } catch (error: any) {
      // 404 is expected - object doesn't exist, we can proceed
      if (error.response?.status !== 404) {
        return {
          success: false,
          reason: `Cannot verify table existence: ${error.message}`
        };
      }
    }

    return { success: true };
  }

  function getBuilderTestDefinition() {
    return getTestCaseDefinition('create_table', 'adt_table');
  }

  function buildBuilderConfig(testCase: any) {
    const params = testCase?.params || {};
    const packageName = resolvePackageName(params.package_name);
    if (!packageName) {
      throw new Error('package_name not configured for TableBuilder test');
    }
    return {
      tableName: params.table_name,
      packageName,
      transportRequest: resolveTransportRequest(params.transport_request),
      description: params.description,
      ddlCode: params.ddl_code
    };
  }

  describe('Full workflow', () => {
    let testCase: any = null;
    let tableName: string | null = null;
    let skipReason: string | null = null;

    beforeEach(async () => {
      skipReason = null;
      testCase = null;
      tableName = null;

      if (!hasConfig) {
        skipReason = 'No SAP configuration';
        return;
      }

      const definition = getBuilderTestDefinition();
      if (!definition) {
        skipReason = 'Test case not defined in test-config.yaml';
        return;
      }

      const tc = getEnabledTestCase('create_table', 'adt_table');
      if (!tc) {
        skipReason = 'Test case disabled or not found';
        return;
      }

      const packageCheck = ensurePackageConfig(tc.params, 'Table - full workflow');
      if (!packageCheck.success) {
        skipReason = packageCheck.reason || 'Default package is not configured';
        return;
      }

      testCase = tc;
      tableName = tc.params.table_name;

      // Cleanup before test
      if (tableName) {
        const cleanup = await ensureTableReady(tableName);
        if (!cleanup.success) {
          skipReason = cleanup.reason || 'Failed to cleanup table before test';
          testCase = null;
          tableName = null;
        }
      }
    });

    it('should execute full workflow and store all results', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(testsLogger, 'Table - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(testsLogger, 'Table - full workflow', skipReason);
        return;
      }

      if (!testCase || !tableName) {
        logBuilderTestSkip(
          builderLogger,
          'Table - full workflow',
          skipReason || 'Test case not available'
        );
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

      logBuilderTestStep('validate');
      const validationState = await client.getTable().validate({
        tableName: config.tableName,
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
      
      let tableCreated = false;
      let currentStep = '';
      
      try {
          currentStep = 'create';
          logBuilderTestStep(currentStep);
          // Use updated_ddl_code if available, otherwise use ddlCode
          const updatedDdlCode = testCase.params.updated_ddl_code || config.ddlCode || '';
          await client.getTable().create({
            tableName: config.tableName,
            packageName: config.packageName!,
            description: config.description || '',
            ddlCode: config.ddlCode || '',
            transportRequest: config.transportRequest
          }, { activateOnCreate: false, sourceCode: updatedDdlCode });
          tableCreated = true;
          await new Promise(resolve => setTimeout(resolve, getOperationDelay('create', testCase)));
          
          currentStep = 'check before update';
          logBuilderTestStep(currentStep);
          const checkBeforeUpdateState = await client.getTable().check({ 
            tableName: config.tableName,
            ddlCode: updatedDdlCode
          }, 'inactive');
          const checkBeforeUpdate = checkBeforeUpdateState?.checkResult;
          // Check only for type E messages - HTTP 200 is normal, errors are in XML response
          const hasErrorsBeforeUpdate = hasCheckErrorsFromResponse(checkBeforeUpdate);
          if (hasErrorsBeforeUpdate) {
            const errorMessages = checkBeforeUpdate ? getCheckErrorMessages(parseCheckRunResponse(checkBeforeUpdate)) : [];
            throw new Error(`Check before update failed: ${errorMessages.join('; ')}`);
          }
          
          currentStep = 'update';
          logBuilderTestStep(currentStep);
          await client.getTable().update({
            tableName: config.tableName
          }, { sourceCode: updatedDdlCode });
          await new Promise(resolve => setTimeout(resolve, getOperationDelay('update', testCase)));
        
          // Check with new code (before unlock) - validates unsaved code
          currentStep = 'check(new_code)';
          logBuilderTestStep(currentStep);
          const checkResultNewCodeState = await client.getTable().check({ 
            tableName: config.tableName,
            ddlCode: updatedDdlCode
          }, 'inactive');
          const checkResultNewCode = checkResultNewCodeState?.checkResult;
          // Check only for type E messages - HTTP 200 is normal, errors are in XML response
          const hasErrorsNewCode = hasCheckErrorsFromResponse(checkResultNewCode);
          if (hasErrorsNewCode) {
            const errorMessages = checkResultNewCode ? getCheckErrorMessages(parseCheckRunResponse(checkResultNewCode)) : [];
            throw new Error(`Check with new code failed: ${errorMessages.join('; ')}`);
          }
          testsLogger.info?.(`✅ Check with new code completed: OK`);
          
          currentStep = 'check(inactive)';
          logBuilderTestStep(currentStep);
          const checkResultInactiveState = await client.getTable().check({ tableName: config.tableName }, 'inactive');
          const checkResultInactive = checkResultInactiveState?.checkResult;
          // Check only for type E messages - HTTP 200 is normal, errors are in XML response
          const hasErrorsInactive = hasCheckErrorsFromResponse(checkResultInactive);
          if (hasErrorsInactive) {
            const errorMessages = checkResultInactive ? getCheckErrorMessages(parseCheckRunResponse(checkResultInactive)) : [];
            throw new Error(`Check inactive failed: ${errorMessages.join('; ')}`);
          }
          
          currentStep = 'activate';
          logBuilderTestStep(currentStep);
          await client.getTable().activate({ tableName: config.tableName });
          // Wait for activation to complete (activation is asynchronous)
          await new Promise(resolve => setTimeout(resolve, getOperationDelay('activate', testCase) || 2000));
          
          currentStep = 'check(active)';
          logBuilderTestStep(currentStep);
          // Retry check for active version - activation may take time
          const checkResultActiveState = await retryCheckAfterActivate(
            async () => {
              const state = await client.getTable().check({ tableName: config.tableName }, 'active');
              return state?.checkResult;
            },
            {
              maxAttempts: 5,
              delay: 1000,
              logger: testsLogger,
              objectName: config.tableName
            }
          );
          // Check only for type E messages - HTTP 200 is normal, errors are in XML response
          const hasErrorsActive = checkResultActiveState ? hasCheckErrorsFromResponse(checkResultActiveState) : false;
          if (hasErrorsActive) {
            const errorMessages = checkResultActiveState ? getCheckErrorMessages(parseCheckRunResponse(checkResultActiveState)) : [];
            throw new Error(`Check active failed: ${errorMessages.join('; ')}`);
          }
          
          if (shouldCleanup) {
            currentStep = 'delete (cleanup)';
            logBuilderTestStep(currentStep);
            await client.getTable().delete({
              tableName: config.tableName,
              transportRequest: config.transportRequest
            });
          } else {
            testsLogger.info?.(`⚠️ Cleanup skipped (cleanup_after_test=${cleanupAfterTest}, skip_cleanup=${skipCleanup}) - table left for analysis: ${config.tableName}`);
          }

          logBuilderTestSuccess(testsLogger, 'Table - full workflow');
        } catch (error: any) {
          // Log step error with details before failing test
          logBuilderTestStepError(currentStep || 'unknown', error);
          
          // Cleanup: delete if object was created and cleanup is enabled
          if (shouldCleanup && tableCreated) {
            try {
              logBuilderTestStep('delete (cleanup)');
              await client.getTable().delete({
                tableName: config.tableName,
                transportRequest: config.transportRequest
              });
            } catch (cleanupError) {
              // Log cleanup error but don't fail test - original error is more important
              testsLogger.warn?.(`Cleanup failed for ${config.tableName}:`, cleanupError);
            }
          } else if (!shouldCleanup && tableCreated) {
            testsLogger.info?.(`⚠️ Cleanup skipped (cleanup_after_test=${cleanupAfterTest}, skip_cleanup=${skipCleanup}) - table left for analysis: ${config.tableName}`);
          }
          
          const statusText = getHttpStatusText(error);
          const enhancedError = statusText !== 'HTTP ?'
            ? Object.assign(new Error(`[${statusText}] ${error.message}`), { stack: error.stack })
            : error;
          logBuilderTestError(testsLogger, 'Table - full workflow', enhancedError);
          throw enhancedError;
      } finally {
        logBuilderTestEnd(testsLogger, 'Table - full workflow');
      }
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP table', async () => {
      const testCase = getTestCaseDefinition('create_table', 'adt_table');
      const standardObject = resolveStandardObject('table', isCloudSystem, testCase);

      if (!standardObject) {
        logBuilderTestStart(testsLogger, 'TableBuilder - read standard object', {
          name: 'read_standard',
          params: {}
        });
        logBuilderTestSkip(testsLogger, 'TableBuilder - read standard object',
          `Standard table not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`);
        return;
      }

      const standardTableName = standardObject.name;
      logBuilderTestStart(testsLogger, 'TableBuilder - read standard object', {
        name: 'read_standard',
        params: { table_name: standardTableName }
      });

      if (!hasConfig) {
        logBuilderTestSkip(testsLogger, 'TableBuilder - read standard object', 'No SAP configuration');
        return;
      }

      try {
        logBuilderTestStep('read');
        const resultState = await client.getTable().read({ tableName: standardTableName });
        expect(resultState).toBeDefined();
        expect(resultState?.readResult).toBeDefined();
        // Table read returns table config - check if tableName is present
        const tableConfig = resultState?.readResult;
        if (tableConfig && typeof tableConfig === 'object' && 'tableName' in tableConfig) {
          expect((tableConfig as any).tableName).toBe(standardTableName);
        }

        logBuilderTestSuccess(testsLogger, 'TableBuilder - read standard object');
      } catch (error) {
        logBuilderTestError(testsLogger, 'TableBuilder - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'TableBuilder - read standard object');
      }
    }, getTimeout('test'));
  });
});

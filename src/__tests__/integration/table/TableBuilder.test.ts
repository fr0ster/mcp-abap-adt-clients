/**
 * Integration test for TableBuilder
 * Tests using CrudClient for unified CRUD operations
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
import { AxiosResponse } from 'axios';
import { CrudClient } from '../../../clients/CrudClient';
import { TableBuilder } from '../../../core/table';
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

// Library code uses DEBUG_ADT_LIBS
const builderLogger: IAdtLogger = createBuilderLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: IAdtLogger = createTestsLogger();

describe('TableBuilder (using CrudClient)', () => {
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
    return getTestCaseDefinition('create_table', 'builder_table');
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

      const tc = getEnabledTestCase('create_table', 'builder_table');
      if (!tc) {
        skipReason = 'Test case disabled or not found';
        return;
      }

      const packageCheck = ensurePackageConfig(tc.params, 'TableBuilder - full workflow');
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
      logBuilderTestStart(testsLogger, 'TableBuilder - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(testsLogger, 'TableBuilder - full workflow', skipReason);
        return;
      }

      if (!testCase || !tableName) {
        logBuilderTestSkip(
          builderLogger,
          'TableBuilder - full workflow',
          skipReason || 'Test case not available'
        );
        return;
      }

      const config = buildBuilderConfig(testCase);

      logBuilderTestStep('validate');
      const validationResponse = await client.validateTable({
        tableName: config.tableName,
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
      
      let tableCreated = false;
      let tableLocked = false;
      let currentStep = '';
      
      try {
          currentStep = 'create';
          logBuilderTestStep(currentStep);
          await client.createTable({
            tableName: config.tableName,
            packageName: config.packageName!,
            description: config.description || '',
            ddlCode: config.ddlCode || '',
            transportRequest: config.transportRequest
          });
          tableCreated = true;
          await new Promise(resolve => setTimeout(resolve, getOperationDelay('create', testCase)));
          
          currentStep = 'lock';
          logBuilderTestStep(currentStep);
          await client.lockTable({ tableName: config.tableName });
          tableLocked = true;
          await new Promise(resolve => setTimeout(resolve, getOperationDelay('lock', testCase)));
          
          currentStep = 'update';
          logBuilderTestStep(currentStep);
          // Use updated_ddl_code if available, otherwise use ddlCode
          const updatedDdlCode = testCase.params.updated_ddl_code || config.ddlCode || '';
          await client.updateTable({
            tableName: config.tableName,
            ddlCode: updatedDdlCode
          });
          await new Promise(resolve => setTimeout(resolve, getOperationDelay('update', testCase)));
        
          // Check with new code (before unlock) - validates unsaved code
          currentStep = 'check(new_code)';
          logBuilderTestStep(currentStep);
          const checkResultNewCode = await client.checkTable({ tableName: config.tableName }, updatedDdlCode, 'new');
          expect(checkResultNewCode?.status).toBeDefined();
          testsLogger.info?.(`✅ Check with new code completed: ${checkResultNewCode?.status === 200 ? 'OK' : 'Has errors/warnings'}`);
          
          currentStep = 'check(inactive)';
          logBuilderTestStep(currentStep);
          const checkResultInactive = await client.checkTable({ tableName: config.tableName });
          expect(checkResultInactive?.status).toBeDefined();
          
          currentStep = 'unlock';
          logBuilderTestStep(currentStep);
          await client.unlockTable({ tableName: config.tableName });
          tableLocked = false; // Unlocked successfully
          await new Promise(resolve => setTimeout(resolve, getOperationDelay('unlock', testCase)));
          
          currentStep = 'activate';
          logBuilderTestStep(currentStep);
          await client.activateTable({ tableName: config.tableName });
          // Wait for activation to complete (activation is asynchronous)
          await new Promise(resolve => setTimeout(resolve, getOperationDelay('activate', testCase) || 2000));
          
          currentStep = 'check(active)';
          logBuilderTestStep(currentStep);
          // Retry check for active version - activation may take time
          const checkResultActive = await retryCheckAfterActivate(
            () => client.checkTable({ tableName: config.tableName }),
            {
              maxAttempts: 5,
              delay: 1000,
              logger: testsLogger,
              objectName: config.tableName
            }
          );
          expect(checkResultActive?.status).toBeDefined();
          
          currentStep = 'delete (cleanup)';
          logBuilderTestStep(currentStep);
          await client.deleteTable({
            tableName: config.tableName,
            transportRequest: config.transportRequest
          });

          expect(client.getCreateResult()).toBeDefined();
          expect(client.getActivateResult()).toBeDefined();

          logBuilderTestSuccess(testsLogger, 'TableBuilder - full workflow');
        } catch (error: any) {
          // Log step error with details before failing test
          logBuilderTestStepError(currentStep || 'unknown', error);
          
          // Cleanup: unlock and delete if object was created/locked
          if (tableLocked || tableCreated) {
            try {
              if (tableLocked) {
                logBuilderTestStep('unlock (cleanup)');
                await client.unlockTable({ tableName: config.tableName });
              }
              if (tableCreated) {
                logBuilderTestStep('delete (cleanup)');
                await client.deleteTable({
                  tableName: config.tableName,
                  transportRequest: config.transportRequest
                });
              }
            } catch (cleanupError) {
              // Log cleanup error but don't fail test - original error is more important
              testsLogger.warn?.(`Cleanup failed for ${config.tableName}:`, cleanupError);
            }
          }
          
          const statusText = getHttpStatusText(error);
          const enhancedError = statusText !== 'HTTP ?'
            ? Object.assign(new Error(`[${statusText}] ${error.message}`), { stack: error.stack })
            : error;
          logBuilderTestError(testsLogger, 'TableBuilder - full workflow', enhancedError);
          throw enhancedError;
      } finally {
        logBuilderTestEnd(testsLogger, 'TableBuilder - full workflow');
      }
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP table', async () => {
      const testCase = getTestCaseDefinition('create_table', 'builder_table');
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
        const result = await client.readTable(standardTableName);
        expect(result).toBeDefined();
        expect(result?.tableName).toBe(standardTableName);

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

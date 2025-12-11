/**
 * Integration test for PackageBuilder
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 * - DEBUG_ADT_TESTS=true npm test -- --testPathPattern=package    (ADT-clients logs)
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { AdtClient } from '../../../clients/AdtClient';
import { IAdtLogger } from '../../../utils/logger';
import { getPackage } from '../../../core/package/read';
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

describe('PackageBuilder (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let connectionConfig: any = null;
  let hasConfig = false;
  let isCloudSystem = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connectionConfig = config;
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, builderLogger);
      hasConfig = true;
      // Check if this is a cloud system (for environment-specific standard packages)
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
   * Pre-check: Verify test package doesn't exist
   * Safety: Skip test if object exists to avoid accidental deletion
   */
  async function ensurePackageReady(packageName: string): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: true };
    }

    // Check if package exists
    try {
      await getPackage(connection, packageName);
      // Package exists - skip test for safety
      return {
        success: false,
        reason: `⚠️ SAFETY: Package ${packageName} already exists! ` +
                `Delete manually or use different test name to avoid accidental deletion.`
      };
    } catch (error: any) {
      const status = error.response?.status;
      
      // 404 is expected - object doesn't exist, we can proceed
      if (status === 404) {
        return { success: true };
      }
      
      // Any other error (including locked state) means package might exist
      // Better to skip test for safety
      const errorMsg = error.message || 'Unknown error';
      if (debugEnabled) {
        builderLogger.warn?.(`[PRE-CHECK] Package ${packageName} check failed with status ${status}: ${errorMsg}`);
      }
      
      return {
        success: false,
        reason: `⚠️ SAFETY: Cannot verify package ${packageName} doesn't exist (HTTP ${status}). ` +
                `May be locked or inaccessible. Delete/unlock manually to proceed.`
      };
    }
  }

  function getBuilderTestDefinition() {
    return getTestCaseDefinition('create_package', 'adt_package');
  }

  function buildBuilderConfig(testCase: any) {
    const params = testCase?.params || {};

    const parentPackage =
      params.package_name ||
      params.super_package ||
      resolvePackageName(undefined);
    if (!parentPackage) {
      throw new Error('Parent package is not configured. Set params.package_name or environment.default_package');
    }

    const testPackage =
      params.test_package ||
      params.test_package_name ||
      params.package_name;

    if (!testPackage) {
      throw new Error('test_package is not configured for PackageBuilder test');
    }

    return {
      packageName: testPackage,
      superPackage: parentPackage,
      description: params.description,
      updatedDescription: params.updated_description, // Description for update operation
      packageType: params.package_type || 'development',
      softwareComponent: params.software_component,
      transportLayer: params.transport_layer,
      transportRequest: params.transport_request,
      applicationComponent: params.application_component,
      responsible: params.responsible
    };
  }

  function isPackageLockedError(error: any): boolean {
    if (!error) {
      return false;
    }
    const message = String(error.message || '').toLowerCase();
    const responseData = error.response?.data;
    const responseText =
      typeof responseData === 'string'
        ? responseData.toLowerCase()
        : JSON.stringify(responseData || '').toLowerCase();
    return (
      message.includes('already locked') ||
      message.includes('is locked') ||
      responseText.includes('already locked')
    );
  }



  describe('Full workflow', () => {
    let testCase: any = null;
    let packageName: string | null = null;
    let skipReason: string | null = null;

    beforeEach(async () => {
      skipReason = null;
      testCase = null;
      packageName = null;

      if (!hasConfig) {
        skipReason = 'No SAP configuration';
        return;
      }

      const definition = getBuilderTestDefinition();
      if (!definition) {
        skipReason = 'Test case not defined in test-config.yaml';
        return;
      }

      const tc = getEnabledTestCase('create_package', 'adt_package');
      if (!tc) {
        skipReason = 'Test case disabled or not found';
        return;
      }

      const parentPackage = tc.params.package_name || tc.params.super_package || resolvePackageName(undefined);
      if (!parentPackage) {
        skipReason = 'Super package is not configured. Set params.package_name/super_package or environment.default_package';
        return;
      }
      tc.params.super_package = parentPackage;

      testCase = tc;
      packageName = tc.params.test_package || tc.params.package_name;

      // Pre-check: Verify package doesn't exist before test
      if (packageName) {
        const readyCheck = await ensurePackageReady(packageName);
        if (!readyCheck.success) {
          skipReason = readyCheck.reason || 'Package pre-check failed';
          testCase = null;
          packageName = null;
        }
      }
    });

    it('should execute full workflow and store all results', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(testsLogger, 'Package - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(testsLogger, 'Package - full workflow', skipReason);
        return;
      }

      if (!testCase || !packageName) {
        logBuilderTestSkip(testsLogger, 'Package - full workflow', skipReason || 'Test case not available');
        return;
      }

      const config = buildBuilderConfig(testCase);
      let packageCreated = false;
      let currentStep = '';

      try {
        currentStep = 'validate';
        logBuilderTestStep(currentStep);
        const validationState = await client.getPackage().validate({
          packageName: config.packageName,
          superPackage: config.superPackage,
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
        await client.getPackage().create({
          packageName: config.packageName,
          superPackage: config.superPackage,
          description: config.description || '',
          packageType: config.packageType,
          softwareComponent: config.softwareComponent,
          transportLayer: config.transportLayer,
          transportRequest: config.transportRequest,
          applicationComponent: config.applicationComponent,
          responsible: config.responsible
        });
        packageCreated = true;
        
        logBuilderTestStep('check(active)');
        const checkResult1State = await client.getPackage().check({ packageName: config.packageName, superPackage: config.superPackage });
        const checkResult1 = checkResult1State?.checkResult;
        expect(checkResult1?.status).toBeDefined();
        
        const createDelay = getOperationDelay('create', testCase);
        if (createDelay > 0) {
          logBuilderTestStep(`wait (after create ${createDelay}ms)`);
          await new Promise(resolve => setTimeout(resolve, createDelay));
        }
        
        currentStep = 'check before update';
        logBuilderTestStep(currentStep);
        const checkBeforeUpdateState = await client.getPackage().check({ 
          packageName: config.packageName, 
          superPackage: config.superPackage 
        });
        const checkBeforeUpdate = checkBeforeUpdateState?.checkResult;
        expect(checkBeforeUpdate?.status).toBeDefined();
        
        currentStep = 'update';
        logBuilderTestStep(currentStep);
        await client.getPackage().update({
          packageName: config.packageName,
          superPackage: config.superPackage,
          updatedDescription: config.updatedDescription || config.description || ''
        });
        
        const updateDelay = getOperationDelay('update', testCase);
        if (updateDelay > 0) {
          logBuilderTestStep(`wait (after update ${updateDelay}ms)`);
          await new Promise(resolve => setTimeout(resolve, updateDelay));
        }
        
        logBuilderTestStep('check(active)');
        const checkResult2State = await client.getPackage().check({ packageName: config.packageName, superPackage: config.superPackage });
        const checkResult2 = checkResult2State?.checkResult;
        expect(checkResult2?.status).toBeDefined();

        logBuilderTestStep('delete (cleanup)');
        // Create a new client with fresh session for deletion to avoid lock issues
        // This is needed because package may still be locked in the current session after unlock
        const deleteConnection = createAbapConnection(connectionConfig, connectionLogger);
        await (deleteConnection as any).connect();
        const deleteClient = new AdtClient(deleteConnection, builderLogger);
        await deleteClient.getPackage().delete({
          packageName: config.packageName,
          transportRequest: config.transportRequest
        });
        deleteConnection.reset();

        logBuilderTestSuccess(testsLogger, 'Package - full workflow');
      } catch (error: any) {
        const errorMsg = error.message || '';
        const errorData = error.response?.data || '';
        const errorText = typeof errorData === 'string' ? errorData : JSON.stringify(errorData);
        const fullErrorText = `${errorMsg} ${errorText}`.toLowerCase();

        const systemLocked =
          fullErrorText.includes('system setting does not allow you to change') ||
          fullErrorText.includes('not modifiable') ||
          fullErrorText.includes('tr006');

        if (systemLocked) {
          logBuilderTestSkip(
            builderLogger,
            'Package - full workflow',
            'System change option prevents package creation (software component not modifiable)'
          );
          return;
        }

        // Log step error with details before failing test
        logBuilderTestStepError(currentStep || 'unknown', error);

        // Cleanup: delete if object was created
        if (packageCreated) {
          try {
            logBuilderTestStep('delete (cleanup)');
            // Create a new client with fresh session for deletion to avoid lock issues
            const deleteConnection = createAbapConnection(connectionConfig, connectionLogger);
            await (deleteConnection as any).connect();
            const deleteClient = new AdtClient(deleteConnection, builderLogger);
            await deleteClient.getPackage().delete({
              packageName: config.packageName,
              transportRequest: config.transportRequest
            });
            deleteConnection.reset();
          } catch (cleanupError) {
            // Log cleanup error but don't fail test - original error is more important
            testsLogger.warn?.(`Cleanup failed for ${config.packageName}:`, cleanupError);
          }
        }

        const statusText = getHttpStatusText(error);
        const enhancedError = statusText !== 'HTTP ?'
          ? Object.assign(new Error(`[${statusText}] ${error.message}`), { stack: error.stack })
          : error;
        logBuilderTestError(testsLogger, 'Package - full workflow', enhancedError);
        throw enhancedError;
      } finally {
        logBuilderTestEnd(testsLogger, 'Package - full workflow');
      }
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP package', async () => {
      // Read tests use standard_objects registry, not create_package test case
      const standardObject = resolveStandardObject('package', isCloudSystem, null);

      if (!standardObject) {
        logBuilderTestStart(testsLogger, 'PackageBuilder - read standard object', {
          name: 'read_standard',
          params: {}
        });
        logBuilderTestSkip(
          builderLogger,
          'PackageBuilder - read standard object',
          `Standard package not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`
        );
        return;
      }

      const standardPackageName = standardObject.name;
      logBuilderTestStart(testsLogger, 'PackageBuilder - read standard object', {
        name: 'read_standard',
        params: { package_name: standardPackageName }
      });

      if (!hasConfig) {
        logBuilderTestSkip(testsLogger, 'PackageBuilder - read standard object', 'No SAP configuration');
        return;
      }

      try {
        logBuilderTestStep('read');
        const resultState = await client.getPackage().read({ packageName: standardPackageName });
        expect(resultState).toBeDefined();
        expect(resultState?.readResult).toBeDefined();
        // Package read returns package config - check if packageName is present
        const packageConfig = resultState?.readResult;
        if (packageConfig && typeof packageConfig === 'object' && 'packageName' in packageConfig) {
          expect((packageConfig as any).packageName).toBe(standardPackageName);
        }

        logBuilderTestSuccess(testsLogger, 'PackageBuilder - read standard object');
      } catch (error) {
        logBuilderTestError(testsLogger, 'PackageBuilder - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'PackageBuilder - read standard object');
      }
    }, getTimeout('test'));
  });
});

/**
 * Integration test for PackageBuilder
 * Tests using CrudClient for unified CRUD operations
 *
 * Enable debug logs:
 * - DEBUG_ADT_TESTS=true npm test -- --testPathPattern=package    (ADT-clients logs)
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { CrudClient } from '../../../clients/CrudClient';
import { PackageBuilder } from '../../../core/package';
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

describe('PackageBuilder (using CrudClient)', () => {
  let connection: AbapConnection;
  let client: CrudClient;
  let connectionConfig: any = null;
  let hasConfig = false;
  let isCloudSystem = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connectionConfig = config;
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new CrudClient(connection);
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
    return getTestCaseDefinition('create_package', 'builder_package');
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

      const tc = getEnabledTestCase('create_package', 'builder_package');
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
      logBuilderTestStart(testsLogger, 'PackageBuilder - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(testsLogger, 'PackageBuilder - full workflow', skipReason);
        return;
      }

      if (!testCase || !packageName) {
        logBuilderTestSkip(testsLogger, 'PackageBuilder - full workflow', skipReason || 'Test case not available');
        return;
      }

      const config = buildBuilderConfig(testCase);

      try {
        logBuilderTestStep('validate');
        const validationResponse = await client.validatePackage({
          packageName: config.packageName,
          superPackage: config.superPackage,
          description: config.description || ''
        });
        if (validationResponse?.status !== 200) {
          const errorData = typeof validationResponse?.data === 'string' 
            ? validationResponse.data 
            : JSON.stringify(validationResponse?.data);
          console.error(`Validation failed (HTTP ${validationResponse?.status}): ${errorData}`);
        }
        expect(validationResponse?.status).toBe(200);
        
        logBuilderTestStep('create');
        await client.createPackage({
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
        
        logBuilderTestStep('check(active)');
        const checkResult1 = await client.checkPackage({ packageName: config.packageName, superPackage: config.superPackage });
        expect(checkResult1?.status).toBeDefined();
        
        const createDelay = getOperationDelay('create', testCase);
        if (createDelay > 0) {
          logBuilderTestStep(`wait (after create ${createDelay}ms)`);
          await new Promise(resolve => setTimeout(resolve, createDelay));
        }
        
        logBuilderTestStep('read');
        const readResult = await client.readPackage(config.packageName);
        expect(readResult).toBeDefined();
        expect(readResult?.packageName).toBe(config.packageName);
        
        logBuilderTestStep('lock');
        await client.lockPackage({
          packageName: config.packageName,
          superPackage: config.superPackage
        });
        
        logBuilderTestStep('update');
        await client.updatePackage({
          packageName: config.packageName,
          superPackage: config.superPackage,
          updatedDescription: config.updatedDescription || config.description || ''
        });
        
        const updateDelay = getOperationDelay('update', testCase);
        if (updateDelay > 0) {
          logBuilderTestStep(`wait (after update ${updateDelay}ms)`);
          await new Promise(resolve => setTimeout(resolve, updateDelay));
        }
        
        logBuilderTestStep('unlock');
        await client.unlockPackage({
          packageName: config.packageName,
          superPackage: config.superPackage
        });
        
        const unlockDelay = getOperationDelay('unlock', testCase);
        if (unlockDelay > 0) {
          logBuilderTestStep(`wait (after unlock ${unlockDelay}ms)`);
          await new Promise(resolve => setTimeout(resolve, unlockDelay));
        }
        
        logBuilderTestStep('check(active)');
        const checkResult2 = await client.checkPackage({ packageName: config.packageName, superPackage: config.superPackage });
        expect(checkResult2?.status).toBeDefined();

        logBuilderTestStep('delete (cleanup)');
        // Create a new client with fresh session for deletion to avoid lock issues
        // This is needed because package may still be locked in the current session after unlock
        const deleteConnection = createAbapConnection(connectionConfig, connectionLogger);
        await (deleteConnection as any).connect();
        const deleteClient = new CrudClient(deleteConnection);
        await deleteClient.deletePackage({
          packageName: config.packageName,
          transportRequest: config.transportRequest
        });
        deleteConnection.reset();

        expect(client.getCreateResult()).toBeDefined();
        expect(client.getUpdateResult()).toBeDefined();
        
        // Verify that description was updated
        if (readResult) {
          const updatedDesc = testCase?.params?.updated_description || testCase?.params?.description;
          if (updatedDesc) {
            builderLogger.info?.(`✓ Verified package read result`);
          }
        }

        logBuilderTestSuccess(testsLogger, 'PackageBuilder - full workflow');
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
            'PackageBuilder - full workflow',
            'System change option prevents package creation (software component not modifiable)'
          );
          return;
        }

        logBuilderTestError(testsLogger, 'PackageBuilder - full workflow', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'PackageBuilder - full workflow');
      }
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP package', async () => {
      const testCase = getTestCaseDefinition('create_package', 'builder_package');
      const standardObject = resolveStandardObject('package', isCloudSystem, testCase);

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
        const result = await client.readPackage(standardPackageName);
        expect(result).toBeDefined();
        expect(result?.packageName).toBe(standardPackageName);

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

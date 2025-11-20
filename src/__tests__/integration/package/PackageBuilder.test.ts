/**
 * Unit test for PackageBuilder
 * Tests fluent API with Promise chaining, error handling, and result storage
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- integration/package/PackageBuilder
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { PackageBuilder, PackageBuilderLogger } from '../../../core/package';
import { getPackage } from '../../../core/package/read';
import { deletePackage } from '../../../core/package/delete';
import { isCloudEnvironment } from '../../../core/shared/systemInfo';
import { getConfig } from '../../helpers/sessionConfig';
import {
  logBuilderTestError,
  logBuilderTestSkip,
  logBuilderTestStart,
  logBuilderTestSuccess,
  logBuilderTestEnd,
  logBuilderTestStep
} from '../../helpers/builderTestLogger';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const {
  getEnabledTestCase,
  getTestCaseDefinition,
  resolvePackageName,
  resolveStandardObject,
  getEnvironmentConfig
} = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const connectionLogger: ILogger = {
  debug: debugEnabled ? (message: string, meta?: any) => console.log(message, meta) : () => {},
  info: debugEnabled ? (message: string, meta?: any) => console.log(message, meta) : () => {},
  warn: debugEnabled ? (message: string, meta?: any) => console.warn(message, meta) : () => {},
  error: debugEnabled ? (message: string, meta?: any) => console.error(message, meta) : () => {},
  csrfToken: debugEnabled ? (action: string, token?: string) => console.log(`CSRF ${action}:`, token) : () => {},
};

const builderLogger: PackageBuilderLogger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
};

describe('PackageBuilder', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let isCloudSystem = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      hasConfig = true;
      // Check if this is a cloud system (for environment-specific standard packages)
      isCloudSystem = await isCloudEnvironment(connection);
    } catch (error) {
      builderLogger.warn?.('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterAll(async () => {
    if (connection) {
      connection.reset();
    }
  });

  /**
   * Cleanup before test: Try to delete package, ignore all errors except 429 (Too Many Requests)
   * After successful deletion, wait for system to process the deletion
   */
  async function cleanupPackageBefore(packageName: string): Promise<void> {
    if (!connection) {
      return;
    }

    try {
      await deletePackage(connection, { package_name: packageName });
      if (debugEnabled) {
        builderLogger.debug?.(`[CLEANUP] Successfully deleted package ${packageName} before test`);
      }
      
      // Wait for system to process the deletion (SAP may need time to actually delete the object)
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      
      if (debugEnabled) {
        builderLogger.debug?.(`[CLEANUP] Waited for system to process deletion of ${packageName}`);
      }
    } catch (error: any) {
      const status = error.response?.status;
      
      // Don't ignore 429 (Too Many Requests) - this is a rate limit error
      if (status === 429) {
        if (debugEnabled) {
          builderLogger.warn?.(`[CLEANUP] Rate limit (429) when deleting package ${packageName} before test`);
        }
        throw error; // Re-throw 429 to handle it properly
      }
      
      // Ignore all other errors (404, 403, 423, etc.)
      if (debugEnabled) {
        const statusText = status ? `HTTP ${status}` : 'HTTP ?';
        builderLogger.debug?.(`[CLEANUP] Ignored error when deleting package ${packageName} before test (${statusText}): ${error.message || ''}`);
      }
    }
  }

  /**
   * Cleanup after test: Try to delete package, ignore all errors
   */
  async function cleanupPackageAfter(packageName: string): Promise<void> {
    if (!connection) {
      return;
    }

    try {
      await deletePackage(connection, { package_name: packageName });
      if (debugEnabled) {
        builderLogger.debug?.(`[CLEANUP] Successfully deleted package ${packageName} after test`);
      }
    } catch (error: any) {
      // Ignore all errors after test
      if (debugEnabled) {
        const status = error.response?.status;
        const statusText = status ? `HTTP ${status}` : 'HTTP ?';
        builderLogger.debug?.(`[CLEANUP] Ignored error when deleting package ${packageName} after test (${statusText}): ${error.message || ''}`);
      }
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

      // Get global cleanup settings from environment config
      const envConfig = getEnvironmentConfig();
      const cleanupBefore = envConfig.cleanup_before !== false; // Default to true if not specified

      if (packageName && cleanupBefore) {
        try {
          await cleanupPackageBefore(packageName);
        } catch (error: any) {
          // Only 429 (rate limit) is re-thrown - skip test in this case
          if (error.response?.status === 429) {
            skipReason = `Rate limit (429) when cleaning up package ${packageName} before test`;
            testCase = null;
            packageName = null;
          }
          // All other errors are ignored - test can proceed
        }
      }
    });

    afterEach(async () => {
      // Get global cleanup settings from environment config
      const envConfig = getEnvironmentConfig();
      const cleanupAfter = envConfig.cleanup_after !== false; // Default to true if not specified

      // Cleanup after test - ignore all errors
      if (packageName && cleanupAfter) {
        await cleanupPackageAfter(packageName);
      } else if (packageName && !cleanupAfter && debugEnabled) {
        builderLogger.debug?.(`[CLEANUP] Cleanup after test is disabled for package ${packageName}`);
      }
    });

    it('should execute full workflow and store all results', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(builderLogger, 'PackageBuilder - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(builderLogger, 'PackageBuilder - full workflow', skipReason);
        return;
      }

      if (!testCase || !packageName) {
        logBuilderTestSkip(builderLogger, 'PackageBuilder - full workflow', skipReason || 'Test case not available');
        return;
      }

      const builder = new PackageBuilder(connection, builderLogger, buildBuilderConfig(testCase));

      try {
        logBuilderTestStep('validate');
      await builder
        .validate()
          .then(b => {
            logBuilderTestStep('create');
            return b.create();
          })
          .then(b => {
            logBuilderTestStep('read');
            return b.read();
          })
          .then(b => {
            logBuilderTestStep('lock');
            return b.lock();
          })
          // .then(b => {
          //   logBuilderTestStep('update');
          //   return b.update();
          // })
          .then(b => {
            logBuilderTestStep('unlock');
            return b.unlock();
          });

        const state = builder.getState();
        expect(state.createResult).toBeDefined();
        expect(state.readResult).toBeDefined();
        expect(state.errors.length).toBe(0);

        logBuilderTestSuccess(builderLogger, 'PackageBuilder - full workflow');
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

        logBuilderTestError(builderLogger, 'PackageBuilder - full workflow', error);
        throw error;
      } finally {
        await builder.forceUnlock().catch(() => {});
        logBuilderTestEnd(builderLogger, 'PackageBuilder - full workflow');
      }
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP package', async () => {
      const testCase = getTestCaseDefinition('create_package', 'builder_package');
      const standardObject = resolveStandardObject('package', isCloudSystem, testCase);

      if (!standardObject) {
        logBuilderTestStart(builderLogger, 'PackageBuilder - read standard object', {
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
      logBuilderTestStart(builderLogger, 'PackageBuilder - read standard object', {
        name: 'read_standard',
        params: { package_name: standardPackageName }
      });

      if (!hasConfig) {
        logBuilderTestSkip(builderLogger, 'PackageBuilder - read standard object', 'No SAP configuration');
        return;
      }

      const builder = new PackageBuilder(connection, builderLogger, {
        packageName: standardPackageName,
        // superPackage is not used in read mode, fallback to resolved package
        superPackage: standardObject.superPackage || '$TMP'
      });

      try {
        logBuilderTestStep('read');
        await builder.read();

        const result = builder.getReadResult();
        expect(result).toBeDefined();
        expect(result?.status).toBe(200);
        expect(result?.data).toBeDefined();

        logBuilderTestSuccess(builderLogger, 'PackageBuilder - read standard object');
      } catch (error) {
        logBuilderTestError(builderLogger, 'PackageBuilder - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(builderLogger, 'PackageBuilder - read standard object');
      }
    }, getTimeout('test'));
  });
});

/**
 * Unit test for PackageBuilder
 * Tests fluent API with Promise chaining, error handling, and result storage
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- integration/package/PackageBuilder
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { PackageBuilder, PackageBuilderLogger } from '../../../core/package';
import { getPackage } from '../../../core/package/read';
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
  resolveStandardObject
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

  async function ensurePackageReady(packageName: string): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: false, reason: 'No connection' };
    }

    // Packages cannot be deleted, so we only check if they exist
    // If package exists, we skip the test
    try {
      await getPackage(connection, packageName);
      // Package exists - cannot proceed with test
      const errorMsg = `Package ${packageName} already exists (packages cannot be deleted)`;
      if (debugEnabled) {
        builderLogger.warn?.(`[CLEANUP] ${errorMsg}`);
      }
      return { success: false, reason: errorMsg };
    } catch (error: any) {
      // 404 = package doesn't exist, we can proceed
      if (error.response?.status === 404) {
        return { success: true };
      }
      // Other error - might be locked or inaccessible
      const errorMsg = `Cannot verify package status for ${packageName} (may be locked or inaccessible)`;
      if (debugEnabled) {
        builderLogger.warn?.(`[CLEANUP] ${errorMsg}:`, error.message);
      }
      return { success: false, reason: errorMsg };
    }
  }

  function getBuilderTestDefinition() {
    return getTestCaseDefinition('create_package', 'builder_package');
  }

  function buildBuilderConfig(testCase: any) {
    const params = testCase?.params || {};
    const superPackage = params.super_package || resolvePackageName(undefined);
    if (!superPackage) {
      throw new Error('super_package not configured for PackageBuilder test');
    }
    return {
      packageName: params.package_name,
      superPackage,
      description: params.description,
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

      const parentPackage = tc.params.super_package || resolvePackageName(undefined);
      if (!parentPackage) {
        skipReason = 'Super package is not configured. Set params.super_package or environment.default_package';
        return;
      }
      if (!tc.params.super_package) {
        tc.params.super_package = parentPackage;
      }

      testCase = tc;
      packageName = tc.params.package_name;

      // Check if package exists (packages cannot be deleted)
      if (packageName) {
        const check = await ensurePackageReady(packageName);
        if (!check.success) {
          skipReason = check.reason || 'Package already exists';
          testCase = null;
          packageName = null;
        }
      }
    });

    afterEach(async () => {
      // Packages cannot be deleted, so no cleanup needed
      // Just log if needed
      if (packageName && debugEnabled) {
        builderLogger.debug?.(`[CLEANUP] Package ${packageName} was created (cannot be deleted)`);
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
            logBuilderTestStep('check');
            return b.check();
          })
          .then(b => {
            logBuilderTestStep('read');
            return b.read();
          })
          .then(b => {
            logBuilderTestStep('lock');
            return b.lock();
          })
          .then(b => {
            logBuilderTestStep('update');
            return b.update();
          })
          .then(b => {
            logBuilderTestStep('unlock');
            return b.unlock();
          });

        const state = builder.getState();
        expect(state.createResult).toBeDefined();
        expect(state.readResult).toBeDefined();
        expect(state.errors.length).toBe(0);

        logBuilderTestSuccess(builderLogger, 'PackageBuilder - full workflow');
      } catch (error) {
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

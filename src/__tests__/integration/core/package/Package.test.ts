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
import { AdtClient } from '../../../../clients/AdtClient';
import { getPackage } from '../../../../core/package/read';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { getConfig } from '../../../helpers/sessionConfig';
import {
  logBuilderTestStart,
  logBuilderTestSkip,
  logBuilderTestSuccess,
  logBuilderTestError,
  logBuilderTestEnd
} from '../../../helpers/builderTestLogger';
import { createConnectionLogger, createBuilderLogger, createTestsLogger } from '../../../helpers/testLogger';
import { BaseTester } from '../../../helpers/BaseTester';
import { IPackageConfig, IPackageState } from '../../../../core/package';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const {
  getTestCaseDefinition,
  resolvePackageName,
  resolveStandardObject,
  getTimeout
} = require('../../../helpers/test-helper');

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

describe('PackageBuilder (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let connectionConfig: any = null;
  let hasConfig = false;
  let isCloudSystem = false;
  let tester: BaseTester<IPackageConfig, IPackageState>;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connectionConfig = config;
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, builderLogger);
      hasConfig = true;
      isCloudSystem = await isCloudEnvironment(connection);

      tester = new BaseTester(
        client.getPackage(),
        'Package',
        'create_package',
        'adt_package',
        testsLogger
      );

      tester.setup({
        connection,
        client,
        hasConfig,
        isCloudSystem,
        buildConfig: (testCase: any) => {
          const params = testCase?.params || {};
          const parentPackage = params.package_name || params.super_package || resolvePackageName(undefined);
          if (!parentPackage) throw new Error('Parent package is not configured');
          const testPackage = params.test_package || params.test_package_name || params.package_name;
          if (!testPackage) throw new Error('test_package is not configured');
          return {
            packageName: testPackage,
            superPackage: parentPackage,
            description: params.description,
            updatedDescription: params.updated_description,
            packageType: params.package_type || 'development',
            softwareComponent: params.software_component,
            transportLayer: params.transport_layer,
            transportRequest: params.transport_request,
            applicationComponent: params.application_component,
            responsible: params.responsible
          };
        },
        ensureObjectReady: async (packageName: string) => {
          if (!connection) return { success: true };
          try {
            await getPackage(connection, packageName);
            return { success: false, reason: `⚠️ SAFETY: Package ${packageName} already exists!` };
          } catch (error: any) {
            const status = error.response?.status;
            if (status === 404) return { success: true };
            return { success: false, reason: `⚠️ SAFETY: Cannot verify package ${packageName} doesn't exist (HTTP ${status})` };
          }
        }
      });
    } catch (error) {
      hasConfig = false;
    }
  });

  afterAll(() => tester?.afterAll()());

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

  describe('Full workflow', () => {
    beforeEach(() => tester?.beforeEach()());
    afterEach(() => tester?.afterEach()());

    it('should execute full workflow and store all results', async () => {
      if (!hasConfig || !tester) {
        return;
      }
      const config = tester.getConfig();
      if (!config) {
        return;
      }

      await tester.flowTestAuto({
        updateConfig: {
          packageName: config.packageName,
          superPackage: config.superPackage,
          description: config.description || '',
          updatedDescription: config.updatedDescription || config.description || '',
          packageType: config.packageType,
          softwareComponent: config.softwareComponent,
          transportLayer: config.transportLayer,
          applicationComponent: config.applicationComponent,
          responsible: config.responsible
        }
      });
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP package', async () => {
      const standardObject = resolveStandardObject('package', isCloudSystem, null);

      if (!standardObject) {
        logBuilderTestStart(testsLogger, 'Package - read standard object', {
          name: 'read_standard',
          params: {}
        });
        logBuilderTestSkip(
          testsLogger,
          'Package - read standard object',
          `Standard package not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`
        );
        return;
      }

      const standardPackageName = standardObject.name;
      logBuilderTestStart(testsLogger, 'Package - read standard object', {
        name: 'read_standard',
        params: { package_name: standardPackageName }
      });

      if (!hasConfig) {
        logBuilderTestSkip(testsLogger, 'Package - read standard object', 'No SAP configuration');
        return;
      }

      try {
        const resultState = await tester.readTest({ packageName: standardPackageName });
        expect(resultState?.readResult).toBeDefined();
        const packageConfig = resultState?.readResult;
        if (packageConfig && typeof packageConfig === 'object' && 'packageName' in packageConfig) {
          expect((packageConfig as any).packageName).toBe(standardPackageName);
        }

        logBuilderTestSuccess(testsLogger, 'Package - read standard object');
      } catch (error) {
        logBuilderTestError(testsLogger, 'Package - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'Package - read standard object');
      }
    }, getTimeout('test'));
  });
});

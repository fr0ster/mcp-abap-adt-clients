/**
 * Integration test for Package
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 * - DEBUG_ADT_TESTS=true npm test -- --testPathPatterns=package  (ADT-clients logs)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtClient } from '../../../../clients/AdtClient';
import type { IPackageConfig, IPackageState } from '../../../../core/package';
import { getPackage } from '../../../../core/package/read';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { BaseTester } from '../../../helpers/BaseTester';
import { getConfig } from '../../../helpers/sessionConfig';
import {
  createConnectionLogger,
  createLibraryLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';
import {
  logTestEnd,
  logTestError,
  logTestSkip,
  logTestStart,
  logTestSuccess,
} from '../../../helpers/testProgressLogger';

const {
  getTestCaseDefinition,
  resolvePackageName,
  resolveStandardObject,
  getTimeout,
} = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const debugEnabled =
  process.env.DEBUG_ADT_TESTS === 'true' || process.env.DEBUG_ADT === 'true';
const _debugConnection = process.env.DEBUG_CONNECTORS === 'true'; // Connection uses DEBUG_CONNECTORS

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code uses DEBUG_ADT_LIBS
const libraryLogger: ILogger = createLibraryLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('Package (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let _connectionConfig: any = null;
  let hasConfig = false;
  let isCloudSystem = false;
  let tester: BaseTester<IPackageConfig, IPackageState>;

  beforeAll(async () => {
    try {
      const config = getConfig();
      _connectionConfig = config;
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, libraryLogger);
      hasConfig = true;
      isCloudSystem = await isCloudEnvironment(connection);

      tester = new BaseTester(
        client.getPackage(),
        'Package',
        'create_package',
        'adt_package',
        testsLogger,
      );

      tester.setup({
        connection,
        client,
        hasConfig,
        isCloudSystem,
        buildConfig: (testCase: any, resolver?: any) => {
          const params = testCase?.params || {};
          // Use resolver to get resolved parameters (from test case params or global defaults)
          // Priority: super_package > package_name (from resolver) > global default
          const parentPackage =
            params.super_package ||
            resolver?.getPackageName?.() ||
            resolvePackageName(params.package_name);
          if (!parentPackage)
            throw new Error('Parent package is not configured');
          const testPackage =
            params.test_package ||
            params.test_package_name ||
            params.package_name;
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
            responsible: params.responsible,
          };
        },
        ensureObjectReady: async (packageName: string) => {
          if (!connection) return { success: true };
          try {
            await getPackage(connection, packageName);
            return {
              success: false,
              reason: `⚠️ SAFETY: Package ${packageName} already exists!`,
            };
          } catch (error: any) {
            const status = error.response?.status;
            if (status === 404) return { success: true };
            return {
              success: false,
              reason: `⚠️ SAFETY: Cannot verify package ${packageName} doesn't exist (HTTP ${status})`,
            };
          }
        },
      });
    } catch (_error) {
      hasConfig = false;
    }
  });

  afterAll(() => tester?.afterAll()());

  /**
   * Pre-check: Verify test package doesn't exist
   * Safety: Skip test if object exists to avoid accidental deletion
   */
  async function _ensurePackageReady(
    packageName: string,
  ): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: true };
    }

    // Check if package exists
    try {
      await getPackage(connection, packageName);
      // Package exists - skip test for safety
      return {
        success: false,
        reason:
          `⚠️ SAFETY: Package ${packageName} already exists! ` +
          `Delete manually or use different test name to avoid accidental deletion.`,
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
        libraryLogger.warn?.(
          `[PRE-CHECK] Package ${packageName} check failed with status ${status}: ${errorMsg}`,
        );
      }

      return {
        success: false,
        reason:
          `⚠️ SAFETY: Cannot verify package ${packageName} doesn't exist (HTTP ${status}). ` +
          `May be locked or inaccessible. Delete/unlock manually to proceed.`,
      };
    }
  }

  describe('Full workflow', () => {
    beforeEach(() => tester?.beforeEach()());
    afterEach(() => tester?.afterEach()());

    it(
      'should execute full workflow and store all results',
      async () => {
        if (!tester) {
          return;
        }
        if (!hasConfig) {
          await tester.flowTestAuto();
          return;
        }
        const config = tester.getConfig();
        if (!config) {
          await tester.flowTestAuto();
          return;
        }

        await tester.flowTestAuto({
          updateConfig: {
            packageName: config.packageName,
            superPackage: config.superPackage,
            description: config.description || '',
            updatedDescription:
              config.updatedDescription || config.description || '',
            packageType: config.packageType,
            softwareComponent: config.softwareComponent,
            transportLayer: config.transportLayer,
            applicationComponent: config.applicationComponent,
            responsible: config.responsible,
          },
        });
      },
      getTimeout('test'),
    );
  });

  describe('Read standard object', () => {
    it(
      'should read standard SAP package',
      async () => {
        const standardObject = resolveStandardObject(
          'package',
          isCloudSystem,
          null,
        );

        if (!standardObject) {
          logTestStart(testsLogger, 'Package - read standard object', {
            name: 'read_standard',
            params: {},
          });
          logTestSkip(
            testsLogger,
            'Package - read standard object',
            `Standard package not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`,
          );
          return;
        }

        const standardPackageName = standardObject.name;
        logTestStart(testsLogger, 'Package - read standard object', {
          name: 'read_standard',
          params: { package_name: standardPackageName },
        });

        if (!hasConfig) {
          logTestSkip(
            testsLogger,
            'Package - read standard object',
            'No SAP configuration',
          );
          return;
        }

        try {
          const resultState = await tester.readTest({
            packageName: standardPackageName,
          });
          expect(resultState?.readResult).toBeDefined();
          const packageConfig = resultState?.readResult;
          if (
            packageConfig &&
            typeof packageConfig === 'object' &&
            'packageName' in packageConfig
          ) {
            expect((packageConfig as any).packageName).toBe(
              standardPackageName,
            );
          }

          logTestSuccess(testsLogger, 'Package - read standard object');
        } catch (error) {
          logTestError(testsLogger, 'Package - read standard object', error);
          throw error;
        } finally {
          logTestEnd(testsLogger, 'Package - read standard object');
        }
      },
      getTimeout('test'),
    );
  });
});

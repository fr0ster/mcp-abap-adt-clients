/**
 * Integration test for AuthorizationField
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_ADT_LIBS=true    - AuthorizationField library logs
 *  DEBUG_CONNECTORS=true  - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPatterns=authorizationField/AuthorizationField
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import { readAuthorizationField } from '../../../../core/authorizationField/read';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { BaseTester } from '../../../helpers/BaseTester';
import {
  createTestAdtClient,
  getConfig,
  resolveSystemContext,
} from '../../../helpers/sessionConfig';
import { TestConfigResolver } from '../../../helpers/TestConfigResolver';
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
  getEnabledTestCase,
  getTestCaseDefinition,
  resolvePackageName,
  resolveTransportRequest,
  resolveMasterSystem,
  ensurePackageConfig,
  getTimeout,
} = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code uses DEBUG_ADT_LIBS
const libraryLogger: ILogger = createLibraryLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('AuthorizationField (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isLegacy = false;
  let isCloudSystem = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      isCloudSystem = await isCloudEnvironment(connection);
      const systemContext = await resolveSystemContext(
        connection,
        isCloudSystem,
      );
      const { client: resolvedClient, isLegacy: legacy } =
        await createTestAdtClient(connection, libraryLogger, systemContext);
      client = resolvedClient;
      isLegacy = legacy;
      hasConfig = true;
    } catch (_error) {
      testsLogger.warn?.(
        '⚠️ Skipping tests: No .env file or SAP configuration found',
      );
      hasConfig = false;
    }
  });

  afterAll(async () => {
    if (connection) {
      (connection as any).reset();
    }
  });

  /**
   * Pre-check: Verify test authorization field doesn't exist.
   * If it does, return failure so the test is skipped to avoid stepping on a
   * pre-existing object. (Mirrors the DataElement test pattern.)
   */
  async function ensureAuthorizationFieldReady(
    authorizationFieldName: string,
  ): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: true };
    }
    try {
      await readAuthorizationField(connection, authorizationFieldName);
      return {
        success: false,
        reason:
          `⚠️ SAFETY: Authorization field ${authorizationFieldName} already exists! ` +
          `Delete manually or use a different test name to avoid accidental deletion.`,
      };
    } catch (error: any) {
      if (error.response?.status !== 404) {
        return {
          success: false,
          reason: `Cannot verify authorization field existence: ${error.message}`,
        };
      }
    }
    return { success: true };
  }

  function getTestDefinition() {
    return getTestCaseDefinition(
      'create_authorization_field',
      'adt_authorization_field',
    );
  }

  function buildConfig(testCase: any, resolver?: any) {
    const params = testCase?.params || {};
    const packageName =
      resolver?.getPackageName?.() || resolvePackageName(params.package_name);
    if (!packageName) {
      throw new Error(
        'package_name not configured for AuthorizationField test',
      );
    }
    const transportRequest =
      resolver?.getTransportRequest?.() ||
      resolveTransportRequest(params.transport_request);
    return {
      authorizationFieldName: params.authorization_field_name,
      packageName,
      transportRequest,
      description: params.description,
      masterSystem: resolveMasterSystem(params.master_system),
      responsible: process.env.SAP_USERNAME || process.env.SAP_USER,
      fieldName: params.field_name,
      rollName: params.roll_name,
      checkTable: params.check_table,
      domname: params.domname,
      outputlen: params.outputlen,
    };
  }

  describe('Full workflow', () => {
    let testCase: any = null;
    let authorizationFieldName: string | null = null;
    let skipReason: string | null = null;

    beforeEach(async () => {
      skipReason = null;
      testCase = null;
      authorizationFieldName = null;

      if (!hasConfig) {
        skipReason = 'No SAP configuration';
        return;
      }

      const definition = getTestDefinition();
      if (!definition) {
        skipReason = 'Test case not defined in test-config.yaml';
        return;
      }

      if (
        !TestConfigResolver.isTestAvailable(definition, isCloudSystem, isLegacy)
      ) {
        skipReason = `Test not available for ${
          isCloudSystem ? 'cloud' : isLegacy ? 'legacy' : 'onprem'
        } environment`;
        return;
      }

      const tc = getEnabledTestCase(
        'create_authorization_field',
        'adt_authorization_field',
      );
      if (!tc) {
        skipReason = 'Test case disabled or not found';
        return;
      }

      const packageCheck = ensurePackageConfig(
        tc.params,
        'AuthorizationField - full workflow',
      );
      if (!packageCheck.success) {
        skipReason = packageCheck.reason || 'Default package is not configured';
        return;
      }

      testCase = tc;
      authorizationFieldName = tc.params.authorization_field_name;

      if (authorizationFieldName) {
        const cleanup = await ensureAuthorizationFieldReady(
          authorizationFieldName,
        );
        if (!cleanup.success) {
          // Proactively delete so the test can re-run idempotently on a system
          // where a previous run left an artifact. Only touch Z*/Y* names.
          if (
            /^[ZY]/i.test(authorizationFieldName) &&
            client &&
            /already exists/i.test(cleanup.reason || '')
          ) {
            try {
              await client.getAuthorizationField().delete({
                authorizationFieldName,
                transportRequest: resolveTransportRequest(
                  tc.params.transport_request,
                ),
              });
              testsLogger.info?.(
                `Pre-existing authorization field ${authorizationFieldName} deleted before test`,
              );
            } catch (deleteErr: any) {
              skipReason = `Pre-existing auth field cleanup failed: ${deleteErr.message}`;
              testCase = null;
              authorizationFieldName = null;
              return;
            }
          } else {
            skipReason =
              cleanup.reason ||
              'Failed to cleanup authorization field before test';
            testCase = null;
            authorizationFieldName = null;
          }
        }
      }
    });

    it(
      'should execute full workflow and store all results',
      async () => {
        const definition = getTestDefinition();
        logTestStart(
          testsLogger,
          'AuthorizationField - full workflow',
          definition,
        );

        if (skipReason) {
          logTestSkip(
            testsLogger,
            'AuthorizationField - full workflow',
            skipReason,
          );
          return;
        }

        if (!testCase || !authorizationFieldName) {
          logTestSkip(
            testsLogger,
            'AuthorizationField - full workflow',
            skipReason || 'Test case not available',
          );
          return;
        }

        const resolver = new TestConfigResolver({
          testCase,
          isCloud: isCloudSystem,
          logger: testsLogger,
        });
        const config = buildConfig(testCase, resolver);

        const tester = new BaseTester(
          client.getAuthorizationField(),
          'AuthorizationField',
          'create_authorization_field',
          'adt_authorization_field',
          testsLogger,
        );

        try {
          // Drive CRUD flow. Update config applies a few content fields so the
          // update path actually changes something meaningful (description +
          // domname / rollName).
          await tester.flowTest(config, testCase.params, {
            updateConfig: {
              authorizationFieldName: config.authorizationFieldName,
              packageName: config.packageName!,
              description:
                testCase.params.update_description ||
                `${config.description || 'updated'} (upd)`,
              domname: testCase.params.update_domname || config.domname,
              rollName: testCase.params.update_roll_name || config.rollName,
            },
          });

          logTestSuccess(testsLogger, 'AuthorizationField - full workflow');
        } catch (error: any) {
          logTestError(
            testsLogger,
            'AuthorizationField - full workflow',
            error,
          );
          throw error;
        } finally {
          logTestEnd(testsLogger, 'AuthorizationField - full workflow');
        }
      },
      getTimeout('test'),
    );
  });
});

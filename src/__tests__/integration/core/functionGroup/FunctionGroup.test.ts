/**
 * Integration test for FunctionGroup
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_ADT_LIBS=true    - FunctionGroup library logs
 *  DEBUG_CONNECTORS=true   - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPatterns=functionGroup/FunctionGroup
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import type { IFunctionGroupConfig } from '../../../../core/functionGroup';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { patchXmlAttribute } from '../../../../utils/xmlPatch';
import { integrationHeadersOf } from '../../../helpers/adtHeaders';
import { BaseTester } from '../../../helpers/BaseTester';
import { gate, gateStandardObject } from '../../../helpers/caseGate';
import { expectResult, failureOf } from '../../../helpers/contract';
import { presenceOf } from '../../../helpers/objectPresence';
import {
  createTestAdtClient,
  createTestConnection,
  resolveSystemContext,
  skipUnlessConfigured,
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
  logTestStart,
  logTestSuccess,
} from '../../../helpers/testProgressLogger';

const {
  resolvePackageName,
  resolveTransportRequest,
  resolveMasterSystem,
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

describe('FunctionGroup (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;
  let isLegacy = false;
  let tester: BaseTester<IFunctionGroupConfig>;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
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

      tester = new BaseTester(
        // getFunctionGroup() declares no IAdtVersionable (no
        // getVersions/getVersionSource); cast through the full interface.
        client.getFunctionGroup(),
        'FunctionGroup',
        'create_function_group',
        'adt_function_group',
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
          const packageName =
            resolver?.getPackageName?.() ||
            resolvePackageName(params.package_name);
          if (!packageName) throw new Error('package_name not configured');
          const transportRequest =
            resolver?.getTransportRequest?.() ||
            resolveTransportRequest(params.transport_request);
          return {
            functionGroupName: params.function_group_name,
            packageName,
            transportRequest,
            description: params.description,
            masterSystem: resolveMasterSystem(params.master_system),
            responsible: process.env.SAP_USERNAME || process.env.SAP_USER,
          };
        },
        ensureObjectReady: async (functionGroupName: string) => {
          if (!connection) return { success: true };
          try {
            const { client: cleanupClient } = await createTestAdtClient(
              connection,
              libraryLogger,
              systemContext,
            );
            const existing = presenceOf(
              await cleanupClient
                .getFunctionGroup()
                .readMetadata({ functionGroupName }),
              `function group ${functionGroupName}`,
            );
            // "Could not find out" is not "absent": the create would meet it.
            if (existing.present === 'unknown') {
              return { success: false, reason: existing.reason };
            }
            if (existing.present === true) {
              // No lock is taken here to "release" one: a lock in this session
              // cannot release another session's, and this session holds none.
              // A delete of an object locked elsewhere is refused, and that
              // refusal fails the setup with what SAP said.
              try {
                const transportRequest = tester.getTransportRequest();
                const removed = await cleanupClient.getFunctionGroup().delete(
                  {
                    functionGroupName,
                    transportRequest,
                  },
                  {
                    headers: integrationHeadersOf(
                      cleanupClient.getFunctionGroup(),
                      'delete',
                    ),
                  },
                );
                if (!removed.ok) {
                  return {
                    success: false,
                    objectExists: true,
                    reason: failureOf(
                      removed,
                      `delete existing function group ${functionGroupName}`,
                    ),
                  };
                }
                await new Promise((resolve) => setTimeout(resolve, 3000));
              } catch (cleanupError: any) {
                return {
                  success: false,
                  objectExists: true,
                  reason: `Failed to delete existing function group ${functionGroupName}: ${cleanupError.message}`,
                };
              }
            }
          } catch (error: any) {
            // Presence is read from the answer above; a throw is a failure of
            // the setup itself, whatever its status.
            return {
              success: false,
              reason: `Cannot verify function group existence: ${error.message}`,
            };
          }
          return { success: true };
        },
      });
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      hasConfig = skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(() => tester?.afterAll()());

  describe('Full workflow', () => {
    beforeEach(() => tester?.beforeEach()());
    afterEach(() => tester?.afterEach()());

    gate('create_function_group', 'adt_function_group')(
      'should execute full workflow and store all results',
      async () => {
        const config = await tester.requireConfig();

        await tester.flowTestAuto({
          updateTakesDocument: (current) =>
            patchXmlAttribute(
              current,
              'adtcore:description',
              `${config.description || ''} (updated)`.slice(0, 60),
            ),
          updateConfig: {
            functionGroupName: config.functionGroupName,
            packageName: config.packageName,
            description: config.description || '',
            transportRequest: config.transportRequest,
          },
        });
      },
      getTimeout('test'),
    );
  });

  describe('Read standard object', () => {
    gateStandardObject('function_group')(
      'should read standard SAP function group',
      async () => {
        // Use TestConfigResolver for consistent parameter resolution
        const resolver = new TestConfigResolver({
          isCloud: isCloudSystem,
          logger: testsLogger,
        });
        const standardObject = resolver.getStandardObject('function_group');

        if (!standardObject) {
          throw new Error(
            `Standard function group not configured for ${isCloudSystem ? 'cloud' : isLegacy ? 'legacy' : 'on-premise'} environment`,
          );
        }

        const standardFunctionGroupName = standardObject.name;
        logTestStart(testsLogger, 'FunctionGroup - read standard object', {
          name: 'read_standard',
          params: { function_group_name: standardFunctionGroupName },
        });

        try {
          const resultState = await tester.readTest({
            functionGroupName: standardFunctionGroupName,
          });
          expect(resultState).toBeDefined();
          expect(resultState).toBeDefined();
          // FunctionGroup read returns function group config - check if functionGroupName is present
          const functionGroupConfig = resultState;
          if (
            functionGroupConfig &&
            typeof functionGroupConfig === 'object' &&
            'functionGroupName' in functionGroupConfig
          ) {
            expect((functionGroupConfig as any).functionGroupName).toBe(
              standardFunctionGroupName,
            );
          }

          logTestSuccess(testsLogger, 'FunctionGroup - read standard object');
        } catch (error) {
          logTestError(
            testsLogger,
            'FunctionGroup - read standard object',
            error,
          );
          throw error;
        } finally {
          logTestEnd(testsLogger, 'FunctionGroup - read standard object');
        }
      },
      getTimeout('test'),
    );
  });
});

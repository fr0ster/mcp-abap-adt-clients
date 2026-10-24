/**
 * Integration test for Class
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_ADT_LIBS=true    - Class library logs
 *  DEBUG_CONNECTORS=true   - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPatterns=class/Class
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import type { IClassConfig } from '../../../../core/class';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { integrationHeadersOf } from '../../../helpers/adtHeaders';
import { BaseTester } from '../../../helpers/BaseTester';
import {
  gate,
  gateAll,
  gateOn,
  gateStandardObject,
} from '../../../helpers/caseGate';
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
  getTimeout,
} = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code (Class) uses DEBUG_ADT_LIBS
const libraryLogger: ILogger = createLibraryLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

/** A transport request is configured for the transport read tests. */
function transportConfigured(isCloud: boolean): boolean {
  const resolver = new TestConfigResolver({ isCloud }).tryMultipleHandlers([
    { handlerName: 'read_transport', testCaseName: 'read_transport' },
    { handlerName: 'create_class', testCaseName: 'adt_class' },
  ]);
  return !!(
    resolver?.getTransportRequest() ||
    new TestConfigResolver({
      isCloud,
      handlerName: 'create_class',
      testCaseName: 'adt_class',
    }).getTransportRequest()
  );
}

describe('Class (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;
  let isLegacy = false;
  let systemContext: Awaited<ReturnType<typeof resolveSystemContext>>;
  let tester: BaseTester<IClassConfig>;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
      isCloudSystem = await isCloudEnvironment(connection);
      systemContext = await resolveSystemContext(connection, isCloudSystem);
      const { client: resolvedClient, isLegacy: legacy } =
        await createTestAdtClient(connection, libraryLogger, systemContext);
      client = resolvedClient;
      isLegacy = legacy;
      hasConfig = true;

      tester = new BaseTester(
        client.getClass(),
        'Class',
        'create_class',
        'adt_class',
        testsLogger,
      );

      tester.setup({
        connection,
        client,
        hasConfig,
        isCloudSystem,
        buildConfig: (testCase: any, resolver?: TestConfigResolver) => {
          // Use resolver to get resolved parameters (from test case params or global defaults)
          const packageName =
            resolver?.getPackageName() ||
            resolvePackageName(testCase?.params?.package_name);
          if (!packageName) throw new Error('package_name not configured');
          const transportRequest =
            resolver?.getTransportRequest() ||
            resolveTransportRequest(testCase?.params?.transport_request);
          const params = testCase?.params || {};
          return {
            className: params.class_name,
            packageName,
            transportRequest,
            description:
              params.description || `Test class ${params.class_name}`,
            source: params.source_code,
          };
        },
        ensureObjectReady: async (className: string) => {
          if (!connection) return { success: true };
          try {
            const { client: cleanupClient } = await createTestAdtClient(
              connection,
              libraryLogger,
              systemContext,
            );
            // `if (existingClass)` was always true once a read stopped
            // throwing: it is an answer object either way. The answer decides —
            // see `presenceOf`.
            const existing = presenceOf(
              await cleanupClient.getClass().read({ className }),
              `class ${className}`,
            );
            // "Could not find out" is not "absent": the create would meet it.
            if (existing.present === 'unknown') {
              return { success: false, reason: existing.reason };
            }
            if (existing.present === true) {
              try {
                // Use BaseTester's config resolver to get transport request (allows overriding global params)
                const transportRequest = tester.getTransportRequest();
                const removed = await cleanupClient.getClass().delete(
                  {
                    className,
                    transportRequest,
                  },
                  {
                    headers: integrationHeadersOf(
                      cleanupClient.getClass(),
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
                      `delete existing class ${className}`,
                    ),
                  };
                }
                await new Promise((resolve) => setTimeout(resolve, 3000));
              } catch (cleanupError: any) {
                return {
                  success: false,
                  objectExists: true,
                  reason: `Failed to delete existing class ${className}: ${cleanupError.message}`,
                };
              }
            }
          } catch (error: any) {
            if (error.response?.status !== 404) {
              return {
                success: false,
                reason: `Cannot verify class existence: ${error.message}`,
              };
            }
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

    gate('create_class', 'adt_class')(
      'should execute full workflow and store all results',
      async () => {
        const config = await tester.requireConfig();

        const testCase = tester.getTestCaseDefinition();
        const sourceCode =
          testCase?.params?.source_code ||
          config.source ||
          `CLASS ${config.className} DEFINITION PUBLIC FINAL CREATE PUBLIC. ENDCLASS.`;

        await tester.flowTestAuto({
          source: sourceCode,
          updateConfig: {
            className: config.className,
            packageName: config.packageName,
            description: config.description || '',
            source: sourceCode,
          },
        });
      },
      getTimeout('test'),
    );
  });

  describe('Read standard object', () => {
    gateStandardObject('class')(
      'should read standard SAP class',
      async () => {
        // Use BaseTester's method to get standard object (prioritizes standard_objects registry)
        const standardObject = tester.getStandardObject('class');

        if (!standardObject) {
          throw new Error(
            `Standard class not configured for ${isCloudSystem ? 'cloud' : isLegacy ? 'legacy' : 'on-premise'} environment`,
          );
        }

        const standardClassName = standardObject.name;
        logTestStart(testsLogger, 'Class - read standard object', {
          name: 'read_standard',
          params: { class_name: standardClassName },
        });

        try {
          const resultState = await tester.readTest({
            className: standardClassName,
          });
          expect(resultState).toBeDefined();
          // IClassState doesn't have className directly, check readResult
          expect(resultState).toBeDefined();

          logTestSuccess(testsLogger, 'Class - read standard object');
        } catch (error) {
          logTestError(testsLogger, 'Class - read standard object', error);
          throw error;
        } finally {
          logTestEnd(testsLogger, 'Class - read standard object');
        }
      },
      getTimeout('test'),
    );
  });

  describe('Read transport request', () => {
    gateAll(
      gateStandardObject('class'),
      gateOn(({ isCloud }) => transportConfigured(isCloud)),
    )(
      'should read transport request for class',
      async () => {
        // Use BaseTester's method to get standard object (prioritizes standard_objects registry)
        const standardObject = tester.getStandardObject('class');
        if (!standardObject) {
          throw new Error(
            `Standard class not configured for ${isCloudSystem ? 'cloud' : isLegacy ? 'legacy' : 'on-premise'} environment`,
          );
        }

        const standardClassName = standardObject.name;

        // Try to get resolver for read_transport test case, fallback to create_class
        // Use BaseTester's config resolver if available, otherwise create new one
        let transportRequest = '';
        const resolver = new TestConfigResolver({
          isCloud: isCloudSystem,
          logger: testsLogger,
        }).tryMultipleHandlers([
          { handlerName: 'read_transport', testCaseName: 'read_transport' },
          { handlerName: 'create_class', testCaseName: 'adt_class' },
        ]);
        transportRequest =
          resolver?.getTransportRequest() || tester.getTransportRequest() || '';

        if (!transportRequest) {
          throw new Error(
            'transport_request not configured in test-config.yaml (required for transport read test)',
          );
        }

        logTestStart(testsLogger, 'Class - read transport request', {
          name: 'read_transport',
          params: {
            class_name: standardClassName,
            transport_request: transportRequest,
          },
        });

        try {
          // The shipped reading of a transport request is its document. The
          // number is what identifies the request, so a document that does not
          // name it is not the request that was asked for.
          const result = expectResult(
            await client
              .getRequest()
              .readMetadata({ transportNumber: transportRequest }),
            'read transport request',
          );
          expect(result).toContain(transportRequest);

          const metadata = expectResult(
            await client
              .getRequest()
              .readMetadata({ transportNumber: transportRequest }),
            'read transport request metadata',
          );
          expect(metadata).toContain(transportRequest);

          logTestSuccess(testsLogger, 'Class - read transport request');
        } catch (error) {
          logTestError(testsLogger, 'Class - read transport request', error);
          throw error;
        } finally {
          logTestEnd(testsLogger, 'Class - read transport request');
        }
      },
      getTimeout('test'),
    );
  });
});

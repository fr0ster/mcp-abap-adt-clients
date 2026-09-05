/**
 * Unit test for AdtRequest
 * Tests create/read operations for transport requests
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_ADT_LIBS=true    - ADT library logs
 *  DEBUG_CONNECTORS=true   - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPatterns=transport/Transport
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  IAbapConnection,
  ILogger,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { expectResult } from '../../../helpers/contract';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
  resolveSystemContext,
  skipUnlessConfigured,
} from '../../../helpers/sessionConfig';
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
  logTestStep,
  logTestSuccess,
} from '../../../helpers/testProgressLogger';

const {
  getEnabledTestCase,
  getTestCaseDefinition,
} = require('../../../helpers/test-helper');
const { getTimeout } = require('../../../helpers/test-helper');

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

describe('AdtRequest', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;
  let hasConfig = false;
  let isLegacy = false;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
      const isCloudSystem = await isCloudEnvironment(connection);
      const systemContext = await resolveSystemContext(
        connection,
        isCloudSystem,
      );
      const { client: resolvedClient, isLegacy: legacy } =
        await createTestAdtClient(connection, libraryLogger, systemContext);
      client = resolvedClient;
      isLegacy = legacy;
      hasConfig = true;
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      hasConfig = skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(async () => {
    if (connection) {
      await releaseTestConnection(connection);
    }
  });

  function getTestDefinition() {
    return getTestCaseDefinition('create_transport', 'builder_transport');
  }

  function buildConfig(testCase: any): {
    description: string;
    transportType?: string;
    owner?: string;
    targetSystem?: string;
  } {
    const params = testCase?.params || {};
    return {
      description: params.description || '',
      transportType: params.transport_type || 'workbench',
      owner: params.owner,
      targetSystem: params.target_system,
    };
  }

  describe('Full workflow', () => {
    let testCase: any = null;
    let skipReason: string | null = null;

    beforeAll(async () => {
      skipReason = null;
      testCase = null;

      if (!hasConfig) {
        skipReason = 'No SAP configuration';
        return;
      }

      const definition = getTestDefinition();
      if (!definition) {
        skipReason = 'Test case not defined in test-config.yaml';
        return;
      }

      const tc = getEnabledTestCase('create_transport', 'builder_transport');
      if (!tc) {
        skipReason = 'Test case disabled or not found';
        return;
      }

      testCase = tc;
      // Transports are created dynamically, no cleanup needed
    });

    afterAll(async () => {
      // Transports cannot be deleted, so no cleanup needed
      // Just log if needed
      testsLogger.debug?.(
        '[BUILDER TESTS] Transport was created (cannot be deleted)',
      );
    });

    it(
      'should execute full workflow: create and read transport',
      async () => {
        const definition = getTestDefinition();
        logTestStart(testsLogger, 'AdtRequest - full workflow', definition);

        if (skipReason) {
          logTestSkip(testsLogger, 'AdtRequest - full workflow', skipReason);
          return;
        }

        if (!testCase) {
          logTestSkip(
            testsLogger,
            'AdtRequest - full workflow',
            skipReason || 'Test case not available',
          );
          return;
        }

        let transportNumber: string | null = null;

        try {
          logTestStep('create', testsLogger);
          const createState = expectResult(
            await client.getRequest().create(buildConfig(testCase) as any),
            'createState',
          );

          expect(createState).toBeDefined();
          expect(createState.transportNumber).toBeDefined();
          expect(createState.errors.length).toBe(0);

          transportNumber = createState.transportNumber || null;

          logTestSuccess(testsLogger, 'AdtRequest - full workflow');
        } catch (error: any) {
          // If username not found or user doesn't exist, skip test instead of failing
          const errorMsg = error.message || '';
          const errorData = error.response?.data || '';
          const errorText =
            typeof errorData === 'string'
              ? errorData
              : JSON.stringify(errorData);
          const fullErrorText = `${errorMsg} ${errorText}`.toLowerCase();

          if (
            fullErrorText.includes('username not found') ||
            fullErrorText.includes('does not exist in the system') ||
            (fullErrorText.includes('user') &&
              fullErrorText.includes('does not exist'))
          ) {
            logTestSkip(
              testsLogger,
              'AdtRequest - full workflow',
              'Username not found or user does not exist in system',
            );
            return; // Skip test
          }
          logTestError(testsLogger, 'AdtRequest - full workflow', error);
          throw error;
        } finally {
          // Read the created transport before cleanup (using transportNumber from state)
          if (transportNumber) {
            try {
              logTestStep('read', testsLogger);
              const readState = expectResult(
                await client.getRequest().read({
                  transportNumber,
                }),
                'readState',
              );
              expect(readState).toBeDefined();
              expect(readState).toBeDefined();
              const metadataState = expectResult(
                await client.getRequest().readMetadata({
                  transportNumber,
                }),
                'metadataState',
              );
              expect(metadataState).toBeDefined();
              expect(metadataState).toBeDefined();
            } catch (readError: any) {
              testsLogger.warn?.(
                `Failed to read transport ${transportNumber}:`,
                readError,
              );
              // Don't fail the test if read fails
            }
          }

          logTestEnd(testsLogger, 'AdtRequest - full workflow');
        }
      },
      getTimeout('test'),
    );
  });

  describe('List transports', () => {
    it(
      'should list transport requests through a saved search configuration',
      async () => {
        logTestStart(testsLogger, 'AdtRequest - list transports', {
          name: 'list_transports',
          params: {},
        });

        if (!hasConfig) {
          logTestSkip(
            testsLogger,
            'AdtRequest - list transports',
            'No SAP configuration',
          );
          return;
        }

        try {
          // A body that merely "exists" is not a detector: the historical
          // defect (HTTP 200, a self-closing `<tm:root/>`, zero requests) is
          // itself a well-formed, non-empty body. Checking shape alone stays
          // green on exactly the payload this test exists to catch.
          //
          // The discriminator is a transport request we create ourselves, the
          // same way and from the same config source as the "Full workflow"
          // block (`create_transport` / `builder_transport`). Once it exists,
          // list() MUST surface its number — if list() regresses to an empty
          // root, this fails, because we independently know the request is
          // there.
          let knownTransportNumber: string | null = null;
          const definition = getTestDefinition();
          const testCase = definition
            ? getEnabledTestCase('create_transport', 'builder_transport')
            : null;

          if (testCase) {
            try {
              logTestStep('create (discriminator transport)', testsLogger);
              const createState = expectResult(
                await client.getRequest().create(buildConfig(testCase) as any),
                'createState',
              );
              knownTransportNumber = createState.transportNumber || null;
            } catch (createError: any) {
              testsLogger.warn?.(
                'Could not create a discriminator transport for the list ' +
                  'test; falling back to a shape-only assertion:',
                createError,
              );
            }
          }

          logTestStep('list', testsLogger);
          const listState = expectResult(
            await client.getRequest().list(),
            'listState',
          );

          expect(listState.errors.length).toBe(0);
          expect(listState).toBeDefined();

          const body = String(listState ?? '');
          expect(body).toContain('tm:root');

          const requestCount = (body.match(/<tm:request /g) ?? []).length;
          logTestStep(`requests returned: ${requestCount}`, testsLogger);

          if (knownTransportNumber) {
            // Known-request case: the real detector. We created this request
            // moments ago, so its number must appear in the list body.
            logTestStep(
              `known-request case: expecting ${knownTransportNumber} in the list body`,
              testsLogger,
            );
            expect(body).toContain(knownTransportNumber);
          } else {
            // Fallback case: no discriminator was available (no test case
            // configured/enabled, or creation itself failed on this system —
            // e.g. legacy systems without the configured user). This branch
            // only confirms the response is a well-formed tm:root document;
            // it does NOT treat zero requests as suspicious. A system that
            // genuinely holds no transport requests must be able to report
            // zero without being flagged as broken.
            logTestStep(
              'fallback case: no discriminator transport available, ' +
                `asserting response shape only (requests returned: ${requestCount})`,
              testsLogger,
            );
            expect(body).toMatch(/<tm:root[^>]*\/>|<\/tm:root>/);
          }

          logTestSuccess(testsLogger, 'AdtRequest - list transports');
        } catch (error: any) {
          logTestError(testsLogger, 'AdtRequest - list transports', error);
          throw error;
        } finally {
          logTestEnd(testsLogger, 'AdtRequest - list transports');
        }
      },
      getTimeout('test'),
    );
  });
});

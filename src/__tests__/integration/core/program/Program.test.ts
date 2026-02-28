/**
 * Integration test for Program (AdtProgram)
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - Program library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPatterns=program/Program
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtClient } from '../../../../clients/AdtClient';
import type { IProgramConfig, IProgramState } from '../../../../core/program';
import { getProgramSource } from '../../../../core/program/read';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { BaseTester } from '../../../helpers/BaseTester';
import { getConfig } from '../../../helpers/sessionConfig';
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

// Library code (AdtClient) uses DEBUG_ADT_LIBS
const libraryLogger: ILogger = createLibraryLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('Program (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;
  let tester: BaseTester<IProgramConfig, IProgramState>;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, libraryLogger);
      hasConfig = true;
      isCloudSystem = await isCloudEnvironment(connection);

      tester = new BaseTester(
        client.getProgram(),
        'Program',
        'create_program',
        'adt_program',
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
            programName: params.program_name,
            packageName,
            transportRequest,
            description: params.description,
            programType: params.program_type,
            sourceCode: params.source_code,
          };
        },
        ensureObjectReady: async (programName: string) => {
          if (!connection) return { success: true };
          try {
            await getProgramSource(connection, programName);
            // Program exists — delete it before test
            try {
              const transportRequest = tester.getTransportRequest();
              const cleanupClient = new AdtClient(connection, libraryLogger);
              await cleanupClient.getProgram().delete({
                programName,
                transportRequest,
              });
              await new Promise((resolve) => setTimeout(resolve, 3000));
            } catch (cleanupError: any) {
              return {
                success: false,
                reason: `Failed to delete existing program ${programName}: ${cleanupError.message}`,
              };
            }
          } catch (error: any) {
            if (error.response?.status !== 404) {
              return {
                success: false,
                reason: `Cannot verify program existence: ${error.message}`,
              };
            }
          }
          return { success: true };
        },
      });
    } catch (_error) {
      hasConfig = false;
    }
  });

  afterAll(() => tester?.afterAll()());

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

        if (isCloudSystem) {
          logTestSkip(
            testsLogger,
            'Program - full workflow',
            'Programs are not supported in cloud systems (BTP ABAP Environment)',
          );
          return;
        }

        const config = tester.getConfig();
        if (!config) {
          await tester.flowTestAuto();
          return;
        }

        const testCase = tester.getTestCaseDefinition();
        const sourceCode =
          testCase?.params?.source_code || config.sourceCode || '';
        const updateSourceCode =
          testCase?.params?.update_source_code || sourceCode;

        await tester.flowTestAuto({
          sourceCode: sourceCode,
          updateConfig: {
            programName: config.programName,
            packageName: config.packageName,
            description: config.description || '',
            programType: config.programType,
            sourceCode: updateSourceCode,
          },
        });
      },
      getTimeout('test'),
    );
  });

  describe('Read standard object', () => {
    it(
      'should read standard SAP program',
      async () => {
        if (!hasConfig) {
          logTestSkip(
            testsLogger,
            'Program - read standard object',
            'No SAP configuration',
          );
          return;
        }

        if (isCloudSystem) {
          logTestSkip(
            testsLogger,
            'Program - read standard object',
            'Programs are not supported in cloud systems (BTP ABAP Environment)',
          );
          return;
        }

        // Use TestConfigResolver for consistent parameter resolution
        const resolver = new TestConfigResolver({
          isCloud: isCloudSystem,
          logger: testsLogger,
        });
        const standardObject = resolver.getStandardObject('program');

        if (!standardObject) {
          logTestStart(testsLogger, 'Program - read standard object', {
            name: 'read_standard',
            params: {},
          });
          logTestSkip(
            testsLogger,
            'Program - read standard object',
            'Standard program not configured for on-premise environment',
          );
          return;
        }

        const standardProgramName = standardObject.name;
        logTestStart(testsLogger, 'Program - read standard object', {
          name: 'read_standard',
          params: { program_name: standardProgramName },
        });

        try {
          const resultState = await tester.readTest({
            programName: standardProgramName,
          });
          expect(resultState?.readResult).toBeDefined();
          const sourceCode =
            typeof resultState?.readResult === 'string'
              ? resultState.readResult
              : (resultState?.readResult as any)?.data || '';
          expect(typeof sourceCode).toBe('string');

          logTestSuccess(testsLogger, 'Program - read standard object');
        } catch (error) {
          logTestError(testsLogger, 'Program - read standard object', error);
          throw error;
        } finally {
          logTestEnd(testsLogger, 'Program - read standard object');
        }
      },
      getTimeout('test'),
    );
  });

  describe('Read transport request', () => {
    it(
      'should read transport request for program',
      async () => {
        if (!hasConfig || !tester) {
          logTestSkip(
            testsLogger,
            'Program - read transport request',
            'No SAP configuration or tester not initialized',
          );
          return;
        }

        if (isCloudSystem) {
          logTestSkip(
            testsLogger,
            'Program - read transport request',
            'Programs are not supported in cloud systems (BTP ABAP Environment)',
          );
          return;
        }

        let transportRequest = '';
        const resolver = new TestConfigResolver({
          isCloud: isCloudSystem,
          logger: testsLogger,
        }).tryMultipleHandlers([
          { handlerName: 'read_transport', testCaseName: 'read_transport' },
          { handlerName: 'create_program', testCaseName: 'adt_program' },
        ]);
        transportRequest =
          resolver?.getTransportRequest() || tester.getTransportRequest() || '';

        if (!transportRequest) {
          logTestStart(testsLogger, 'Program - read transport request', {
            name: 'read_transport',
            params: {},
          });
          logTestSkip(
            testsLogger,
            'Program - read transport request',
            'transport_request not configured in test-config.yaml (required for transport read test)',
          );
          return;
        }

        logTestStart(testsLogger, 'Program - read transport request', {
          name: 'read_transport',
          params: { transport_request: transportRequest },
        });

        try {
          const result = await client
            .getRequest()
            .read({ transportNumber: transportRequest });
          expect(result).toBeDefined();
          expect(
            result?.transportNumber ||
              result?.readResult?.data?.transport_request,
          ).toBe(transportRequest);
          const metadataState = await client
            .getRequest()
            .readMetadata({ transportNumber: transportRequest });
          expect(metadataState).toBeDefined();
          expect(
            metadataState.transportNumber ||
              metadataState.readResult?.data?.transport_request,
          ).toBe(transportRequest);

          logTestSuccess(testsLogger, 'Program - read transport request');
        } catch (error) {
          logTestError(testsLogger, 'Program - read transport request', error);
          throw error;
        } finally {
          logTestEnd(testsLogger, 'Program - read transport request');
        }
      },
      getTimeout('test'),
    );
  });
});

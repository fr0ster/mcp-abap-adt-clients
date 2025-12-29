/**
 * Integration test for Program (AdtProgram)
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - Program library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=program/Program
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
import {
  logTestEnd,
  logTestError,
  logTestSkip,
  logTestStart,
  logTestSuccess,
} from '../../../helpers/testProgressLogger';
import { getConfig } from '../../../helpers/sessionConfig';
import { TestConfigResolver } from '../../../helpers/TestConfigResolver';
import {
  createLibraryLogger,
  createConnectionLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';

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
            return {
              success: false,
              reason: `⚠️ SAFETY: Program ${programName} already exists!`,
            };
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

        await tester.flowTestAuto({
          sourceCode: sourceCode,
          updateConfig: {
            programName: config.programName,
            packageName: config.packageName,
            description: config.description || '',
            programType: config.programType,
            sourceCode: sourceCode,
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
          logTestError(
            testsLogger,
            'Program - read standard object',
            error,
          );
          throw error;
        } finally {
          logTestEnd(testsLogger, 'Program - read standard object');
        }
      },
      getTimeout('test'),
    );
  });
});

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

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { AdtClient } from '../../../clients/AdtClient';
import { getProgramSource } from '../../../core/program/read';
import { getConfig } from '../../helpers/sessionConfig';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import {
  logBuilderTestStart,
  logBuilderTestSkip,
  logBuilderTestSuccess,
  logBuilderTestError,
  logBuilderTestEnd
} from '../../helpers/builderTestLogger';
import { createBuilderLogger, createConnectionLogger, createTestsLogger } from '../../helpers/testLogger';
import { BaseTester } from '../../helpers/BaseTester';
import { IProgramConfig, IProgramState } from '../../../core/program';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const {
  getTestCaseDefinition,
  resolvePackageName,
  resolveTransportRequest,
  resolveStandardObject,
  getTimeout
} = require('../../helpers/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code (AdtClient) uses DEBUG_ADT_LIBS
const builderLogger: ILogger = createBuilderLogger();

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
      client = new AdtClient(connection, builderLogger);
      hasConfig = true;
      isCloudSystem = await isCloudEnvironment(connection);

      tester = new BaseTester(
        client.getProgram(),
        'Program',
        'create_program',
        'adt_program',
        testsLogger
      );

      tester.setup({
        connection,
        client,
        hasConfig,
        isCloudSystem,
        buildConfig: (testCase: any) => {
          const params = testCase?.params || {};
          const packageName = resolvePackageName(params.package_name);
          if (!packageName) throw new Error('package_name not configured');
          return {
            programName: params.program_name,
            packageName,
            transportRequest: resolveTransportRequest(params.transport_request),
            description: params.description,
            programType: params.program_type,
            sourceCode: params.source_code
          };
        },
        ensureObjectReady: async (programName: string) => {
          if (!connection) return { success: true };
          try {
            await getProgramSource(connection, programName);
            return { success: false, reason: `⚠️ SAFETY: Program ${programName} already exists!` };
          } catch (error: any) {
            if (error.response?.status !== 404) {
              return { success: false, reason: `Cannot verify program existence: ${error.message}` };
            }
          }
          return { success: true };
        }
      });
    } catch (error) {
      hasConfig = false;
    }
  });

  afterAll(() => tester?.afterAll()());

  describe('Full workflow', () => {
    beforeEach(() => tester?.beforeEach()());
    afterEach(() => tester?.afterEach()());

    it('should execute full workflow and store all results', async () => {
      if (!hasConfig || !tester) {
        return;
      }

      if (isCloudSystem) {
        logBuilderTestSkip(testsLogger, 'Program - full workflow', 'Programs are not supported in cloud systems (BTP ABAP Environment)');
        return;
      }

      const config = tester.getConfig();
      if (!config) {
        return;
      }

      const testCase = tester.getTestCaseDefinition();
      const sourceCode = testCase?.params?.source_code || config.sourceCode || '';

      await tester.flowTestAuto({
        sourceCode: sourceCode,
        updateConfig: {
          programName: config.programName,
          packageName: config.packageName,
          description: config.description || '',
          programType: config.programType,
          sourceCode: sourceCode
        }
      });
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP program', async () => {
      if (!hasConfig) {
        logBuilderTestSkip(testsLogger, 'Program - read standard object', 'No SAP configuration');
        return;
      }

      if (isCloudSystem) {
        logBuilderTestSkip(testsLogger, 'Program - read standard object', 'Programs are not supported in cloud systems (BTP ABAP Environment)');
        return;
      }

      const testCase = getTestCaseDefinition('create_program', 'adt_program');
      const standardObject = resolveStandardObject('program', isCloudSystem, testCase);

      if (!standardObject) {
        logBuilderTestStart(testsLogger, 'Program - read standard object', {
          name: 'read_standard',
          params: {}
        });
        logBuilderTestSkip(
          testsLogger,
          'Program - read standard object',
          'Standard program not configured for on-premise environment'
        );
        return;
      }

      const standardProgramName = standardObject.name;
      logBuilderTestStart(testsLogger, 'Program - read standard object', {
        name: 'read_standard',
        params: { program_name: standardProgramName }
      });

      try {
        const resultState = await tester.readTest({ programName: standardProgramName });
        expect(resultState?.readResult).toBeDefined();
        const sourceCode = typeof resultState?.readResult === 'string' 
          ? resultState.readResult 
          : (resultState?.readResult as any)?.data || '';
        expect(typeof sourceCode).toBe('string');

        logBuilderTestSuccess(testsLogger, 'Program - read standard object');
      } catch (error) {
        logBuilderTestError(testsLogger, 'Program - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'Program - read standard object');
      }
    }, getTimeout('test'));
  });
});


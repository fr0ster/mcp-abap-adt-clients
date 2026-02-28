/**
 * Integration test for Program run operation
 * Tests runProgram function with self-contained setup/teardown
 *
 * Enable debug logs: DEBUG_ADT_TESTS=true npm test -- integration/core/program/run
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtClient } from '../../../../clients/AdtClient';
import { runProgram } from '../../../../core/program/run';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { getConfig } from '../../../helpers/sessionConfig';
import {
  createConnectionLogger,
  createLibraryLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';

const {
  getEnabledTestCase,
  getTimeout,
  resolvePackageName,
  resolveTransportRequest,
} = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger: ILogger = createConnectionLogger();
const libraryLogger: ILogger = createLibraryLogger();
const testsLogger: ILogger = createTestsLogger();

describe('Program - Run', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;
  let programNameForTest: string | null = null;
  let transportRequestForCleanup = '';

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, libraryLogger);
      hasConfig = true;
      isCloudSystem = await isCloudEnvironment(connection);
      programNameForTest = null;
      transportRequestForCleanup = '';
    } catch (_error) {
      testsLogger.warn(
        'Skipping tests: No .env file or SAP configuration found',
      );
      hasConfig = false;
    }
  });

  afterEach(async () => {
    if (connection && programNameForTest) {
      try {
        await client.getProgram().delete({
          programName: programNameForTest,
          transportRequest: transportRequestForCleanup,
        });
      } catch (cleanupError) {
        testsLogger.warn?.(
          `Cleanup failed for program ${programNameForTest}: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
        );
      }
    }

    if (connection) {
      (connection as any).reset();
    }
  });

  it(
    'should run program and get output',
    async () => {
      if (!hasConfig) {
        testsLogger.warn(
          'Skipping test: No .env file or SAP configuration found',
        );
        return;
      }

      if (isCloudSystem) {
        testsLogger.warn(
          'Skipping test: Programs are not supported in cloud systems',
        );
        return;
      }

      const testCase = getEnabledTestCase('run_program');
      if (!testCase) {
        testsLogger.warn('Skipping test: Test case is disabled');
        return;
      }

      const baseName = testCase.params.program_name || 'ZADT_BLD_PROG_RUN';
      const suffix = Date.now().toString().slice(-4);
      const maxBaseLen = 30 - suffix.length;
      const programName = `${baseName.toUpperCase().slice(0, maxBaseLen)}${suffix}`;

      const packageName = resolvePackageName(testCase.params?.package_name);
      const transportRequest = resolveTransportRequest(
        testCase.params?.transport_request,
      );

      if (!packageName) {
        testsLogger.warn('Skipping test: package_name not configured');
        return;
      }

      programNameForTest = programName;
      transportRequestForCleanup = transportRequest || '';

      const sourceCode = `REPORT ${programName}.\nWRITE: / 'RUN_PROGRAM_TEST_PROBE = OK'.`;

      // Create and activate program
      await client.getProgram().create({
        programName,
        packageName,
        transportRequest,
        description: `Run test ${programName}`,
      });

      await client
        .getProgram()
        .update(
          { programName, sourceCode, transportRequest },
          { activateOnUpdate: true, sourceCode },
        );

      // Run
      const result = await runProgram(connection, programName);
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
    },
    getTimeout('test'),
  );
});

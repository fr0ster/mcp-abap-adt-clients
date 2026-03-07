/**
 * Integration test for Program run operation
 * Uses shared program (created if missing) — see shared_dependencies.programs in test-config.yaml
 *
 * Enable debug logs: DEBUG_ADT_TESTS=true npm test -- integration/core/program/run
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import { runProgram } from '../../../../core/program/run';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
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

const {
  getEnabledTestCase,
  getTimeout,
  ensureSharedDependency,
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
  let isLegacy = false;

  beforeEach(async () => {
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
      testsLogger.warn(
        'Skipping tests: No .env file or SAP configuration found',
      );
      hasConfig = false;
    }
  });

  afterEach(async () => {
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

      const testCase = getEnabledTestCase('run_program');
      if (!testCase) {
        testsLogger.warn('Skipping test: Test case is disabled');
        return;
      }

      if (
        !TestConfigResolver.isTestAvailable(testCase, isCloudSystem, isLegacy)
      ) {
        const envName = isCloudSystem
          ? 'cloud'
          : isLegacy
            ? 'legacy'
            : 'onprem';
        testsLogger.warn(
          `Skipping test: Not available for ${envName} environment`,
        );
        return;
      }

      const programName = testCase.params.program_name || 'ZADT_BLD_RUN01';

      // Ensure shared program exists (create if missing)
      await ensureSharedDependency(
        client,
        'programs',
        programName,
        testsLogger,
      );

      // Run
      const result = await runProgram(connection, programName);
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
    },
    getTimeout('test'),
  );
});

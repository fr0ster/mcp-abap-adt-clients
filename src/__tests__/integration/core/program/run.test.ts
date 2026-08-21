/**
 * Integration test for Program run operation
 * Uses shared program (created if missing) — see shared_dependencies.programs in test-config.yaml
 *
 * Enable debug logs: DEBUG_ADT_TESTS=true npm test -- integration/core/program/run
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
import { runProgram } from '../../../../core/program/run';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
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
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;
  let isLegacy = false;

  beforeEach(async () => {
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
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      hasConfig = skipUnlessConfigured(error, testsLogger);
    }
  });

  afterEach(async () => {
    if (connection) {
      await connection.disconnect();
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

      const programName = testCase.params.program_name;

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

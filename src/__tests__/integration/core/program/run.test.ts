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
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import { runProgram } from '../../../../core/program/run';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import {
  configuredCase,
  gate,
  missingCaseMessage,
} from '../../../helpers/caseGate';
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

const {
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
  let isCloudSystem = false;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
      isCloudSystem = await isCloudEnvironment(connection);
      const systemContext = await resolveSystemContext(
        connection,
        isCloudSystem,
      );
      const { client: resolvedClient } = await createTestAdtClient(
        connection,
        libraryLogger,
        systemContext,
      );
      client = resolvedClient;
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(async () => {
    if (connection) {
      await releaseTestConnection(connection);
    }
  });

  gate('run_program', 'run_program')(
    'should run program and get output',
    async () => {
      const testCase = configuredCase('run_program', 'run_program');
      if (!testCase) {
        throw new Error(missingCaseMessage('run_program', 'run_program'));
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

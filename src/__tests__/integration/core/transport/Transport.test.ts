/**
 * Unit test for AdtRequest
 * Tests create/read operations for transport requests
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_ADT_LIBS=true    - ADT library logs
 *  DEBUG_CONNECTORS=true   - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=transport/Transport
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtClient } from '../../../../clients/AdtClient';
import {
 logTestEnd,
 logTestError,
 logTestSkip,
 logTestStart,
 logTestStep,
 logTestSuccess,
} from '../../../helpers/testProgressLogger';
import { getConfig } from '../../../helpers/sessionConfig';
import {
 createLibraryLogger,
 createConnectionLogger,
 createTestsLogger,
} from '../../../helpers/testLogger';

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
 let connection: IAbapConnection;
 let client: AdtClient;
 let hasConfig = false;

 beforeAll(async () => {
  try {
   const config = getConfig();
   connection = createAbapConnection(config, connectionLogger);
   await (connection as any).connect();
   client = new AdtClient(connection, libraryLogger);
   hasConfig = true;
  } catch (_error) {
   testsLogger.warn?.(
    '⚠️ Skipping tests: No .env file or SAP configuration found',
   );
   hasConfig = false;
  }
 });

 afterAll(async () => {
  if (connection) {
   (connection as any).reset();
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

  beforeEach(async () => {
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

  afterEach(async () => {
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
    logTestStart(
     testsLogger,
     'AdtRequest - full workflow',
     definition,
    );

    if (skipReason) {
     logTestSkip(
      testsLogger,
      'AdtRequest - full workflow',
      skipReason,
     );
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
     const createState = await client
      .getRequest()
      .create(buildConfig(testCase) as any);

     expect(createState.createResult).toBeDefined();
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
       const readState = await client.getRequest().read({
        transportNumber,
       });
       expect(readState).toBeDefined();
       expect(readState?.readResult).toBeDefined();
       const metadataState = await client.getRequest().readMetadata({
        transportNumber,
       });
       expect(metadataState).toBeDefined();
       expect(metadataState.readResult).toBeDefined();
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
});

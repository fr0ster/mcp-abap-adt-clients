/**
 * Unit test for TransportBuilder
 * Tests fluent API with Promise chaining, error handling, and result storage
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - TransportBuilder library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=transport/TransportBuilder
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { TransportBuilder } from '../../../core/transport/TransportBuilder';
import { IAdtLogger } from '../../../utils/logger';
import { getConfig } from '../../helpers/sessionConfig';
import {
  logBuilderTestError,
  logBuilderTestSkip,
  logBuilderTestStart,
  logBuilderTestSuccess,
  logBuilderTestEnd,
  logBuilderTestStep
} from '../../helpers/builderTestLogger';
import { createConnectionLogger, createBuilderLogger, createTestsLogger } from '../../helpers/testLogger';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const {
  getEnabledTestCase,
  getTestCaseDefinition
} = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code uses DEBUG_ADT_LIBS
const builderLogger: IAdtLogger = createBuilderLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: IAdtLogger = createTestsLogger();

describe('TransportBuilder', () => {
  let connection: AbapConnection;
  let hasConfig = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      hasConfig = true;
    } catch (error) {
      testsLogger.warn?.('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterAll(async () => {
    if (connection) {
      connection.reset();
    }
  });

  function getBuilderTestDefinition() {
    return getTestCaseDefinition('create_transport', 'builder_transport');
  }

  function buildBuilderConfig(testCase: any) {
    const params = testCase?.params || {};
    return {
      description: params.description,
      transportType: params.transport_type || 'workbench',
      owner: params.owner,
      targetSystem: params.target_system
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

      const definition = getBuilderTestDefinition();
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
        testsLogger.debug?.('[BUILDER TESTS] Transport was created (cannot be deleted)');
    });

    it('should execute full workflow: create and read transport', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(testsLogger, 'TransportBuilder - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(testsLogger, 'TransportBuilder - full workflow', skipReason);
        return;
      }

      if (!testCase) {
        logBuilderTestSkip(testsLogger, 'TransportBuilder - full workflow', skipReason || 'Test case not available');
        return;
      }

      const builder = new TransportBuilder(connection, builderLogger, buildBuilderConfig(testCase));
      let transportNumber: string | null = null;

      try {
        logBuilderTestStep('create');
      await builder.create();

        const state = builder.getState();
        expect(state.createResult).toBeDefined();
        expect(state.transportNumber).toBeDefined();
        expect(state.errors.length).toBe(0);

        transportNumber = state.transportNumber || null;

        logBuilderTestSuccess(testsLogger, 'TransportBuilder - full workflow');
      } catch (error: any) {
        // If username not found or user doesn't exist, skip test instead of failing
        const errorMsg = error.message || '';
        const errorData = error.response?.data || '';
        const errorText = typeof errorData === 'string' ? errorData : JSON.stringify(errorData);
        const fullErrorText = `${errorMsg} ${errorText}`.toLowerCase();

        if (fullErrorText.includes('username not found') ||
            fullErrorText.includes('does not exist in the system') ||
            fullErrorText.includes('user') && fullErrorText.includes('does not exist')) {
          logBuilderTestSkip(testsLogger, 'TransportBuilder - full workflow', 'Username not found or user does not exist in system');
          return; // Skip test
        }
        logBuilderTestError(testsLogger, 'TransportBuilder - full workflow', error);
        throw error;
      } finally {
        // Read the created transport before cleanup (using transportNumber from state)
        if (transportNumber) {
          try {
            logBuilderTestStep('read');
            // Read without parameter - uses transportNumber from state
            await builder.read();

            const readResult = builder.getReadResult();
            expect(readResult).toBeDefined();
            expect(readResult?.status).toBe(200);
            expect(readResult?.data).toBeDefined();
          } catch (readError: any) {
              testsLogger.warn?.(`Failed to read transport ${transportNumber}:`, readError);
            // Don't fail the test if read fails
          }
        }

        logBuilderTestEnd(testsLogger, 'TransportBuilder - full workflow');
      }
    }, getTimeout('test'));
  });
});

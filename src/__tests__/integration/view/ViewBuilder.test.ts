/**
 * Unit test for ViewBuilder
 * Tests fluent API with Promise chaining, error handling, and result storage
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - ViewBuilder library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=view/ViewBuilder
 */

import { AbapConnection, getTimeout, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { ViewBuilder } from '../../../core/view';
import { IAdtLogger } from '../../../utils/logger';
import { getView } from '../../../core/view/read';
import { getConfig } from '../../helpers/sessionConfig';
import { createOnLockCallback } from '../../helpers/lockHelper';
import {
  logBuilderTestError,
  logBuilderTestSkip,
  logBuilderTestStart,
  logBuilderTestSuccess,
  logBuilderTestEnd,
  logBuilderTestStep,
  getHttpStatusText
} from '../../helpers/builderTestLogger';
import { createConnectionLogger, createBuilderLogger, createTestsLogger } from '../../helpers/testLogger';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const {
getEnabledTestCase,
  getTestCaseDefinition,
  resolvePackageName,
  resolveTransportRequest,
  ensurePackageConfig,
  getOperationDelay
} = require('../../../../tests/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code (ViewBuilder) uses DEBUG_ADT_LIBS
const builderLogger: IAdtLogger = createBuilderLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: IAdtLogger = createTestsLogger();

describe('ViewBuilder', () => {
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

  /**
   * Pre-check: Verify test view doesn't exist
   * Safety: Skip test if object exists to avoid accidental deletion
   */
  async function ensureViewReady(viewName: string): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: true };
    }

    // Check if view exists
    try {
      await getView(connection, viewName);
      return {
        success: false,
        reason: `⚠️ SAFETY: View ${viewName} already exists! ` +
                `Delete manually or use different test name to avoid accidental deletion.`
      };
    } catch (error: any) {
      // 404 is expected - object doesn't exist, we can proceed
      if (error.response?.status !== 404) {
        return {
          success: false,
          reason: `Cannot verify view existence: ${error.message}`
        };
      }
    }

    return { success: true };
  }

  function getBuilderTestDefinition() {
    return getTestCaseDefinition('create_view', 'builder_view');
  }

  function buildBuilderConfig(testCase: any) {
    const params = testCase?.params || {};
    const packageName = resolvePackageName(params.package_name);
    if (!packageName) {
      throw new Error('package_name not configured for ViewBuilder test');
    }
    return {
      viewName: params.view_name,
      packageName,
      transportRequest: resolveTransportRequest(params.transport_request),
      description: params.description,
      ddlSource: params.ddl_source
    };
  }

  describe('Full workflow', () => {
    let testCase: any = null;
    let viewName: string | null = null;
    let skipReason: string | null = null;

    beforeEach(async () => {
      skipReason = null;
      testCase = null;
      viewName = null;

      if (!hasConfig) {
        skipReason = 'No SAP configuration';
        return;
      }

      const definition = getBuilderTestDefinition();
      if (!definition) {
        skipReason = 'Test case not defined in test-config.yaml';
        return;
      }

      const tc = getEnabledTestCase('create_view', 'builder_view');
      if (!tc) {
        skipReason = 'Test case disabled or not found';
        return;
      }

      const packageCheck = ensurePackageConfig(tc.params, 'ViewBuilder - full workflow');
      if (!packageCheck.success) {
        skipReason = packageCheck.reason || 'Default package is not configured';
        return;
      }

      testCase = tc;
      viewName = tc.params.view_name;

      // Cleanup before test
      if (viewName) {
        const cleanup = await ensureViewReady(viewName);
        if (!cleanup.success) {
          skipReason = cleanup.reason || 'Failed to cleanup view before test';
          testCase = null;
          viewName = null;
        }
      }
    });

    it('should execute full workflow and store all results', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(testsLogger, 'ViewBuilder - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(testsLogger, 'ViewBuilder - full workflow', skipReason);
        return;
      }

      if (!testCase || !viewName) {
        logBuilderTestSkip(testsLogger, 'ViewBuilder - full workflow', skipReason || 'Test case not available');
        return;
      }

      const builder = new ViewBuilder(connection, builderLogger, {
        ...buildBuilderConfig(testCase),
        onLock: createOnLockCallback('view', viewName, undefined, __filename)
      });

      try {
        logBuilderTestStep('validate');
      await builder
        .validate()
          .then(b => {
            logBuilderTestStep('create');
            return b.create();
          })
          .then(async b => {
            // Wait for SAP to finish create operation (includes lock/unlock internally)
            await new Promise(resolve => setTimeout(resolve, getOperationDelay('create', testCase)));
            logBuilderTestStep('lock');
            return b.lock();
          })
          .then(async b => {
            // Wait for SAP to commit lock operation
            await new Promise(resolve => setTimeout(resolve, getOperationDelay('lock', testCase)));
            logBuilderTestStep('update');
            return b.update();
          })
          .then(async b => {
            // Wait for SAP to commit update operation
            await new Promise(resolve => setTimeout(resolve, getOperationDelay('update', testCase)));
            logBuilderTestStep('check(inactive)');
            return b.check('inactive');
          })
          .then(b => {
            logBuilderTestStep('unlock');
            return b.unlock();
          })
          .then(async b => {
            // Wait for SAP to commit unlock operation
            await new Promise(resolve => setTimeout(resolve, getOperationDelay('unlock', testCase)));
            logBuilderTestStep('activate');
            return b.activate();
          })
          .then(b => {
            logBuilderTestStep('check(active)');
            return b.check('active');
          })
          .then(b => {
            logBuilderTestStep('delete (cleanup)');
            return b.delete();
          });

        const state = builder.getState();
        expect(state.createResult).toBeDefined();
        expect(state.activateResult).toBeDefined();
        expect(state.errors.length).toBe(0);

        logBuilderTestSuccess(testsLogger, 'ViewBuilder - full workflow');
      } catch (error: any) {
        const statusText = getHttpStatusText(error);
        // Extract error message from error object (may be in message or response.data)
        const errorMsg = error.message || '';
        const errorData = error.response?.data || '';
        const errorText = typeof errorData === 'string' ? errorData : JSON.stringify(errorData);
        const fullErrorText = `${errorMsg} ${errorText}`.toLowerCase();

        // "Already exists" errors should fail the test (cleanup must work)
        const enhancedError = statusText !== 'HTTP ?'
          ? Object.assign(new Error(`[${statusText}] ${error.message}`), { stack: error.stack })
          : error;
        logBuilderTestError(testsLogger, 'ViewBuilder - full workflow', enhancedError);
        throw enhancedError;
      } finally {
        // Read the created view before cleanup
        if (viewName) {
          try {
            logBuilderTestStep('read');
            await builder.read();

            const readResult = builder.getReadResult();
            expect(readResult).toBeDefined();
            expect(readResult?.status).toBe(200);
            expect(readResult?.data).toBeDefined();
          } catch (readError) {
            // Log warning but don't fail the test if read fails
            builderLogger.warn?.(`Failed to read view ${viewName}:`, readError);
          }
        }

        await builder.forceUnlock().catch(() => {});
        logBuilderTestEnd(testsLogger, 'ViewBuilder - full workflow');
      }
    }, getTimeout('default'));
  });

});

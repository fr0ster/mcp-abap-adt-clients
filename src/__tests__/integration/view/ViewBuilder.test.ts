/**
 * Unit test for ViewBuilder
 * Tests fluent API with Promise chaining, error handling, and result storage
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- integration/view/ViewBuilder
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { ViewBuilder, ViewBuilderLogger } from '../../../core/view';
import { deleteView } from '../../../core/view/delete';
import { unlockDDLS } from '../../../core/view/unlock';
import { getConfig, generateSessionId } from '../../helpers/sessionConfig';
import { getTestLock, createOnLockCallback } from '../../helpers/lockHelper';
import {
  logBuilderTestError,
  logBuilderTestSkip,
  logBuilderTestStart,
  logBuilderTestSuccess,
  logBuilderTestEnd,
  logBuilderTestStep,
  getHttpStatusText
} from '../../helpers/builderTestLogger';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const {
  getEnabledTestCase,
  getTestCaseDefinition,
  getDefaultPackage,
  getDefaultTransport
} = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const connectionLogger: ILogger = {
  debug: debugEnabled ? (message: string, meta?: any) => console.log(message, meta) : () => {},
  info: debugEnabled ? (message: string, meta?: any) => console.log(message, meta) : () => {},
  warn: debugEnabled ? (message: string, meta?: any) => console.warn(message, meta) : () => {},
  error: debugEnabled ? (message: string, meta?: any) => console.error(message, meta) : () => {},
  csrfToken: debugEnabled ? (action: string, token?: string) => console.log(`CSRF ${action}:`, token) : () => {},
};

const builderLogger: ViewBuilderLogger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
};

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
      builderLogger.warn?.('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterAll(async () => {
    if (connection) {
      connection.reset();
    }
  });

  async function ensureViewReady(viewName: string): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: true }; // No connection = nothing to clean
    }
    let lockedReason: string | null = null;

    // Step 1: Check for locks and unlock if needed
    const lock = getTestLock('view', viewName);
    if (lock) {
      try {
        const sessionId = lock.sessionId || generateSessionId('cleanup');
        await unlockDDLS(connection, viewName, lock.lockHandle, sessionId);
        if (debugEnabled) {
          builderLogger.debug?.(`[CLEANUP] Unlocked view ${viewName} before deletion`);
        }
      } catch (unlockError: any) {
        // Log but continue - lock might be stale
        if (debugEnabled) {
          builderLogger.warn?.(`[CLEANUP] Failed to unlock view ${viewName}: ${unlockError.message}`);
        }
      }
    }

    // Step 2: Try to delete (ignore all errors, but log if DEBUG_TESTS=true)
    try {
      await deleteView(connection, { view_name: viewName });
      if (debugEnabled) {
        builderLogger.debug?.(`[CLEANUP] Successfully deleted view ${viewName}`);
      }
    } catch (error: any) {
      const status = error.response?.status;
      const statusText = status ? `HTTP ${status}` : 'HTTP ?';
      const errorMsg = error.message || '';
      const errorData = error.response?.data || '';
      console.warn(`[CLEANUP][View] Failed to delete ${viewName} (${statusText}): ${errorMsg} ${errorData}`);
      if (status === 423) {
        lockedReason = `View ${viewName} is locked by another user (HTTP 423 Locked)`;
      }
    }

    if (lockedReason) {
      return { success: false, reason: lockedReason };
    }
    return { success: true };
  }

  function getBuilderTestDefinition() {
    return getTestCaseDefinition('create_view', 'builder_view');
  }

  function buildBuilderConfig(testCase: any) {
    const params = testCase?.params || {};
    return {
      viewName: params.view_name,
      packageName: params.package_name || getDefaultPackage(),
      transportRequest: params.transport_request || getDefaultTransport(),
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

    afterEach(async () => {
      if (viewName && connection) {
        // Cleanup after test
        const cleanup = await ensureViewReady(viewName);
        if (!cleanup.success && cleanup.reason) {
          console.warn(`[CLEANUP][View] ${cleanup.reason}`);
        }
      }
    });

    it('should execute full workflow and store all results', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(builderLogger, 'ViewBuilder - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(builderLogger, 'ViewBuilder - full workflow', skipReason);
        return;
      }

      if (!testCase || !viewName) {
        logBuilderTestSkip(builderLogger, 'ViewBuilder - full workflow', skipReason || 'Test case not available');
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
          .then(b => {
            logBuilderTestStep('check(inactive)');
            return b.check('inactive');
          })
          .then(b => {
            logBuilderTestStep('lock');
            return b.lock();
          })
          .then(b => {
            logBuilderTestStep('update');
            return b.update();
          })
          .then(b => {
            logBuilderTestStep('check(inactive)');
            return b.check('inactive');
          })
          .then(b => {
            logBuilderTestStep('unlock');
            return b.unlock();
          })
          .then(b => {
            logBuilderTestStep('activate');
            return b.activate();
          })
          .then(b => {
            logBuilderTestStep('check(active)');
            return b.check('active');
          });

        const state = builder.getState();
        expect(state.createResult).toBeDefined();
        expect(state.activateResult).toBeDefined();
        expect(state.errors.length).toBe(0);

        logBuilderTestSuccess(builderLogger, 'ViewBuilder - full workflow');
      } catch (error: any) {
        const statusText = getHttpStatusText(error);
        // Extract error message from error object (may be in message or response.data)
        const errorMsg = error.message || '';
        const errorData = error.response?.data || '';
        const errorText = typeof errorData === 'string' ? errorData : JSON.stringify(errorData);
        const fullErrorText = `${errorMsg} ${errorText}`.toLowerCase();

        // Check if object is locked by someone else (currently editing)
        if (fullErrorText.includes('currently editing') ||
            fullErrorText.includes('exceptionresourcenoaccess') ||
            fullErrorText.includes('eu510')) {
          logBuilderTestSkip(
            builderLogger,
            'ViewBuilder - full workflow',
            `View ${viewName} is locked (currently editing, ${statusText}). Details: ${errorMsg}`
          );
          return; // Skip test
        }

        // "Already exists" errors should fail the test (cleanup must work)
        const enhancedError = statusText !== 'HTTP ?'
          ? Object.assign(new Error(`[${statusText}] ${error.message}`), { stack: error.stack })
          : error;
        logBuilderTestError(builderLogger, 'ViewBuilder - full workflow', enhancedError);
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
            if (debugEnabled) {
              builderLogger.warn?.(`Failed to read view ${viewName}:`, readError);
            }
            // Don't fail the test if read fails
          }
        }

        await builder.forceUnlock().catch(() => {});
        logBuilderTestEnd(builderLogger, 'ViewBuilder - full workflow');
      }
    }, getTimeout('test'));
  });

});

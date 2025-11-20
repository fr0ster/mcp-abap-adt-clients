/**
 * Unit test for TableBuilder
 * Tests fluent API with Promise chaining, error handling, and result storage
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- integration/table/TableBuilder
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { TableBuilder, TableBuilderLogger } from '../../../core/table';
import { deleteTable } from '../../../core/table/delete';
import { unlockTable } from '../../../core/table/unlock';
import { isCloudEnvironment } from '../../../core/shared/systemInfo';
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
  resolvePackageName,
  resolveTransportRequest,
  ensurePackageConfig,
  resolveStandardObject
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

const builderLogger: TableBuilderLogger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
};

describe('TableBuilder', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let isCloudSystem = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      hasConfig = true;
      // Check if this is a cloud system
      isCloudSystem = await isCloudEnvironment(connection);
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

  async function ensureTableReady(tableName: string): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: true }; // No connection = nothing to clean
    }

    let lockedReason: string | null = null;

    // Step 1: Check for locks and unlock if needed
    const lock = getTestLock('table', tableName);
    if (lock) {
      try {
        const sessionId = lock.sessionId || generateSessionId('cleanup');
        await unlockTable(connection, tableName, lock.lockHandle, sessionId);
        if (debugEnabled) {
          builderLogger.debug?.(`[CLEANUP] Unlocked table ${tableName} before deletion`);
        }
      } catch (unlockError: any) {
        // Log but continue - lock might be stale
        if (debugEnabled) {
          builderLogger.warn?.(`[CLEANUP] Failed to unlock table ${tableName}: ${unlockError.message}`);
        }
      }
    }

    // Step 2: Try to delete (ignore all errors, but log if DEBUG_TESTS=true)
    try {
      await deleteTable(connection, { table_name: tableName });
      if (debugEnabled) {
        builderLogger.debug?.(`[CLEANUP] Successfully deleted table ${tableName}`);
      }
    } catch (error: any) {
      const status = error.response?.status;
      const statusText = status ? `HTTP ${status}` : 'HTTP ?';
      const errorMsg = error.message || '';
      const errorData = error.response?.data || '';
      console.warn(`[CLEANUP][Table] Failed to delete ${tableName} (${statusText}): ${errorMsg} ${errorData}`);
      if (status === 423) {
        lockedReason = `Table ${tableName} is locked by another user (HTTP 423 Locked)`;
      }
    }

    if (lockedReason) {
      return { success: false, reason: lockedReason };
    }
    return { success: true };
  }

  function getBuilderTestDefinition() {
    return getTestCaseDefinition('create_table', 'builder_table');
  }

  function buildBuilderConfig(testCase: any) {
    const params = testCase?.params || {};
    const packageName = resolvePackageName(params.package_name);
    if (!packageName) {
      throw new Error('package_name not configured for TableBuilder test');
    }
    return {
      tableName: params.table_name,
      packageName,
      transportRequest: resolveTransportRequest(params.transport_request),
      description: params.description,
      ddlCode: params.ddl_code
    };
  }

  describe('Full workflow', () => {
    let testCase: any = null;
    let tableName: string | null = null;
    let skipReason: string | null = null;

    beforeEach(async () => {
      skipReason = null;
      testCase = null;
      tableName = null;

      if (!hasConfig) {
        skipReason = 'No SAP configuration';
        return;
      }

      const definition = getBuilderTestDefinition();
      if (!definition) {
        skipReason = 'Test case not defined in test-config.yaml';
        return;
      }

      const tc = getEnabledTestCase('create_table', 'builder_table');
      if (!tc) {
        skipReason = 'Test case disabled or not found';
        return;
      }

      const packageCheck = ensurePackageConfig(tc.params, 'TableBuilder - full workflow');
      if (!packageCheck.success) {
        skipReason = packageCheck.reason || 'Default package is not configured';
        return;
      }

      testCase = tc;
      tableName = tc.params.table_name;

      // Cleanup before test
      if (tableName) {
        const cleanup = await ensureTableReady(tableName);
        if (!cleanup.success) {
          skipReason = cleanup.reason || 'Failed to cleanup table before test';
          testCase = null;
          tableName = null;
        }
      }
    });

    afterEach(async () => {
      if (tableName && connection) {
        // Cleanup after test
        const cleanup = await ensureTableReady(tableName);
        if (!cleanup.success && cleanup.reason) {
          console.warn(`[CLEANUP][Table] ${cleanup.reason}`);
        }
      }
    });

    it('should execute full workflow and store all results', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(builderLogger, 'TableBuilder - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(builderLogger, 'TableBuilder - full workflow', skipReason);
        return;
      }

      if (!testCase || !tableName) {
        logBuilderTestSkip(
          builderLogger,
          'TableBuilder - full workflow',
          skipReason || 'Test case not available'
        );
        return;
      }

      const builder = new TableBuilder(connection, builderLogger, {
        ...buildBuilderConfig(testCase),
        onLock: createOnLockCallback('table', tableName, undefined, __filename)
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
            logBuilderTestStep('lock');
            return b.lock();
          })
          .then(b => {
            logBuilderTestStep('update');
            return b.update();
          })
          .then(b => {
            logBuilderTestStep('check(inactive)');
            return b.check('abapCheckRun');
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
            return b.check('abapCheckRun');
          });

        const state = builder.getState();
        expect(state.createResult).toBeDefined();
        expect(state.activateResult).toBeDefined();
        expect(state.errors.length).toBe(0);

        logBuilderTestSuccess(builderLogger, 'TableBuilder - full workflow');
      } catch (error: any) {
        const statusText = getHttpStatusText(error);
        // Extract error message from error object
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
            'TableBuilder - full workflow',
            `Table ${tableName} is locked (currently editing, ${statusText}). Details: ${errorMsg}`
          );
          return; // Skip test
        }

        // "Already exists" errors should fail the test (cleanup must work)
        const enhancedError = statusText !== 'HTTP ?'
          ? Object.assign(new Error(`[${statusText}] ${error.message}`), { stack: error.stack })
          : error;
        logBuilderTestError(builderLogger, 'TableBuilder - full workflow', enhancedError);
        throw enhancedError;
      } finally {
        await builder.forceUnlock().catch(() => {});
        logBuilderTestEnd(builderLogger, 'TableBuilder - full workflow');
      }
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP table', async () => {
      const testCase = getTestCaseDefinition('create_table', 'builder_table');
      const standardObject = resolveStandardObject('table', isCloudSystem, testCase);

      if (!standardObject) {
        logBuilderTestStart(builderLogger, 'TableBuilder - read standard object', {
          name: 'read_standard',
          params: {}
        });
        logBuilderTestSkip(builderLogger, 'TableBuilder - read standard object',
          `Standard table not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`);
        return;
      }

      const standardTableName = standardObject.name;
      logBuilderTestStart(builderLogger, 'TableBuilder - read standard object', {
        name: 'read_standard',
        params: { table_name: standardTableName }
      });

      if (!hasConfig) {
        logBuilderTestSkip(builderLogger, 'TableBuilder - read standard object', 'No SAP configuration');
        return;
      }

      const builder = new TableBuilder(
        connection,
        builderLogger,
        {
          tableName: standardTableName,
          packageName: 'SAP' // Standard package
        }
      );

      try {
        logBuilderTestStep('read');
        await builder.read();

        const result = builder.getReadResult();
        expect(result).toBeDefined();
        expect(result?.status).toBe(200);
        expect(result?.data).toBeDefined();

        logBuilderTestSuccess(builderLogger, 'TableBuilder - read standard object');
      } catch (error) {
        logBuilderTestError(builderLogger, 'TableBuilder - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(builderLogger, 'TableBuilder - read standard object');
      }
    }, getTimeout('test'));
  });
});

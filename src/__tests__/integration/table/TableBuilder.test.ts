/**
 * Unit test for TableBuilder
 * Tests fluent API with Promise chaining, error handling, and result storage
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- integration/table/TableBuilder
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { TableBuilder, TableBuilderLogger } from '../../../core/table';
import { getTable } from '../../../core/table/read';
import { isCloudEnvironment } from '../../../core/shared/systemInfo';
import { getConfig } from '../../helpers/sessionConfig';
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

  /**
   * Pre-check: Verify test table doesn't exist
   * Safety: Skip test if object exists to avoid accidental deletion
   */
  async function ensureTableReady(tableName: string): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: true };
    }

    // Check if table exists
    try {
      await getTable(connection, tableName);
      return {
        success: false,
        reason: `⚠️ SAFETY: Table ${tableName} already exists! ` +
                `Delete manually or use different test name to avoid accidental deletion.`
      };
    } catch (error: any) {
      // 404 is expected - object doesn't exist, we can proceed
      if (error.response?.status !== 404) {
        return {
          success: false,
          reason: `Cannot verify table existence: ${error.message}`
        };
      }
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
        ...buildBuilderConfig(testCase)
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
            await new Promise(resolve => setTimeout(resolve, 1000));
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
          })
          .then(b => {
            logBuilderTestStep('delete (cleanup)');
            return b.delete();
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

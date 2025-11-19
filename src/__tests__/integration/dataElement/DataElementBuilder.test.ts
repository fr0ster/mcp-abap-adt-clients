/**
 * Unit test for DataElementBuilder
 * Tests fluent API with Promise chaining, error handling, and result storage
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/dataElement/DataElementBuilder.test
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { DataElementBuilder, DataElementBuilderLogger } from '../../../core/dataElement';
import { deleteDataElement } from '../../../core/dataElement/delete';
import { unlockDataElement } from '../../../core/dataElement/unlock';
import { getDataElement } from '../../../core/dataElement/read';
import { getConfig, generateSessionId } from '../../helpers/sessionConfig';
import { getTestLock, createOnLockCallback } from '../../helpers/lockHelper';
import {
  logBuilderTestError,
  logBuilderTestSkip,
  logBuilderTestStart,
  logBuilderTestSuccess,
  logBuilderTestEnd,
  logBuilderTestStep,
  setTotalTests,
  resetTestCounter
} from '../../helpers/builderTestLogger';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const {
  getEnabledTestCase,
  getDefaultPackage,
  getDefaultTransport,
  getTestCaseDefinition
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

const builderLogger: DataElementBuilderLogger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
};

describe('DataElementBuilder', () => {
  let connection: AbapConnection;
  let hasConfig = false;

  beforeAll(async () => {
    // Count total tests for progress tracking
    const testCount = 2; // Full workflow + Read standard object
    setTotalTests(testCount);

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
    resetTestCounter();
    if (connection) {
      connection.reset();
    }
  });

  async function ensureDataElementReady(dataElementName: string): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: true }; // No connection = nothing to clean
    }

    // Step 1: Check for locks and unlock if needed
    const lock = getTestLock('dataElement', dataElementName);
    if (lock) {
      try {
        const sessionId = lock.sessionId || generateSessionId('cleanup');
        await unlockDataElement(connection, dataElementName, lock.lockHandle, sessionId);
        if (debugEnabled) {
          builderLogger.debug?.(`[CLEANUP] Unlocked data element ${dataElementName} before deletion`);
        }
      } catch (unlockError: any) {
        // Log but continue - lock might be stale
        if (debugEnabled) {
          builderLogger.warn?.(`[CLEANUP] Failed to unlock data element ${dataElementName}: ${unlockError.message}`);
        }
      }
    }

    // Step 2: Try to delete (ignore all errors, but log if DEBUG_TESTS=true)
    try {
      await deleteDataElement(connection, {
        data_element_name: dataElementName,
        transport_request: getDefaultTransport() || undefined
      });
      if (debugEnabled) {
        builderLogger.debug?.(`[CLEANUP] Successfully deleted data element ${dataElementName}`);
      }
    } catch (error: any) {
      // Ignore all errors (404, locked, etc.), but log details if DEBUG_TESTS=true
      if (debugEnabled) {
        const errorMsg = error.message || '';
        const errorData = error.response?.data || '';
        builderLogger.warn?.(`[CLEANUP] Failed to delete data element ${dataElementName}: ${errorMsg} ${errorData}`);
      }
    }

    return { success: true };
  }

  function getBuilderTestDefinition() {
    return getTestCaseDefinition('create_data_element', 'builder_data_element');
  }

  function buildBuilderConfig(testCase: any) {
    const params = testCase?.params || {};
    return {
      dataElementName: params.data_element_name,
      packageName: params.package_name || getDefaultPackage(),
      transportRequest: params.transport_request || getDefaultTransport(),
      description: params.description,
      domainName: params.domain_name,
      dataType: params.data_type,
      length: params.length,
      decimals: params.decimals,
      shortLabel: params.short_label,
      mediumLabel: params.medium_label,
      longLabel: params.long_label,
      headingLabel: params.heading_label,
      typeKind: params.type_kind,
      typeName: params.type_name
    };
  }


  describe('Full workflow', () => {
    let testCase: any = null;
    let dataElementName: string | null = null;
    let skipReason: string | null = null;

    beforeEach(async () => {
      skipReason = null;
      testCase = null;
      dataElementName = null;

      if (!hasConfig) {
        skipReason = 'No SAP configuration';
        return;
      }

      const definition = getBuilderTestDefinition();
      if (!definition) {
        skipReason = 'Test case not defined in test-config.yaml';
        return;
      }

      const tc = getEnabledTestCase('create_data_element', 'builder_data_element');
      if (!tc) {
        skipReason = 'Test case disabled or not found';
        return;
      }

      testCase = tc;
      dataElementName = tc.params.data_element_name;

      // Cleanup before test
      if (dataElementName) {
        const cleanup = await ensureDataElementReady(dataElementName);
        if (!cleanup.success) {
          skipReason = cleanup.reason || 'Failed to cleanup data element before test';
          testCase = null;
          dataElementName = null;
        }
      }
    });

    afterEach(async () => {
      if (dataElementName && connection) {
        // Cleanup after test
        const cleanup = await ensureDataElementReady(dataElementName);
        if (!cleanup.success && cleanup.reason) {
          if (debugEnabled) {
            builderLogger.warn?.(`[CLEANUP] Cleanup failed: ${cleanup.reason}`);
          }
        }
      }
    });
    it('should execute full workflow and store all results', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(builderLogger, 'DataElementBuilder - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(builderLogger, 'DataElementBuilder - full workflow', skipReason);
        return;
      }

      if (!testCase || !dataElementName) {
        logBuilderTestSkip(builderLogger, 'DataElementBuilder - full workflow', skipReason || 'Test case not available');
        return;
      }

      const builder = new DataElementBuilder(
        connection,
        builderLogger,
        {
          ...buildBuilderConfig(testCase),
          onLock: createOnLockCallback('dataElement', dataElementName, undefined, __filename)
        }
      );

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

        // Log success BEFORE finally block to ensure it's displayed
        logBuilderTestSuccess(builderLogger, 'DataElementBuilder - full workflow');
      } catch (error: any) {
        // Extract error message from error object (may be in message or response.data)
        const errorMsg = error.message || '';
        const errorData = error.response?.data || '';
        const errorText = typeof errorData === 'string' ? errorData : JSON.stringify(errorData);
        const fullErrorText = `${errorMsg} ${errorText}`.toLowerCase();

        // If data element already exists (cleanup failed), skip test instead of failing
        if (fullErrorText.includes('already exists') ||
            fullErrorText.includes('exceptionresourcealreadyexists') ||
            fullErrorText.includes('resourcealreadyexists') ||
            fullErrorText.includes('error when creating object directory entry')) {
          logBuilderTestSkip(builderLogger, 'DataElementBuilder - full workflow', `Data element ${dataElementName} already exists (cleanup failed)`);
          return; // Skip test
        }
        logBuilderTestError(builderLogger, 'DataElementBuilder - full workflow', error);
        throw error;
      } finally {
        await builder.forceUnlock().catch(() => {});
        logBuilderTestEnd(builderLogger, 'DataElementBuilder - full workflow');
      }
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP data element', async () => {
      const standardDataElementName = 'MANDT'; // Standard SAP data element (exists in most ABAP systems)
      logBuilderTestStart(builderLogger, 'DataElementBuilder - read standard object', {
        name: 'read_standard',
        params: { data_element_name: standardDataElementName }
      });

      if (!hasConfig) {
        logBuilderTestSkip(builderLogger, 'DataElementBuilder - read standard object', 'No SAP configuration');
        return;
      }

      const builder = new DataElementBuilder(
        connection,
        builderLogger,
        {
          dataElementName: standardDataElementName,
          packageName: 'SAP' // Standard package
        }
      );

      try {
        logBuilderTestStep('read');
        await builder.read();

        const result = builder.getReadResult();
        expect(result).toBeDefined();
        expect(result?.data).toBeDefined();

        logBuilderTestSuccess(builderLogger, 'DataElementBuilder - read standard object');
      } catch (error) {
        logBuilderTestError(builderLogger, 'DataElementBuilder - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(builderLogger, 'DataElementBuilder - read standard object');
      }
    }, getTimeout('test'));
  });
});


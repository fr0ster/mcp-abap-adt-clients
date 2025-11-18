/**
 * Unit test for DataElementBuilder
 * Tests fluent API with Promise chaining, error handling, and result storage
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/dataElement/DataElementBuilder.test
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { DataElementBuilder, DataElementBuilderLogger } from '../../../core/dataElement';
import { deleteDataElement } from '../../../core/dataElement/delete';
import { getDataElement } from '../../../core/dataElement/read';
import { getConfig } from '../../helpers/sessionConfig';
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

  beforeAll(() => {
    // Count total tests for progress tracking
    const testCount = 2; // Full workflow + Read standard object
    setTotalTests(testCount);
  });

  afterAll(() => {
    resetTestCounter();
  });

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      hasConfig = true;
    } catch (error) {
      builderLogger.warn?.('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterEach(async () => {
    if (connection) {
      connection.reset();
    }
  });

  async function ensureDataElementReady(dataElementName: string): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: false, reason: 'No connection' };
    }

    // Try to delete if exists
    try {
      await deleteDataElement(connection, {
        data_element_name: dataElementName,
        transport_request: getDefaultTransport() || undefined
      });
      if (debugEnabled) {
        builderLogger.debug?.(`[CLEANUP] Data element ${dataElementName} deleted`);
      }
    } catch (error: any) {
      const rawMessage =
        error?.response?.data ||
        error?.message ||
        (typeof error === 'string' ? error : JSON.stringify(error));

      // 404 = object doesn't exist, that's fine
      if (
        error.response?.status === 404 ||
        rawMessage?.toLowerCase?.().includes('not found') ||
        rawMessage?.toLowerCase?.().includes('does not exist')
      ) {
        if (debugEnabled) {
          builderLogger.debug?.(`[CLEANUP] Data element ${dataElementName} already absent`);
        }
        return { success: true };
      }

      // Other errors - log only in debug mode
      if (debugEnabled) {
        builderLogger.warn?.(`[CLEANUP] Failed to delete ${dataElementName}:`, rawMessage);
      }
    }

    // Verify object doesn't exist (wait a bit for async deletion)
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      await getDataElement(connection, dataElementName);
      // Object still exists - check if it's locked
      const errorMsg = `Data element ${dataElementName} still exists after cleanup attempt (may be locked or in use)`;
      if (debugEnabled) {
        builderLogger.warn?.(`[CLEANUP] ${errorMsg}`);
      }
      return { success: false, reason: errorMsg };
    } catch (error: any) {
      // 404 = object doesn't exist, cleanup successful
      if (error.response?.status === 404) {
        return { success: true };
      }
      // Other error - object might be locked
      const errorMsg = `Cannot verify cleanup status for ${dataElementName} (may be locked)`;
      if (debugEnabled) {
        builderLogger.warn?.(`[CLEANUP] ${errorMsg}:`, error.message);
      }
      return { success: false, reason: errorMsg };
    }
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

    beforeEach(async () => {
      if (!hasConfig) {
        testCase = null;
        dataElementName = null;
        return;
      }

      const definition = getBuilderTestDefinition();
      if (!definition) {
        testCase = null;
        dataElementName = null;
        return;
      }

      const tc = getEnabledTestCase('create_data_element', 'builder_data_element');
      if (!tc) {
        testCase = null;
        dataElementName = null;
        return;
      }

      testCase = tc;
      dataElementName = tc.params.data_element_name;

      // Cleanup before test
      if (dataElementName) {
        await ensureDataElementReady(dataElementName);
      }
    });

    afterEach(async () => {
      if (dataElementName && connection) {
        // Cleanup after test
        await ensureDataElementReady(dataElementName);
      }
    });
    it('should execute full workflow and store all results', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(builderLogger, 'DataElementBuilder - full workflow', definition);

      if (!definition) {
        logBuilderTestSkip(
          builderLogger,
          'DataElementBuilder - full workflow',
          'Test case not defined in test-config.yaml'
        );
        return;
      }

      if (!hasConfig) {
        logBuilderTestSkip(builderLogger, 'DataElementBuilder - full workflow', 'No SAP configuration');
        return;
      }

      if (!testCase || !dataElementName) {
        logBuilderTestSkip(builderLogger, 'DataElementBuilder - full workflow', 'Test case disabled or not found');
        return;
      }

      const builder = new DataElementBuilder(
        connection,
        builderLogger,
        buildBuilderConfig(testCase)
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
      } catch (error) {
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


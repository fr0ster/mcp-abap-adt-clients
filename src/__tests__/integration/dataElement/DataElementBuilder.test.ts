/**
 * Unit test for DataElementBuilder
 * Tests fluent API with Promise chaining, error handling, and result storage
 *
 * Enable debug logs:
 *   DEBUG_ADT_E2E_TESTS=true   - E2E test execution logs
 *   DEBUG_ADT_LIBS=true        - DataElementBuilder library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=dataElement/DataElementBuilder
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { DataElementBuilder } from '../../../core/dataElement';
import { IAdtLogger } from '../../../utils/logger';
import { getDataElement } from '../../../core/dataElement/read';
import { isCloudEnvironment } from '../../../utils/systemInfo';
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
import { createBuilderLogger, createConnectionLogger, createTestsLogger, isDebugEnabled } from '../../helpers/testLogger';
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

// E2E tests use DEBUG_ADT_E2E_TESTS for test code
// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
// Library code (DataElementBuilder) uses DEBUG_ADT_LIBS

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code uses DEBUG_ADT_LIBS
const builderLogger: IAdtLogger = createBuilderLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: IAdtLogger = createTestsLogger();

describe('DataElementBuilder', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let isCloudSystem = false;

  beforeAll(async () => {
    // Count total tests for progress tracking
    const testCount = 2; // Full workflow + Read standard object
    setTotalTests(testCount);

    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      // Check if this is a cloud system
      isCloudSystem = await isCloudEnvironment(connection);
      hasConfig = true;
    } catch (error) {
      testsLogger.warn?.('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterAll(async () => {
    resetTestCounter();
    if (connection) {
      connection.reset();
    }
  });

  /**
   * Pre-check: Verify test data element doesn't exist
   * Safety: Skip test if object exists to avoid accidental deletion
   */
  async function ensureDataElementReady(dataElementName: string): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: true };
    }

    // Check if data element exists
    try {
      await getDataElement(connection, dataElementName);
      return {
        success: false,
        reason: `⚠️ SAFETY: Data Element ${dataElementName} already exists! ` +
                `Delete manually or use different test name to avoid accidental deletion.`
      };
    } catch (error: any) {
      // 404 is expected - object doesn't exist, we can proceed
      if (error.response?.status !== 404) {
        return {
          success: false,
          reason: `Cannot verify data element existence: ${error.message}`
        };
      }
    }

    return { success: true };
  }

  function getBuilderTestDefinition() {
    return getTestCaseDefinition('create_data_element', 'builder_data_element');
  }

  function buildBuilderConfig(testCase: any) {
    const params = testCase?.params || {};
    const packageName = resolvePackageName(params.package_name);
    if (!packageName) {
      throw new Error('package_name not configured for DataElementBuilder test');
    }
    return {
      dataElementName: params.data_element_name,
      packageName,
      transportRequest: resolveTransportRequest(params.transport_request),
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

      const packageCheck = ensurePackageConfig(tc.params, 'DataElementBuilder - full workflow');
      if (!packageCheck.success) {
        skipReason = packageCheck.reason || 'Default package is not configured';
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

    it('should execute full workflow and store all results', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(testsLogger, 'DataElementBuilder - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(testsLogger, 'DataElementBuilder - full workflow', skipReason);
        return;
      }

      if (!testCase || !dataElementName) {
        logBuilderTestSkip(testsLogger, 'DataElementBuilder - full workflow', skipReason || 'Test case not available');
        return;
      }

      const builder = new DataElementBuilder(
        connection,
        builderLogger,
        {
          ...buildBuilderConfig(testCase)
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
          })
          .then(b => {
            logBuilderTestStep('delete (cleanup)');
            return b.delete();
          });

      const state = builder.getState();
      expect(state.createResult).toBeDefined();
      expect(state.activateResult).toBeDefined();
      expect(state.errors.length).toBe(0);

        // Log success BEFORE finally block to ensure it's displayed
        logBuilderTestSuccess(testsLogger, 'DataElementBuilder - full workflow');
      } catch (error: any) {
        // Extract error message from error object (may be in message or response.data)
        const errorMsg = error.message || '';
        const errorData = error.response?.data || '';
        const errorText = typeof errorData === 'string' ? errorData : JSON.stringify(errorData);
        const fullErrorText = `${errorMsg} ${errorText}`.toLowerCase();

        // "Already exists" errors should fail the test (cleanup must work)
        logBuilderTestError(testsLogger, 'DataElementBuilder - full workflow', error);
        throw error;
      } finally {
        // Cleanup: force unlock in case of failure
        await builder.forceUnlock().catch(() => {});
        logBuilderTestEnd(testsLogger, 'DataElementBuilder - full workflow');
      }
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP data element', async () => {
      const testCase = getTestCaseDefinition('create_data_element', 'builder_data_element');
      const standardObject = resolveStandardObject('dataElement', isCloudSystem, testCase);

      if (!standardObject) {
        logBuilderTestStart(testsLogger, 'DataElementBuilder - read standard object', {
          name: 'read_standard',
          params: {}
        });
        logBuilderTestSkip(testsLogger, 'DataElementBuilder - read standard object',
          `Standard data element not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`);
        return;
      }

      const standardDataElementName = standardObject.name;
      logBuilderTestStart(testsLogger, 'DataElementBuilder - read standard object', {
        name: 'read_standard',
        params: { data_element_name: standardDataElementName }
      });

      if (!hasConfig) {
        logBuilderTestSkip(testsLogger, 'DataElementBuilder - read standard object', 'No SAP configuration');
        return;
      }

      const builder = new DataElementBuilder(
        connection,
        builderLogger,
        {
          dataElementName: standardDataElementName,
          packageName: 'SAP', // Standard package
          description: '' // Not used for read operations
        }
      );

      try {
        logBuilderTestStep('read');
        await builder.read();

        const result = builder.getReadResult();
        expect(result).toBeDefined();
        expect(result?.data).toBeDefined();

        logBuilderTestSuccess(testsLogger, 'DataElementBuilder - read standard object');
      } catch (error) {
        logBuilderTestError(testsLogger, 'DataElementBuilder - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'DataElementBuilder - read standard object');
      }
    }, getTimeout('test'));
  });
});


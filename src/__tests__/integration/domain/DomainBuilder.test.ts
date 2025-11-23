/**
 * Integration test for DomainBuilder
 * Tests fluent API with Promise chaining, error handling, and result storage
 *
 * Enable debug logs:
 *   DEBUG_ADT_E2E_TESTS=true   - E2E test execution logs
 *   DEBUG_ADT_LIBS=true        - DomainBuilder library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=domain/DomainBuilder
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { DomainBuilder } from '../../../core/domain';
import { IAdtLogger } from '../../../utils/logger';
import { getDomain } from '../../../core/domain/read';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import { getConfig } from '../../helpers/sessionConfig';
import {
  logBuilderTestStart,
  logBuilderTestSkip,
  logBuilderTestSuccess,
  logBuilderTestError,
  logBuilderTestEnd,
  logBuilderTestStep
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
  resolveStandardObject,
  getTimeout,
  getOperationDelay
} = require('../../../../tests/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// E2E tests use DEBUG_ADT_E2E_TESTS for test code
// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
// Library code (DomainBuilder) uses DEBUG_ADT_LIBS

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code uses DEBUG_ADT_LIBS
const builderLogger: IAdtLogger = createBuilderLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: IAdtLogger = createTestsLogger();

describe('DomainBuilder', () => {
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
   * Pre-check: Verify test domain doesn't exist
   * Safety: Skip test if object exists to avoid accidental deletion
   */
  async function ensureDomainReady(domainName: string): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: true };
    }

    // Check if domain exists
    try {
      await getDomain(connection, domainName);
      return {
        success: false,
        reason: `⚠️ SAFETY: Domain ${domainName} already exists! ` +
                `Delete manually or use different test name to avoid accidental deletion.`
      };
    } catch (error: any) {
      // 404 is expected - object doesn't exist, we can proceed
      if (error.response?.status !== 404) {
        return {
          success: false,
          reason: `Cannot verify domain existence: ${error.message}`
        };
      }
    }

    return { success: true };
  }

  function getBuilderTestDefinition() {
    return getTestCaseDefinition('create_domain', 'builder_domain');
  }

  function buildBuilderConfig(testCase: any) {
    const params = testCase?.params || {};
    const packageName = resolvePackageName(params.package_name);
    if (!packageName) {
      throw new Error('package_name not configured for DomainBuilder test');
    }
    return {
      domainName: params.domain_name,
      packageName,
      transportRequest: resolveTransportRequest(params.transport_request),
      description: params.description,
      datatype: params.datatype || 'CHAR',
      length: params.length || 10,
      decimals: params.decimals,
      conversion_exit: params.conversion_exit,
      lowercase: params.lowercase,
      sign_exists: params.sign_exists,
      value_table: params.value_table,
      fixed_values: params.fixed_values
    };
  }

  describe('Full workflow', () => {
    let testCase: any = null;
    let domainName: string | null = null;
    let skipReason: string | null = null;

    beforeEach(async () => {
      skipReason = null;
      testCase = null;
      domainName = null;

      if (!hasConfig) {
        skipReason = 'No SAP configuration';
        return;
      }

      const definition = getBuilderTestDefinition();
      if (!definition) {
        skipReason = 'Test case not defined in test-config.yaml';
        return;
      }

      const tc = getEnabledTestCase('create_domain', 'builder_domain');
      if (!tc) {
        skipReason = 'Test case disabled or not found';
        return;
      }

      const packageCheck = ensurePackageConfig(tc.params, 'DomainBuilder - full workflow');
      if (!packageCheck.success) {
        skipReason = packageCheck.reason || 'Default package is not configured';
        return;
      }

      testCase = tc;
      domainName = tc.params.domain_name;

      // Cleanup before test
      if (domainName) {
        const cleanup = await ensureDomainReady(domainName);
        if (!cleanup.success) {
          skipReason = cleanup.reason || 'Failed to cleanup domain before test';
          testCase = null;
          domainName = null;
        }
      }
    });

    it('should execute full workflow and store all results', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(testsLogger, 'DomainBuilder - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(testsLogger, 'DomainBuilder - full workflow', skipReason);
        return;
      }

      if (!testCase || !domainName) {
        logBuilderTestSkip(testsLogger, 'DomainBuilder - full workflow', skipReason || 'Test case not available');
        return;
      }

      const builder = new DomainBuilder(connection, builderLogger, buildBuilderConfig(testCase));

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

        logBuilderTestSuccess(testsLogger, 'DomainBuilder - full workflow');
      } catch (error) {
        logBuilderTestError(testsLogger, 'DomainBuilder - full workflow', error);
        throw error;
      } finally {
        // Cleanup: force unlock in case of failure
        await builder.forceUnlock().catch(() => {});
        logBuilderTestEnd(testsLogger, 'DomainBuilder - full workflow');
      }
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP domain', async () => {
      const testCase = getTestCaseDefinition('create_domain', 'builder_domain');
      const standardObject = resolveStandardObject('domain', isCloudSystem, testCase);

      if (!standardObject) {
        logBuilderTestStart(testsLogger, 'DomainBuilder - read standard object', {
          name: 'read_standard',
          params: {}
        });
        logBuilderTestSkip(testsLogger, 'DomainBuilder - read standard object',
          `Standard domain not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`);
        return;
      }

      const standardDomainName = standardObject.name;
      logBuilderTestStart(testsLogger, 'DomainBuilder - read standard object', {
        name: 'read_standard',
        params: { domain_name: standardDomainName }
      });

      if (!hasConfig) {
        logBuilderTestSkip(testsLogger, 'DomainBuilder - read standard object', 'No SAP configuration');
        return;
      }

      const builder = new DomainBuilder(
        connection,
        builderLogger,
        {
          domainName: standardDomainName,
          packageName: 'SAP', // Standard package
          description: '' // Not used for read operations
        }
      );

      try {
        logBuilderTestStep('read');
        await builder.read();

        const result = builder.getReadResult();
        expect(result).toBeDefined();
        expect(result?.status).toBe(200);
        expect(result?.data).toBeDefined();

        logBuilderTestSuccess(testsLogger, 'DomainBuilder - read standard object');
      } catch (error) {
        logBuilderTestError(testsLogger, 'DomainBuilder - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'DomainBuilder - read standard object');
      }
    }, getTimeout('test'));
  });
});

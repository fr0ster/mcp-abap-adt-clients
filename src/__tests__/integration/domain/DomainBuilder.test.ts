/**
 * Integration test for DomainBuilder
 * Tests fluent API with Promise chaining, error handling, and result storage
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - DomainBuilder library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=domain/DomainBuilder
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { CrudClient } from '../../../clients/CrudClient';
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
  logBuilderTestStep,
  logBuilderTestStepError,
  getHttpStatusText
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
  getOperationDelay,
  retryCheckAfterActivate
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

describe('DomainBuilder (using CrudClient)', () => {
  let connection: AbapConnection;
  let client: CrudClient;
  let hasConfig = false;
  let isCloudSystem = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new CrudClient(connection);
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

      const config = buildBuilderConfig(testCase);

      logBuilderTestStep('validate');
      const validationResponse = await client.validateDomain({
        domainName: config.domainName,
        packageName: config.packageName!,
        description: config.description || ''
      });
      if (validationResponse?.status !== 200) {
        const errorData = typeof validationResponse?.data === 'string' 
          ? validationResponse.data 
          : JSON.stringify(validationResponse?.data);
        console.error(`Validation failed (HTTP ${validationResponse?.status}): ${errorData}`);
      }
      expect(validationResponse?.status).toBe(200);
      
      let domainCreated = false;
      let domainLocked = false;
      let currentStep = '';
      
      try {
        currentStep = 'create';
        logBuilderTestStep(currentStep);
        await client.createDomain(config);
        domainCreated = true;
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('create', testCase)));
        
        currentStep = 'check(active)';
        logBuilderTestStep(currentStep);
        const checkResultActive = await client.checkDomain({ domainName: config.domainName });
        expect(checkResultActive?.status).toBeDefined();
        
        currentStep = 'lock';
        logBuilderTestStep(currentStep);
        await client.lockDomain({ domainName: config.domainName });
        domainLocked = true;
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('lock', testCase)));
        
        currentStep = 'update';
        logBuilderTestStep(currentStep);
        await client.updateDomain({
          domainName: config.domainName,
          packageName: config.packageName!,
          description: config.description || '',
          datatype: config.datatype,
          length: config.length,
          decimals: config.decimals
        });
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('update', testCase)));
        
        currentStep = 'check(inactive)';
        logBuilderTestStep(currentStep);
        const checkResultInactive = await client.checkDomain({ domainName: config.domainName });
        expect(checkResultInactive?.status).toBeDefined();
        
        currentStep = 'unlock';
        logBuilderTestStep(currentStep);
        await client.unlockDomain({ domainName: config.domainName });
        domainLocked = false; // Unlocked successfully
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('unlock', testCase)));
        
        currentStep = 'activate';
        logBuilderTestStep(currentStep);
        await client.activateDomain({ domainName: config.domainName });
        // Wait for activation to complete (activation is asynchronous)
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('activate', testCase)));
        
        currentStep = 'delete (cleanup)';
        logBuilderTestStep(currentStep);
        await client.deleteDomain({
          domainName: config.domainName,
          transportRequest: config.transportRequest
        });

        expect(client.getCreateResult()).toBeDefined();
        expect(client.getActivateResult()).toBeDefined();

        logBuilderTestSuccess(testsLogger, 'DomainBuilder - full workflow');
      } catch (error: any) {
        // Log step error with details before failing test
        logBuilderTestStepError(currentStep || 'unknown', error);
        
        // Cleanup: unlock and delete if object was created/locked
        if (domainLocked || domainCreated) {
          try {
            if (domainLocked) {
              logBuilderTestStep('unlock (cleanup)');
              await client.unlockDomain({ domainName: config.domainName });
            }
            if (domainCreated) {
              logBuilderTestStep('delete (cleanup)');
              await client.deleteDomain({
                domainName: config.domainName,
                transportRequest: config.transportRequest
              });
            }
          } catch (cleanupError) {
            // Log cleanup error but don't fail test - original error is more important
            testsLogger.warn?.(`Cleanup failed for ${config.domainName}:`, cleanupError);
          }
        }
        
        const statusText = getHttpStatusText(error);
        const enhancedError = statusText !== 'HTTP ?'
          ? Object.assign(new Error(`[${statusText}] ${error.message}`), { stack: error.stack })
          : error;
        logBuilderTestError(testsLogger, 'DomainBuilder - full workflow', enhancedError);
        throw enhancedError;
      } finally {
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

      try {
        logBuilderTestStep('read');
        const result = await client.readDomain(standardDomainName);
        expect(result).toBeDefined();
        expect(result?.domainName).toBe(standardDomainName);
        expect(result?.description).toBeDefined();

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

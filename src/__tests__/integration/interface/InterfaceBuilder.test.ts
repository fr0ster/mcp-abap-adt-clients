/**
 * Unit test for InterfaceBuilder
 * Tests fluent API with Promise chaining, error handling, and result storage
 *
 * Enable debug logs:
 *   DEBUG_ADT_E2E_TESTS=true   - E2E test execution logs
 *   DEBUG_ADT_LIBS=true        - InterfaceBuilder library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=interface/InterfaceBuilder
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { InterfaceBuilder } from '../../../core/interface';
import { IAdtLogger } from '../../../utils/logger';
import { getInterface } from '../../../core/interface/read';
import { isCloudEnvironment } from '../../../core/shared/systemInfo';
import { getConfig } from '../../helpers/sessionConfig';
import { createOnLockCallback } from '../../helpers/lockHelper';
import {
  logBuilderTestStart,
  logBuilderTestSkip,
  logBuilderTestSuccess,
  logBuilderTestError,
  logBuilderTestEnd,
  logBuilderTestStep
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
  resolveStandardObject,
  getOperationDelay
} = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code (InterfaceBuilder) uses DEBUG_ADT_LIBS
const builderLogger: IAdtLogger = createBuilderLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: IAdtLogger = createTestsLogger();

describe('InterfaceBuilder', () => {
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
   * Pre-check: Verify test interface doesn't exist
   * Safety: Skip test if object exists to avoid accidental deletion
   */
  async function ensureInterfaceReady(interfaceName: string): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: true };
    }

    // Check if interface exists
    try {
      await getInterface(connection, interfaceName);
      return {
        success: false,
        reason: `⚠️ SAFETY: Interface ${interfaceName} already exists! ` +
                `Delete manually or use different test name to avoid accidental deletion.`
      };
    } catch (error: any) {
      // 404 is expected - object doesn't exist, we can proceed
      if (error.response?.status !== 404) {
        return {
          success: false,
          reason: `Cannot verify interface existence: ${error.message}`
        };
      }
    }

    return { success: true };
  }

  function getBuilderTestDefinition() {
    return getTestCaseDefinition('create_interface', 'builder_interface');
  }

  function buildBuilderConfig(testCase: any) {
    const params = testCase?.params || {};
    const packageName = resolvePackageName(params.package_name);
    if (!packageName) {
      throw new Error('package_name not configured for InterfaceBuilder test');
    }
    return {
      interfaceName: params.interface_name,
      packageName,
      transportRequest: resolveTransportRequest(params.transport_request),
      description: params.description,
      sourceCode: params.source_code
    };
  }

  describe('Full workflow', () => {
    let testCase: any = null;
    let interfaceName: string | null = null;
    let skipReason: string | null = null;

    beforeEach(async () => {
      skipReason = null;
      testCase = null;
      interfaceName = null;

      if (!hasConfig) {
        skipReason = 'No SAP configuration';
        return;
      }

      const definition = getBuilderTestDefinition();
      if (!definition) {
        skipReason = 'Test case not defined in test-config.yaml';
        return;
      }

      const tc = getEnabledTestCase('create_interface', 'builder_interface');
      if (!tc) {
        skipReason = 'Test case disabled or not found';
        return;
      }

      const packageCheck = ensurePackageConfig(tc.params, 'InterfaceBuilder - full workflow');
      if (!packageCheck.success) {
        skipReason = packageCheck.reason || 'Default package is not configured';
        return;
      }

      testCase = tc;
      interfaceName = tc.params.interface_name;

      // Cleanup before test
      if (interfaceName) {
        const cleanup = await ensureInterfaceReady(interfaceName);
        if (!cleanup.success) {
          skipReason = cleanup.reason || 'Failed to cleanup interface before test';
          testCase = null;
          interfaceName = null;
        }
      }
    });

    it('should execute full workflow and store all results', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(testsLogger, 'InterfaceBuilder - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(testsLogger, 'InterfaceBuilder - full workflow', skipReason);
        return;
      }

      if (!testCase || !interfaceName) {
        logBuilderTestSkip(testsLogger, 'InterfaceBuilder - full workflow', skipReason || 'Test case not available');
        return;
      }

      const builder = new InterfaceBuilder(connection, builderLogger, {
        ...buildBuilderConfig(testCase),
        onLock: createOnLockCallback('interface', interfaceName, undefined, __filename)
      });

      try {
        logBuilderTestStep('validate');
        await builder.validate();

        logBuilderTestStep('create');
        await builder.create();
        
        // Wait for SAP to commit the object creation (metadata only)
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('create', testCase)));

        logBuilderTestStep('lock');
        await builder.lock();
        
        // Wait for SAP to commit lock operation
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('lock', testCase)));

        logBuilderTestStep('update');
        await builder.update();
        
        // Wait for SAP to commit update operation
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('update', testCase)));

        logBuilderTestStep('check(inactive)');
        await builder.check('inactive');

        logBuilderTestStep('unlock');
        await builder.unlock();
        
        // Wait for SAP to commit unlock operation
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('unlock', testCase)));

        logBuilderTestStep('activate');
        await builder.activate();

        logBuilderTestStep('check(active)');
        await builder.check('active');

        logBuilderTestStep('delete (cleanup)');
        await builder.delete();

        const state = builder.getState();
        expect(state.createResult).toBeDefined();
        expect(state.activateResult).toBeDefined();
        expect(state.errors.length).toBe(0);

        logBuilderTestSuccess(testsLogger, 'InterfaceBuilder - full workflow');
      } catch (error) {
        logBuilderTestError(testsLogger, 'InterfaceBuilder - full workflow', error);
        throw error;
      } finally {
        // Cleanup: force unlock in case of failure
        await builder.forceUnlock().catch(() => { });
        logBuilderTestEnd(testsLogger, 'InterfaceBuilder - full workflow');
      }
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP interface', async () => {
      const testCase = getTestCaseDefinition('create_interface', 'builder_interface');
      const standardObject = resolveStandardObject('interface', isCloudSystem, testCase);

      if (!standardObject) {
        logBuilderTestStart(testsLogger, 'InterfaceBuilder - read standard object', {
          name: 'read_standard',
          params: {}
        });
        logBuilderTestSkip(
          builderLogger,
          'InterfaceBuilder - read standard object',
          `Standard interface not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`
        );
        return;
      }

      const standardInterfaceName = standardObject.name;
      logBuilderTestStart(testsLogger, 'InterfaceBuilder - read standard object', {
        name: 'read_standard',
        params: { interface_name: standardInterfaceName }
      });

      if (!hasConfig) {
        logBuilderTestSkip(testsLogger, 'InterfaceBuilder - read standard object', 'No SAP configuration');
        return;
      }

      const builder = new InterfaceBuilder(connection, builderLogger, {
        interfaceName: standardInterfaceName,
        packageName: 'SAP', // Standard package
        description: '' // Not used for read operations
      });

      try {
        logBuilderTestStep('read');
        await builder.read();

        const result = builder.getReadResult();
        expect(result).toBeDefined();
        expect(result?.status).toBe(200);
        expect(result?.data).toBeDefined();

        logBuilderTestSuccess(testsLogger, 'InterfaceBuilder - read standard object');
      } catch (error) {
        logBuilderTestError(testsLogger, 'InterfaceBuilder - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'InterfaceBuilder - read standard object');
      }
    }, getTimeout('test'));
  });
});


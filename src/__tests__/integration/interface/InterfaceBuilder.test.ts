/**
 * Unit test for InterfaceBuilder
 * Tests fluent API with Promise chaining, error handling, and result storage
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/interface/InterfaceBuilder.test
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { InterfaceBuilder, InterfaceBuilderLogger } from '../../../core/interface';
import { deleteInterface } from '../../../core/interface/delete';
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
  debug: debugEnabled ? (message: string, meta?: any) => console.log(message, meta) : () => { },
  info: debugEnabled ? (message: string, meta?: any) => console.log(message, meta) : () => { },
  warn: debugEnabled ? (message: string, meta?: any) => console.warn(message, meta) : () => { },
  error: debugEnabled ? (message: string, meta?: any) => console.error(message, meta) : () => { },
  csrfToken: debugEnabled ? (action: string, token?: string) => console.log(`CSRF ${action}:`, token) : () => { },
};

const builderLogger: InterfaceBuilderLogger = {
  debug: debugEnabled ? console.log : () => { },
  info: debugEnabled ? console.log : () => { },
  warn: debugEnabled ? console.warn : () => { },
  error: debugEnabled ? console.error : () => { },
};

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
      builderLogger.warn?.('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterAll(async () => {
    if (connection) {
      connection.reset();
    }
  });

  async function ensureInterfaceReady(interfaceName: string): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: true };
    }

    try {
      await deleteInterface(connection, { interface_name: interfaceName });
      await new Promise(resolve => setTimeout(resolve, 500));
      return { success: true };
    } catch (error: any) {
      const status = error.response?.status;

      // 429 = locked by another user - skip test
      if (status === 429) {
        return {
          success: false,
          reason: `Interface ${interfaceName} is locked (HTTP 429)`
        };
      }

      // All other errors (404, etc.) - ignore and proceed
      return { success: true };
    }
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

    afterEach(async () => {
      if (interfaceName && connection) {
        // Cleanup after test
        const cleanup = await ensureInterfaceReady(interfaceName);
        if (!cleanup.success && cleanup.reason) {
          console.warn(`[CLEANUP][Interface] ${cleanup.reason}`);
        }
      }
    });

    it('should execute full workflow and store all results', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(builderLogger, 'InterfaceBuilder - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(builderLogger, 'InterfaceBuilder - full workflow', skipReason);
        return;
      }

      if (!testCase || !interfaceName) {
        logBuilderTestSkip(builderLogger, 'InterfaceBuilder - full workflow', skipReason || 'Test case not available');
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
        
        // Wait for SAP to finish create operation (includes lock/unlock/activate internally)
        await new Promise(resolve => setTimeout(resolve, 1000));

        logBuilderTestStep('lock');
        await builder.lock();

        logBuilderTestStep('update');
        await builder.update();

        logBuilderTestStep('check(inactive)');
        await builder.check('inactive');

        logBuilderTestStep('unlock');
        await builder.unlock();

        logBuilderTestStep('activate');
        await builder.activate();

        logBuilderTestStep('check(active)');
        await builder.check('active');

        const state = builder.getState();
        expect(state.createResult).toBeDefined();
        expect(state.activateResult).toBeDefined();
        expect(state.errors.length).toBe(0);

        logBuilderTestSuccess(builderLogger, 'InterfaceBuilder - full workflow');
      } catch (error) {
        logBuilderTestError(builderLogger, 'InterfaceBuilder - full workflow', error);
        throw error;
      } finally {
        await builder.forceUnlock().catch(() => { });
        logBuilderTestEnd(builderLogger, 'InterfaceBuilder - full workflow');
      }
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP interface', async () => {
      const testCase = getTestCaseDefinition('create_interface', 'builder_interface');
      const standardObject = resolveStandardObject('interface', isCloudSystem, testCase);

      if (!standardObject) {
        logBuilderTestStart(builderLogger, 'InterfaceBuilder - read standard object', {
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
      logBuilderTestStart(builderLogger, 'InterfaceBuilder - read standard object', {
        name: 'read_standard',
        params: { interface_name: standardInterfaceName }
      });

      if (!hasConfig) {
        logBuilderTestSkip(builderLogger, 'InterfaceBuilder - read standard object', 'No SAP configuration');
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

        logBuilderTestSuccess(builderLogger, 'InterfaceBuilder - read standard object');
      } catch (error) {
        logBuilderTestError(builderLogger, 'InterfaceBuilder - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(builderLogger, 'InterfaceBuilder - read standard object');
      }
    }, getTimeout('test'));
  });
});


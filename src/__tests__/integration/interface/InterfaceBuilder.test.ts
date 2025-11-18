/**
 * Unit test for InterfaceBuilder
 * Tests fluent API with Promise chaining, error handling, and result storage
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/interface/InterfaceBuilder.test
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { InterfaceBuilder, InterfaceBuilderLogger } from '../../../core/interface';
import { deleteInterface } from '../../../core/interface/delete';
import { getInterfaceSource } from '../../../core/interface/read';
import { getConfig } from '../../helpers/sessionConfig';
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

const builderLogger: InterfaceBuilderLogger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
};

describe('InterfaceBuilder', () => {
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

  async function ensureInterfaceReady(interfaceName: string): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: true }; // No connection = nothing to clean
    }

    // Try to delete (ignore all errors)
    try {
      await deleteInterface(connection, { interface_name: interfaceName });
    } catch (error) {
      // Ignore all errors (404, locked, etc.)
    }

    return { success: true };
  }

  function getBuilderTestDefinition() {
    return getTestCaseDefinition('create_interface', 'builder_interface');
  }

  function buildBuilderConfig(testCase: any) {
    const params = testCase?.params || {};
    return {
      interfaceName: params.interface_name,
      packageName: params.package_name || getDefaultPackage(),
      transportRequest: params.transport_request || getDefaultTransport(),
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
          if (debugEnabled) {
            builderLogger.warn?.(`[CLEANUP] Cleanup failed: ${cleanup.reason}`);
          }
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

      const builder = new InterfaceBuilder(connection, builderLogger, buildBuilderConfig(testCase));

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

        logBuilderTestSuccess(builderLogger, 'InterfaceBuilder - full workflow');
      } catch (error) {
        logBuilderTestError(builderLogger, 'InterfaceBuilder - full workflow', error);
        throw error;
      } finally {
        await builder.forceUnlock().catch(() => {});
        logBuilderTestEnd(builderLogger, 'InterfaceBuilder - full workflow');
      }
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP interface', async () => {
      const standardInterfaceName = 'IF_ABAP_CHAR_UTILITIES'; // Standard SAP interface
      logBuilderTestStart(builderLogger, 'InterfaceBuilder - read standard object', {
        name: 'read_standard',
        params: { interface_name: standardInterfaceName }
      });

      if (!hasConfig) {
        logBuilderTestSkip(builderLogger, 'InterfaceBuilder - read standard object', 'No SAP configuration');
        return;
      }

      const builder = new InterfaceBuilder(
        connection,
        builderLogger,
        {
          interfaceName: standardInterfaceName,
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


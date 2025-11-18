/**
 * Integration test for DomainBuilder
 * Tests fluent API with Promise chaining, error handling, and result storage
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- integration/domain/DomainBuilder.test
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { DomainBuilder, DomainBuilderLogger } from '../../../core/domain';
import { deleteDomain } from '../../../core/domain/delete';
import { getDomain } from '../../../core/domain/read';
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
  getDefaultTransport,
  getTimeout
} = require('../../../../tests/test-helper');

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

const builderLogger: DomainBuilderLogger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
};

describe('DomainBuilder', () => {
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

  async function ensureDomainReady(domainName: string): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: false, reason: 'No connection' };
    }

    // Try to delete if exists
    try {
      await deleteDomain(connection, {
        domain_name: domainName,
        transport_request: getDefaultTransport() || undefined
      });
      if (debugEnabled) {
        builderLogger.debug?.(`[CLEANUP] Domain ${domainName} deleted`);
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
          builderLogger.debug?.(`[CLEANUP] Domain ${domainName} already absent`);
        }
        return { success: true };
      }

      // Other errors - log only in debug mode
      if (debugEnabled) {
        builderLogger.warn?.(`[CLEANUP] Failed to delete ${domainName}:`, rawMessage);
      }
    }

    // Verify object doesn't exist (wait a bit for async deletion)
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      await getDomain(connection, domainName);
      // Object still exists - check if it's locked
      const errorMsg = `Domain ${domainName} still exists after cleanup attempt (may be locked or in use)`;
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
      const errorMsg = `Cannot verify cleanup status for ${domainName} (may be locked)`;
      if (debugEnabled) {
        builderLogger.warn?.(`[CLEANUP] ${errorMsg}:`, error.message);
      }
      return { success: false, reason: errorMsg };
    }
  }

  function getBuilderTestDefinition() {
    return getTestCaseDefinition('create_domain', 'builder_domain');
  }

  function buildBuilderConfig(testCase: any) {
    const params = testCase?.params || {};
    return {
      domainName: params.domain_name,
      packageName: params.package_name || getDefaultPackage(),
      transportRequest: params.transport_request || getDefaultTransport(),
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

    afterEach(async () => {
      if (domainName && connection) {
        // Cleanup after test
        const cleanup = await ensureDomainReady(domainName);
        if (!cleanup.success && cleanup.reason) {
          if (debugEnabled) {
            builderLogger.warn?.(`[CLEANUP] Cleanup failed: ${cleanup.reason}`);
          }
        }
      }
    });

    it('should execute full workflow and store all results', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(builderLogger, 'DomainBuilder - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(builderLogger, 'DomainBuilder - full workflow', skipReason);
        return;
      }

      if (!testCase || !domainName) {
        logBuilderTestSkip(builderLogger, 'DomainBuilder - full workflow', skipReason || 'Test case not available');
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

        logBuilderTestSuccess(builderLogger, 'DomainBuilder - full workflow');
      } catch (error) {
        logBuilderTestError(builderLogger, 'DomainBuilder - full workflow', error);
        throw error;
      } finally {
        await builder.forceUnlock().catch(() => {});
        logBuilderTestEnd(builderLogger, 'DomainBuilder - full workflow');
      }
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP domain', async () => {
      const standardDomainName = 'MANDT'; // Standard SAP domain (exists in most ABAP systems)
      logBuilderTestStart(builderLogger, 'DomainBuilder - read standard object', {
        name: 'read_standard',
        params: { domain_name: standardDomainName }
      });

      if (!hasConfig) {
        logBuilderTestSkip(builderLogger, 'DomainBuilder - read standard object', 'No SAP configuration');
        return;
      }

      const builder = new DomainBuilder(
        connection,
        builderLogger,
        {
          domainName: standardDomainName,
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

        logBuilderTestSuccess(builderLogger, 'DomainBuilder - read standard object');
      } catch (error) {
        logBuilderTestError(builderLogger, 'DomainBuilder - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(builderLogger, 'DomainBuilder - read standard object');
      }
    }, getTimeout('test'));
  });
});

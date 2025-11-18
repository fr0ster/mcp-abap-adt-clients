/**
 * Unit test for DomainBuilder
 * Tests fluent API with Promise chaining, error handling, and result storage
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/domain/DomainBuilder.test
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { DomainBuilder, DomainBuilderLogger } from '../../../core/domain';
import { deleteDomain } from '../../../core/domain/delete';
import { getConfig } from '../../helpers/sessionConfig';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const {
  getEnabledTestCase,
  getDefaultPackage,
  getDefaultTransport,
  printTestHeader,
  printTestParams
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

  function logBuilderTestStart(testName: string, testCase: any): void {
    if (!testCase) {
      return;
    }
    printTestHeader(testName, testCase);
    printTestParams(testCase.params);
  }

  async function deleteDomainIfExists(domainName: string): Promise<void> {
    if (!connection || !hasConfig) return;

    try {
      await deleteDomain(connection, { domain_name: domainName });
      builderLogger.debug?.(`Domain ${domainName} deleted`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        builderLogger.debug?.(`Domain ${domainName} doesn't exist`);
      } else {
        builderLogger.warn?.(`Error deleting domain ${domainName}:`, error.message);
      }
    }
  }

  describe('Builder methods', () => {
    it('should chain builder methods', () => {
      const builder = new DomainBuilder(connection, builderLogger, {
        domainName: 'Z_TEST',
        packageName: 'ZPKG'
      });

      const result = builder
        .setPackage('ZPKG2')
        .setRequest('TR001')
        .setName('Z_TEST2')
        .setDescription('Test')
        .setDatatype('CHAR')
        .setLength(10);

      expect(result).toBe(builder);
      expect(builder.getDomainName()).toBe('Z_TEST2');
    });
  });

  describe('Promise chaining', () => {
    it('should chain operations with .then()', async () => {
      if (!hasConfig) {
        builderLogger.warn?.('⚠️ Skipping test: No config');
        return;
      }

      const testCase = getEnabledTestCase('create_domain', 'basic_domain');
      if (!testCase) {
        builderLogger.warn?.('⚠️ Skipping test: Test case disabled');
        return;
      }

      logBuilderTestStart('DomainBuilder - promise chaining', testCase);

      const domainName = testCase.params.domain_name;

      builderLogger.info?.(`🧹 Preparing test: deleting ${domainName} if exists`);
      await deleteDomainIfExists(domainName);

      let builder: DomainBuilder | null = null;
      try {
        builder = new DomainBuilder(connection, builderLogger, {
          domainName,
          packageName: testCase.params.package_name || getDefaultPackage(),
          transportRequest: testCase.params.transport_request || getDefaultTransport(),
          description: testCase.params.description,
          datatype: testCase.params.datatype || 'CHAR',
          length: testCase.params.length || 10
        });

        await builder
          .create()
          .then(b => {
            expect(b.getCreateResult()?.status).toBeGreaterThanOrEqual(200);
            return b.lock();
          })
          .then(b => {
            expect(b.getLockHandle()).toBeDefined();
            return b.update();
          })
          .then(b => {
            expect(b.getUpdateResult()?.status).toBeGreaterThanOrEqual(200);
            return b.check();
          })
          .then(b => {
            expect(b.getCheckResult()?.status).toBeGreaterThanOrEqual(200);
            return b.unlock();
          })
          .then(b => {
            expect(b.getUnlockResult()?.status).toBeGreaterThanOrEqual(200);
            expect(b.getLockHandle()).toBeUndefined();
            return b.activate();
          })
          .then(b => {
            expect(b.getActivateResult()?.status).toBeGreaterThanOrEqual(200);
          });
      } finally {
        if (builder) {
          await builder.forceUnlock().catch(() => {});
        }
        builderLogger.info?.(`🧹 Cleanup: deleting ${domainName}`);
        await deleteDomainIfExists(domainName);
      }
    }, getTimeout('test'));

    it('should interrupt chain on error', async () => {
      if (!hasConfig) {
        return;
      }

      const builder = new DomainBuilder(connection, builderLogger, {
        domainName: 'Z_TEST_INVALID',
        packageName: 'INVALID_PACKAGE'
      });

      let errorCaught = false;
      try {
        await builder.create();
      } catch (error) {
        errorCaught = true;
        expect(builder.getErrors().length).toBeGreaterThan(0);
      }

      expect(errorCaught).toBe(true);
    }, 30000);
  });

  describe('Error handling', () => {
    it('should execute .catch() on error', async () => {
      if (!hasConfig) {
        return;
      }

      const builder = new DomainBuilder(connection, builderLogger, {
        domainName: 'Z_TEST_ERROR',
        packageName: 'INVALID'
      });

      let catchExecuted = false;
      await builder
        .create()
        .catch(() => {
          catchExecuted = true;
        });

      expect(catchExecuted).toBe(true);
    }, 30000);

    it('should execute .finally() even on error', async () => {
      if (!hasConfig) {
        return;
      }

      const builder = new DomainBuilder(connection, builderLogger, {
        domainName: 'Z_TEST_FINALLY',
        packageName: 'INVALID'
      });

      let finallyExecuted = false;
      try {
        await builder.create();
      } catch (error) {
        // Error expected
      } finally {
        finallyExecuted = true;
      }

      expect(finallyExecuted).toBe(true);
    }, 30000);
  });

  describe('Result storage', () => {
    it('should store all results', async () => {
      if (!hasConfig) {
        return;
      }

      const testCase = getEnabledTestCase('create_domain', 'basic_domain');
      if (!testCase) {
        return;
      }

      logBuilderTestStart('DomainBuilder - result storage', testCase);

      const domainName = testCase.params.domain_name;
      await deleteDomainIfExists(domainName);

      let builder: DomainBuilder | null = null;
      try {
        builder = new DomainBuilder(connection, builderLogger, {
        domainName,
        packageName: testCase.params.package_name || getDefaultPackage(),
        transportRequest: testCase.params.transport_request || getDefaultTransport(),
        description: testCase.params.description,
        datatype: testCase.params.datatype || 'CHAR',
        length: testCase.params.length || 10
      });

      await builder
        .create()
        .then(b => b.lock())
        .then(b => b.update())
        .then(b => b.check())
        .then(b => b.unlock())
        .then(b => b.activate());

      const results = builder.getResults();
      expect(results.create).toBeDefined();
      expect(results.update).toBeDefined();
      expect(results.check).toBeDefined();
      expect(results.unlock).toBeDefined();
      expect(results.activate).toBeDefined();
      } finally {
        if (builder) {
          await builder.forceUnlock().catch(() => {});
        }
        await deleteDomainIfExists(domainName);
      }
    }, getTimeout('test'));
  });

  describe('Full workflow', () => {
    it('should execute full workflow and store all results', async () => {
      if (!hasConfig) {
        return;
      }

      const testCase = getEnabledTestCase('create_domain', 'basic_domain');
      if (!testCase) {
        return;
      }

      logBuilderTestStart('DomainBuilder - full workflow', testCase);

      const domainName = testCase.params.domain_name;
      await deleteDomainIfExists(domainName);

      let builder: DomainBuilder | null = null;
      try {
        builder = new DomainBuilder(connection, builderLogger, {
        domainName,
        packageName: testCase.params.package_name || getDefaultPackage(),
        transportRequest: testCase.params.transport_request || getDefaultTransport(),
        description: testCase.params.description,
        datatype: testCase.params.datatype || 'CHAR',
        length: testCase.params.length || 10
      });

      await builder
        .create()
        .then(b => b.lock())
        .then(b => b.update())
        .then(b => b.check())
        .then(b => b.unlock())
          .then(b => b.activate());

      const state = builder.getState();
      expect(state.createResult).toBeDefined();
      expect(state.activateResult).toBeDefined();
      expect(state.errors.length).toBe(0);
      } finally {
        if (builder) {
          await builder.forceUnlock().catch(() => {});
        }
        await deleteDomainIfExists(domainName);
      }
    }, getTimeout('test'));
  });

  describe('Getters', () => {
    it('should return correct values from getters', async () => {
      if (!hasConfig) {
        return;
      }

      const testCase = getEnabledTestCase('create_domain', 'basic_domain');
      if (!testCase) {
        return;
      }

      logBuilderTestStart('DomainBuilder - getters', testCase);

      const domainName = testCase.params.domain_name;
      await deleteDomainIfExists(domainName);

      const builder = new DomainBuilder(connection, builderLogger, {
        domainName,
        packageName: testCase.params.package_name || getDefaultPackage()
      });

      expect(builder.getDomainName()).toBe(domainName);
      expect(builder.getSessionId()).toBeDefined();
      expect(builder.getLockHandle()).toBeUndefined();

      await builder.create();
      expect(builder.getCreateResult()).toBeDefined();
    }, 30000);
  });
});


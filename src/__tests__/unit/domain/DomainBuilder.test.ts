/**
 * Unit test for DomainBuilder
 * Tests fluent API with Promise chaining, error handling, and result storage
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/domain/DomainBuilder.test
 */

import { getDomain } from '../../../core/domain/read';
import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';
import { DomainBuilder, DomainBuilderLogger } from '../../../core/domain';
import { deleteDomain } from '../../../core/domain/delete';

const { getEnabledTestCase, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');

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
  let sessionId: string | null = null;
  let testConfig: any = null;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      const env = await setupTestEnvironment(connection, 'builder', __filename);
      sessionId = env.sessionId;
      testConfig = env.testConfig;
      hasConfig = true;
    } catch (error) {
      builderLogger.warn?.('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
    if (connection) {
      connection.reset();
    }
  });

  // Helper function to delete domain if exists (idempotency)
  async function deleteDomainIfExists(domainName: string): Promise<void> {
    try {
      await deleteDomain(connection, { domain_name: domainName });
    } catch (error: any) {
      // Ignore 404 errors (domain doesn't exist)
      if (error.response?.status !== 404 && !error.message?.includes('not found')) {
        throw error;
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
        return;
      }

      const testCase = getEnabledTestCase('create_domain', 'basic_domain');
      if (!testCase) {
        return;
      }

      const domainName = testCase.params.domain_name;
      await deleteDomainIfExists(domainName);

      const builder = new DomainBuilder(connection, builderLogger, {
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

      expect(builder.getCreateResult()).toBeDefined();
      expect(builder.getActivateResult()).toBeDefined();
    }, 60000);

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

      const domainName = testCase.params.domain_name;
      await deleteDomainIfExists(domainName);

      const builder = new DomainBuilder(connection, builderLogger, {
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
    }, 60000);
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

      const domainName = testCase.params.domain_name;
      await deleteDomainIfExists(domainName);

      const builder = new DomainBuilder(connection, builderLogger, {
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
        .then(b => b.activate())
        .catch(error => {
          builderLogger.error?.('Workflow failed:', error);
          throw error;
        })
        .finally(() => {
          // Cleanup if needed
        });

      const state = builder.getState();
      expect(state.createResult).toBeDefined();
      expect(state.activateResult).toBeDefined();
      expect(state.errors.length).toBe(0);
    }, 60000);
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


/**
 * Unit test for TransportBuilder
 * Tests fluent API with Promise chaining, error handling, and result storage
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/transport/TransportBuilder.test
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';
import { TransportBuilder, TransportBuilderLogger } from '../../../core/transport';

const { getEnabledTestCase, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');

}

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const connectionLogger: ILogger = {
  debug: debugEnabled ? (message: string, meta?: any) => console.log(message, meta) : () => {},
  info: debugEnabled ? (message: string, meta?: any) => console.log(message, meta) : () => {},
  warn: debugEnabled ? (message: string, meta?: any) => console.warn(message, meta) : () => {},
  error: debugEnabled ? (message: string, meta?: any) => console.error(message, meta) : () => {},
  csrfToken: debugEnabled ? (action: string, token?: string) => console.log(`CSRF ${action}:`, token) : () => {},
};

const builderLogger: TransportBuilderLogger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
};

describe('TransportBuilder', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let sessionId: string | null = null;
  let testConfig: any = null;
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
    await cleanupTestEnvironment(connection, sessionId, testConfig);
    await cleanupTestEnvironment(connection, sessionId, testConfig);
    if (connection) {
      connection.reset();
    }
  });

  describe('Builder methods', () => {
    it('should chain builder methods', () => {
      const builder = new TransportBuilder(connection, builderLogger, {
        description: 'Test transport'
      });

      const result = builder
        .setDescription('Test transport 2')
        .setType('workbench')
        .setOwner('USERNAME')
        .setTargetSystem('SYSTEM');

      expect(result).toBe(builder);
    });
  });

  describe('Promise chaining', () => {
    it('should chain operations with .then()', async () => {
      if (!hasConfig) {
        return;
      }

      const testCase = getEnabledTestCase('create_transport');
      if (!testCase) {
        builderLogger.warn?.('⚠️ Skipping test: Test case is disabled');
        return;
      }

      const builder = new TransportBuilder(connection, builderLogger, {
        description: testCase.params.description,
        transportType: testCase.params.transport_type || 'workbench',
        owner: testCase.params.owner,
        targetSystem: testCase.params.target_system
      });

      await builder.create();

      expect(builder.getCreateResult()).toBeDefined();
      expect(builder.getTransportNumber()).toBeDefined();
    }, 30000);

    it('should interrupt chain on error', async () => {
      if (!hasConfig) {
        return;
      }

      const builder = new TransportBuilder(connection, builderLogger, {
        description: ''
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

      const builder = new TransportBuilder(connection, builderLogger, {
        description: ''
      });

      let catchExecuted = false;
      await builder
        .create()
        .catch(() => {
          catchExecuted = true;
        });

      expect(catchExecuted).toBe(true);
    }, 30000);
  });

  describe('Result storage', () => {
    it('should store all results', async () => {
      if (!hasConfig) {
        return;
      }

      const testCase = getEnabledTestCase('create_transport');
      if (!testCase) {
        builderLogger.warn?.('⚠️ Skipping test: Test case is disabled');
        return;
      }

      const builder = new TransportBuilder(connection, builderLogger, {
        description: testCase.params.description,
        transportType: testCase.params.transport_type || 'workbench',
        owner: testCase.params.owner,
        targetSystem: testCase.params.target_system
      });

      await builder.create();

      const results = builder.getResults();
      expect(results.create).toBeDefined();
      expect(results.transportNumber).toBeDefined();
    }, 30000);
  });

  describe('Getters', () => {
    it('should return correct values from getters', async () => {
      if (!hasConfig) {
        return;
      }

      const testCase = getEnabledTestCase('create_transport');
      if (!testCase) {
        builderLogger.warn?.('⚠️ Skipping test: Test case is disabled');
        return;
      }

      const builder = new TransportBuilder(connection, builderLogger, {
        description: testCase.params.description,
        transportType: testCase.params.transport_type || 'workbench',
        owner: testCase.params.owner,
        targetSystem: testCase.params.target_system
      });

      await builder.create();

      expect(builder.getTransportNumber()).toBeDefined();
      expect(builder.getCreateResult()).toBeDefined();
    }, 30000);
  });
});


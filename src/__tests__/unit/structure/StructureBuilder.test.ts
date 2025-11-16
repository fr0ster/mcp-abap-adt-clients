/**
 * Unit test for StructureBuilder
 * Tests fluent API with Promise chaining, error handling, and result storage
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/structure/StructureBuilder.test
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';
import { StructureBuilder, StructureBuilderLogger } from '../../../core/structure';
import { deleteStructure } from '../../../core/structure/delete';
import { getStructureMetadata } from '../../../core/structure/read';

const { getEnabledTestCase, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const connectionLogger: ILogger = {
  debug: debugEnabled ? (message: string, meta?: any) => console.log(message, meta) : () => {},
  info: debugEnabled ? (message: string, meta?: any) => console.log(message, meta) : () => {},
  warn: debugEnabled ? (message: string, meta?: any) => console.warn(message, meta) : () => {},
  error: debugEnabled ? (message: string, meta?: any) => console.error(message, meta) : () => {},
  csrfToken: debugEnabled ? (action: string, token?: string) => console.log(`CSRF ${action}:`, token) : () => {},
};

const builderLogger: StructureBuilderLogger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
};

describe('StructureBuilder', () => {
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
    if (connection) {
      connection.reset();
    }
  });

  async function deleteStructureIfExists(structureName: string): Promise<void> {
    try {
      await deleteStructure(connection, { structure_name: structureName });
    } catch (error: any) {
      // Ignore 404 errors (structure doesn't exist)
      if (error.response?.status !== 404 && !error.message?.includes('not found')) {
        throw error;
      }
    }
  }

  describe('Builder methods', () => {
    it('should chain builder methods', () => {
      const builder = new StructureBuilder(connection, builderLogger, {
        structureName: 'Z_TEST',
        packageName: 'ZPKG'
      });

      const result = builder
        .setPackage('ZPKG2')
        .setRequest('TR001')
        .setName('Z_TEST2')
        .setDescription('Test')
        .setFields([{ name: 'FIELD1', data_type: 'CHAR', length: 10 }]);

      expect(result).toBe(builder);
      expect(builder.getStructureName()).toBe('Z_TEST2');
    });
  });

  describe('Promise chaining', () => {
    it('should chain operations with .then()', async () => {
      if (!hasConfig) {
        return;
      }

      const testCase = getEnabledTestCase('create_structure');
      if (!testCase) {
        builderLogger.warn?.('⚠️ Skipping test: Test case is disabled');
        return;
      }

      const structureName = testCase.params.structure_name;
      await deleteStructureIfExists(structureName);

      const builder = new StructureBuilder(connection, builderLogger, {
        structureName,
        packageName: testCase.params.package_name || getDefaultPackage(),
        transportRequest: testCase.params.transport_request || getDefaultTransport(),
        description: testCase.params.description,
        fields: testCase.params.fields
      });

      await builder
        .validate()
        .then(b => b.create())
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

      const builder = new StructureBuilder(connection, builderLogger, {
        structureName: 'Z_TEST_INVALID',
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

      const builder = new StructureBuilder(connection, builderLogger, {
        structureName: 'Z_TEST_ERROR',
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
  });

  describe('Result storage', () => {
    it('should store all results', async () => {
      if (!hasConfig) {
        return;
      }

      const testCase = getEnabledTestCase('create_structure');
      if (!testCase) {
        builderLogger.warn?.('⚠️ Skipping test: Test case is disabled');
        return;
      }

      const structureName = testCase.params.structure_name;
      await deleteStructureIfExists(structureName);

      const builder = new StructureBuilder(connection, builderLogger, {
        structureName,
        packageName: testCase.params.package_name || getDefaultPackage(),
        transportRequest: testCase.params.transport_request || getDefaultTransport(),
        description: testCase.params.description,
        fields: testCase.params.fields
      });

      await builder
        .validate()
        .then(b => b.create())
        .then(b => b.lock())
        .then(b => b.update())
        .then(b => b.check())
        .then(b => b.unlock())
        .then(b => b.activate());

      const results = builder.getResults();
      expect(results.validate).toBeDefined();
      expect(results.create).toBeDefined();
      expect(results.update).toBeDefined();
      expect(results.check).toBeDefined();
      expect(results.unlock).toBeDefined();
      expect(results.activate).toBeDefined();
    }, 60000);
  });

  describe('Getters', () => {
    it('should return correct values from getters', () => {
      const builder = new StructureBuilder(connection, builderLogger, {
        structureName: 'Z_TEST',
        packageName: 'ZPKG'
      });

      expect(builder.getStructureName()).toBe('Z_TEST');
      expect(builder.getSessionId()).toBeDefined();
      expect(builder.getLockHandle()).toBeUndefined();
    });
  });
});


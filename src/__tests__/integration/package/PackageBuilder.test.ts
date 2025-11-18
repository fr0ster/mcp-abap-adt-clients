/**
 * Unit test for PackageBuilder
 * Tests fluent API with Promise chaining, error handling, and result storage
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/package/PackageBuilder.test
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { PackageBuilder, PackageBuilderLogger } from '../../../core/package';
import { getConfig } from '../../helpers/sessionConfig';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const { getEnabledTestCase, getDefaultPackage } = require('../../../../tests/test-helper');
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

const builderLogger: PackageBuilderLogger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
};

describe('PackageBuilder', () => {
  let connection: AbapConnection;
  let hasConfig = false;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
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

  describe('Builder methods', () => {
    it('should chain builder methods', () => {
      const builder = new PackageBuilder(connection, builderLogger, {
        packageName: 'Z_TEST',
        superPackage: 'ZPKG'
      });

      const result = builder
        .setSuperPackage('ZPKG2')
        .setDescription('Test')
        .setPackageType('development')
        .setSoftwareComponent('HOME')
        .setTransportLayer('ZE19')
        .setRequest('TR001');

      expect(result).toBe(builder);
      expect(builder.getPackageName()).toBe('Z_TEST');
    });
  });

  describe('Promise chaining', () => {
    it('should chain operations with .then()', async () => {
      if (!hasConfig) {
        return;
      }

      const testCase = getEnabledTestCase('create_package', 'builder_package');
      if (!testCase) {
        builderLogger.warn?.('⚠️ Skipping test: Test case is disabled');
        return;
      }

      const builder = new PackageBuilder(connection, builderLogger, {
        packageName: testCase.params.package_name,
        superPackage: testCase.params.super_package || getDefaultPackage(),
        description: testCase.params.description,
        packageType: testCase.params.package_type || 'development',
        transportRequest: testCase.params.transport_request
      });

      await builder
        .validate()
        .then(b => b.create())
        .then(b => b.check());

      expect(builder.getCreateResult()).toBeDefined();
    }, getTimeout('test'));

    it('should interrupt chain on error', async () => {
      if (!hasConfig) {
        return;
      }

      const builder = new PackageBuilder(connection, builderLogger, {
        packageName: 'Z_TEST_INVALID',
        superPackage: 'INVALID_PACKAGE'
      });

      let errorCaught = false;
      try {
        await builder.validate();
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

      const builder = new PackageBuilder(connection, builderLogger, {
        packageName: 'Z_TEST_ERROR',
        superPackage: 'INVALID'
      });

      let catchExecuted = false;
      await builder
        .validate()
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

      const testCase = getEnabledTestCase('create_package', 'builder_package');
      if (!testCase) {
        builderLogger.warn?.('⚠️ Skipping test: Test case is disabled');
        return;
      }

      const builder = new PackageBuilder(connection, builderLogger, {
        packageName: testCase.params.package_name,
        superPackage: testCase.params.super_package || getDefaultPackage(),
        description: testCase.params.description,
        packageType: testCase.params.package_type || 'development',
        transportRequest: testCase.params.transport_request
      });

      await builder
        .validate()
        .then(b => b.create())
        .then(b => b.read())
        .then(b => b.check());

      const results = builder.getResults();
      expect(results.validate).toBeDefined();
      expect(results.create).toBeDefined();
      expect(results.read).toBeDefined();
      expect(results.check).toBeDefined();
    }, getTimeout('test'));
  });

  describe('Getters', () => {
    it('should return correct values from getters', () => {
      const builder = new PackageBuilder(connection, builderLogger, {
        packageName: 'Z_TEST',
        superPackage: 'ZPKG'
      });

      expect(builder.getPackageName()).toBe('Z_TEST');
      expect(builder.getValidationResult()).toBeUndefined();
      expect(builder.getCreateResult()).toBeUndefined();
    });
  });
});


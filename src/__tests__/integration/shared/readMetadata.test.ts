/**
 * Unit test for readMetadata shared function
 * Tests readObjectMetadata function for different object types using AdtClient/AdtUtils
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/shared/readMetadata.test
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SapConfig } from '@mcp-abap-adt/connection';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../clients/AdtClient';
import type { AdtObjectType } from '../../../core/shared/types';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import {
  createTestAdtClient,
  createTestConnection,
  skipUnlessConfigured,
} from '../../helpers/sessionConfig';
import { TestConfigResolver } from '../../helpers/TestConfigResolver';
import { createTestsLogger } from '../../helpers/testLogger';
import { logTestSkip, logTestStep } from '../../helpers/testProgressLogger';

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const testsLogger = createTestsLogger();
const { isHttpStatusAllowed } = require('../../helpers/test-helper');

describe('Shared - readMetadata', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;
  let hasConfig = false;
  let isLegacy = false;
  let isCloudSystem = false;

  beforeEach(async () => {
    try {
      connection = await createTestConnection(testsLogger);
      const { client: resolvedClient, isLegacy: legacy } =
        await createTestAdtClient(connection, testsLogger);
      client = resolvedClient;
      isLegacy = legacy;
      hasConfig = true;
      isCloudSystem = await isCloudEnvironment(connection);
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      hasConfig = skipUnlessConfigured(error, testsLogger);
    }
  });

  afterEach(async () => {
    if (connection) {
      await connection.disconnect();
    }
  });

  it('should read class metadata', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    const resolver = new TestConfigResolver({
      isCloud: isCloudSystem,
      isLegacy,
      logger: testsLogger,
      handlerName: 'read_metadata',
      testCaseName: 'read_class_metadata',
    });
    if (!resolver.isAvailableForEnvironment()) {
      logTestSkip(
        testsLogger,
        'Shared - readMetadata',
        'Test not available for current environment',
      );
      return;
    }

    const className = resolver.getObjectName('class_name', 'class');
    if (!className) {
      logTestSkip(
        testsLogger,
        'Shared - readMetadata',
        'No class configured in standard_objects',
      );
      return;
    }
    try {
      logTestStep('read class metadata', testsLogger);
      testsLogger.info?.(`📋 Object: ${className} (class)`);
      testsLogger.info?.('📖 Reading metadata...');

      const activeResult = await client
        .getUtils()
        .readObjectMetadata('class', className, undefined, {
          version: 'active',
        });
      const inactiveResult = await client
        .getUtils()
        .readObjectMetadata('class', className, undefined, {
          version: 'inactive',
        });

      expect(activeResult.status).toBe(200);
      expect(activeResult.data).toBeDefined();
      logTestStep(
        `metadata active size: ${activeResult.data?.length || 0} bytes`,
        testsLogger,
      );

      expect(inactiveResult.status).toBe(200);
      expect(inactiveResult.data).toBeDefined();
      logTestStep(
        `metadata inactive size: ${inactiveResult.data?.length || 0} bytes`,
        testsLogger,
      );

      testsLogger.info?.('✅ Metadata retrieved');
    } catch (error: any) {
      if (error.response?.status === 406) {
        if (isHttpStatusAllowed(406, { params: {} })) {
          testsLogger.warn?.(
            '⚠️ Skipping test: 406 Not Acceptable (Accept header not supported)',
          );
          return;
        }
        throw new Error(
          `406 Not Acceptable: The server cannot produce a response matching the Accept header. This may indicate an issue with the Accept header format or the object may not be accessible. Error: ${error.message}`,
        );
      }
      throw error;
    }
  }, 15000);

  it('should read domain metadata', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    const resolver = new TestConfigResolver({
      isCloud: isCloudSystem,
      isLegacy,
      logger: testsLogger,
      handlerName: 'read_metadata',
      testCaseName: 'read_domain_metadata',
    });
    if (!resolver.isAvailableForEnvironment()) {
      logTestSkip(
        testsLogger,
        'Shared - readMetadata',
        'Test not available for current environment',
      );
      return;
    }

    const domainName = resolver.getObjectName('domain_name', 'domain');
    if (!domainName) {
      logTestSkip(
        testsLogger,
        'Shared - readMetadata',
        'No domain configured in standard_objects',
      );
      return;
    }
    try {
      logTestStep('read domain metadata', testsLogger);
      testsLogger.info?.(`📋 Object: ${domainName} (domain)`);
      testsLogger.info?.('📖 Reading metadata...');

      const result = await client
        .getUtils()
        .readObjectMetadata('domain', domainName);

      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();

      testsLogger.info?.('✅ Metadata retrieved');
      logTestStep(
        `metadata size: ${result.data?.length || 0} bytes`,
        testsLogger,
      );
    } catch (error: any) {
      if (error.response?.status === 406) {
        if (isHttpStatusAllowed(406, { params: {} })) {
          testsLogger.warn?.(
            '⚠️ Skipping test: 406 Not Acceptable (Accept header not supported)',
          );
          return;
        }
        throw new Error(
          `406 Not Acceptable: The server cannot produce a response matching the Accept header. This may indicate an issue with the Accept header format or the object may not be accessible. Error: ${error.message}`,
        );
      }
      throw error;
    }
  }, 15000);

  it('should read table metadata', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    const resolver = new TestConfigResolver({
      isCloud: isCloudSystem,
      isLegacy,
      logger: testsLogger,
      handlerName: 'read_metadata',
      testCaseName: 'read_table_metadata',
    });
    if (!resolver.isAvailableForEnvironment()) {
      logTestSkip(
        testsLogger,
        'Shared - readMetadata',
        'Test not available for current environment',
      );
      return;
    }

    const tableName = resolver.getObjectName('table_name', 'table');
    if (!tableName) {
      logTestSkip(
        testsLogger,
        'Shared - readMetadata',
        'No table configured in standard_objects',
      );
      return;
    }
    try {
      logTestStep('read table metadata', testsLogger);
      const result = await client
        .getUtils()
        .readObjectMetadata('table', tableName);
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
    } catch (error: any) {
      if (error.response?.status === 406) {
        if (isHttpStatusAllowed(406, { params: {} })) {
          testsLogger.warn?.(
            '⚠️ Skipping test: 406 Not Acceptable (Accept header not supported)',
          );
          return;
        }
        throw new Error(
          `406 Not Acceptable: The server cannot produce a response matching the Accept header. This may indicate an issue with the Accept header format or the object may not be accessible. Error: ${error.message}`,
        );
      }
      throw error;
    }
  }, 15000);

  it('should throw error for unsupported object type', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    const resolver = new TestConfigResolver({
      isCloud: isCloudSystem,
      isLegacy,
      logger: testsLogger,
      handlerName: 'read_metadata',
      testCaseName: 'read_metadata_error_unsupported',
    });
    if (!resolver.isAvailableForEnvironment()) {
      logTestSkip(
        testsLogger,
        'Shared - readMetadata',
        'Test not available for current environment',
      );
      return;
    }

    logTestStep('validate error for unsupported object type', testsLogger);
    await expect(
      client
        .getUtils()
        // Force runtime validation for invalid inputs.
        .readObjectMetadata(
          'unsupported_type' as unknown as AdtObjectType,
          'TEST',
        ),
    ).rejects.toThrow('Unsupported object type for metadata');
  });
});

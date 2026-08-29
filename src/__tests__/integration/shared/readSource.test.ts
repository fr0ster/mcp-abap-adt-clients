/**
 * Unit test for readSource shared function
 * Tests readObjectSource function for different object types using AdtClient/AdtUtils
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/shared/readSource.test
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SapConfig } from '@mcp-abap-adt/connection';
import type {
  IAbapConnection,
  ILogger,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../clients/AdtClient';
import type { AdtSourceObjectType } from '../../../core/shared/types';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
  skipUnlessConfigured,
} from '../../helpers/sessionConfig';
import { TestConfigResolver } from '../../helpers/TestConfigResolver';
import {
  createConnectionLogger,
  createTestsLogger,
} from '../../helpers/testLogger';
import { logTestSkip, logTestStep } from '../../helpers/testProgressLogger';

const { withAcceptHandling } = require('../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();
// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('Shared - readSource', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;
  let hasConfig = false;
  let isLegacy = false;
  let isCloudSystem = false;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
      const { client: resolvedClient, isLegacy: legacy } =
        await createTestAdtClient(connection, connectionLogger);
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

  afterAll(async () => {
    if (connection) {
      await releaseTestConnection(connection);
    }
  });

  it('should check if object type supports source code', () => {
    if (!hasConfig || !client) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }
    logTestStep('check if object type supports source code', testsLogger);
    const utils = client.getUtils();
    expect(utils.supportsSourceCode('class')).toBe(true);
    expect(utils.supportsSourceCode('program')).toBe(true);
    expect(utils.supportsSourceCode('interface')).toBe(true);
    expect(utils.supportsSourceCode('table')).toBe(true);
    expect(utils.supportsSourceCode('structure')).toBe(true);
    expect(utils.supportsSourceCode('view')).toBe(true);
    expect(utils.supportsSourceCode('domain')).toBe(false);
    expect(utils.supportsSourceCode('dataelement')).toBe(false);
  });

  it('should read class source code', async () => {
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
      handlerName: 'read_source',
      testCaseName: 'read_class_source',
    });
    const className = resolver.getObjectName('class_name', 'class');
    if (!className) {
      logTestSkip(
        testsLogger,
        'Shared - readSource',
        'No class configured in standard_objects',
      );
      return;
    }
    logTestStep('read class source code', testsLogger);
    testsLogger.info?.(`📋 Object: ${className} (class)`);
    testsLogger.info?.('📖 Reading source code...');

    const result = await withAcceptHandling(
      client.getUtils().readObjectSource('class', className),
    );

    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
    expect(typeof result.data).toBe('string');

    testsLogger.info?.('✅ Source code retrieved');
    testsLogger.info?.(
      `📊 Source length: ${result.data?.length || 0} characters`,
    );
  }, 15000);

  it('should read class source code (inactive version)', async () => {
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
      handlerName: 'read_source',
      testCaseName: 'read_class_source_inactive',
    });
    const className = resolver.getObjectName('class_name', 'class');
    if (!className) {
      logTestSkip(
        testsLogger,
        'Shared - readSource',
        'No class configured in standard_objects',
      );
      return;
    }
    logTestStep('read class source code (inactive version)', testsLogger);
    const result = await withAcceptHandling(
      client
        .getUtils()
        .readObjectSource('class', className, undefined, 'inactive'),
    );
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
  }, 15000);

  it('should read class source code (active and inactive versions)', async () => {
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
      handlerName: 'read_source',
      testCaseName: 'read_class_source_versions',
    });
    const className = resolver.getObjectName('class_name', 'class');
    if (!className) {
      logTestSkip(
        testsLogger,
        'Shared - readSource',
        'No class configured in standard_objects',
      );
      return;
    }
    logTestStep(
      'read class source code (active and inactive versions)',
      testsLogger,
    );

    logTestStep('read class source (active)', testsLogger);
    const activeResult = await withAcceptHandling(
      client
        .getUtils()
        .readObjectSource('class', className, undefined, 'active'),
    );
    expect(activeResult.status).toBe(200);
    expect(activeResult.data).toBeDefined();
    logTestStep(
      `active source length: ${activeResult.data?.length || 0} characters`,
      testsLogger,
    );

    logTestStep('read class source (inactive)', testsLogger);
    const inactiveResult = await withAcceptHandling(
      client
        .getUtils()
        .readObjectSource('class', className, undefined, 'inactive'),
    );
    expect(inactiveResult.status).toBe(200);
    expect(inactiveResult.data).toBeDefined();
    logTestStep(
      `inactive source length: ${inactiveResult.data?.length || 0} characters`,
      testsLogger,
    );
  }, 15000);

  it('should throw error for object type without source code', async () => {
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
      handlerName: 'read_source',
      testCaseName: 'read_source_error_unsupported',
    });
    const domainName =
      resolver.getObjectName('domain_name', 'domain') || 'MANDT';

    logTestStep(
      'validate error for object type without source code',
      testsLogger,
    );
    await expect(
      client
        .getUtils()
        // Force runtime validation for invalid inputs.
        .readObjectSource(
          'domain' as unknown as AdtSourceObjectType,
          domainName,
        ),
    ).rejects.toThrow('does not support source code reading');
  });
});

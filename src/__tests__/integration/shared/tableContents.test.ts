/**
 * Unit test for getTableContents shared function
 * Tests getTableContents function using AdtClient/AdtUtils
 *
 * ⚠️ ABAP Cloud Limitation: This function works only for on-premise systems.
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/shared/tableContents.test
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
import { isCloudEnvironment } from '../../../utils/systemInfo';
import { expectResult } from '../../helpers/contract';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
  skipUnlessConfigured,
} from '../../helpers/sessionConfig';
import { TestConfigResolver } from '../../helpers/TestConfigResolver';
import { createTestsLogger } from '../../helpers/testLogger';
import {
  logTestSkip,
  logTestStart,
  logTestStep,
} from '../../helpers/testProgressLogger';

const { withAcceptHandling } = require('../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const testsLogger: ILogger = createTestsLogger();

describe('Shared - getTableContents', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;
  let hasConfig = false;
  let isLegacy = false;
  let isCloudSystem = false;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(testsLogger);
      const { client: resolvedClient, isLegacy: legacy } =
        await createTestAdtClient(connection, testsLogger);
      client = resolvedClient;
      isLegacy = legacy;
      hasConfig = true;
      // Check if this is a cloud system using system information endpoint
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

  it('should get table contents', async () => {
    if (!hasConfig) {
      logTestSkip(
        testsLogger,
        'Shared - getTableContents',
        'No SAP configuration',
      );
      return;
    }

    // Get test case from YAML configuration
    const resolver = new TestConfigResolver({
      isCloud: isCloudSystem,
      isLegacy,
      logger: testsLogger,
      handlerName: 'table_contents',
      testCaseName: 'get_table_contents',
    });

    const testCase = resolver.getTestCase();
    if (!testCase || !resolver.isEnabled()) {
      logTestSkip(
        testsLogger,
        'Shared - getTableContents',
        'Test case not found or disabled',
      );
      return;
    }

    if (!resolver.isAvailableForEnvironment()) {
      logTestStart(testsLogger, 'Shared - getTableContents', {
        name: 'get_table_contents',
        params: {},
      });
      logTestSkip(
        testsLogger,
        'Shared - getTableContents',
        `Test not available for ${isCloudSystem ? 'cloud' : isLegacy ? 'legacy' : 'on-premise'} environment. ` +
          `Table contents are only supported on on-premise systems.`,
      );
      return;
    }

    // Get table name from params or standard_objects.tables
    const tableName = resolver.getObjectName('table_name', 'table')!;
    const maxRows = resolver.getParam('max_rows', 10);

    logTestStep('get table contents', testsLogger);
    // The contract, not the status: ADT answers a refusal inside a 200, and
    // on a legacy system this endpoint is absent altogether — both come back
    // as the failure half, naming which.
    const document = expectResult(
      await withAcceptHandling(
        client.getUtils().getTableContents({
          table_name: tableName,
          max_rows: maxRows,
        }),
      ),
      'table contents',
    ) as string;
    expect(typeof document).toBe('string');
  }, 30000);

  it('should use default max_rows if not provided', async () => {
    if (!hasConfig) {
      logTestSkip(
        testsLogger,
        'Shared - getTableContents',
        'No SAP configuration',
      );
      return;
    }

    // Get test case from YAML configuration
    const resolver = new TestConfigResolver({
      isCloud: isCloudSystem,
      isLegacy,
      logger: testsLogger,
      handlerName: 'table_contents',
      testCaseName: 'get_table_contents_default_max_rows',
    });

    const testCase = resolver.getTestCase();
    if (!testCase || !resolver.isEnabled()) {
      logTestSkip(
        testsLogger,
        'Shared - getTableContents',
        'Test case not found or disabled',
      );
      return;
    }

    if (!resolver.isAvailableForEnvironment()) {
      logTestSkip(
        testsLogger,
        'Shared - getTableContents',
        `Test not available for ${isCloudSystem ? 'cloud' : isLegacy ? 'legacy' : 'on-premise'} environment. ` +
          `Table contents are only supported on on-premise systems.`,
      );
      return;
    }

    // Get table name from params or standard_objects.tables
    const tableName = resolver.getObjectName('table_name', 'table')!;

    logTestStep('get table contents with default max_rows', testsLogger);
    // The contract, not the status: ADT answers a refusal inside a 200, and
    // on a legacy system this endpoint is absent altogether — both come back
    // as the failure half, naming which.
    const document = expectResult(
      await withAcceptHandling(
        client.getUtils().getTableContents({
          table_name: tableName,
        }),
      ),
      'table contents',
    ) as string;
    expect(typeof document).toBe('string');
  }, 30000);

  it('should throw error if table name is missing', async () => {
    if (!hasConfig) {
      logTestSkip(
        testsLogger,
        'Shared - getTableContents',
        'No SAP configuration',
      );
      return;
    }

    // Get test case from YAML configuration (use first available)
    const resolver = new TestConfigResolver({
      isCloud: isCloudSystem,
      isLegacy,
      logger: testsLogger,
      handlerName: 'table_contents',
    });

    const testCase = resolver.getTestCase();
    if (!resolver.isAvailableForEnvironment()) {
      logTestSkip(
        testsLogger,
        'Shared - getTableContents',
        `Test not available for ${isCloudSystem ? 'cloud' : isLegacy ? 'legacy' : 'on-premise'} environment. ` +
          `Table contents are only supported on on-premise systems.`,
      );
      return;
    }

    logTestStep('validate error if table name is missing', testsLogger);
    await expect(
      client.getUtils().getTableContents({
        table_name: '',
      }),
    ).rejects.toThrow('Table name is required');
  });
});

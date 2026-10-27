/**
 * Unit test for readMetadata shared function
 * Tests readObjectMetadata function for different object types using AdtClient/AdtUtils
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/shared/readMetadata.test
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyseException } from '@mcp-abap-adt/adt-strategies';
import type { SapConfig } from '@mcp-abap-adt/connection';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../clients/AdtClient';
import type { AdtObjectType } from '../../../core/shared/types';
import { orThrow } from '../../../utils/adtResponse';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import { gate, gateAll, gateOn } from '../../helpers/caseGate';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
  skipUnlessConfigured,
} from '../../helpers/sessionConfig';
import { TestConfigResolver } from '../../helpers/TestConfigResolver';
import { createTestsLogger } from '../../helpers/testLogger';
import { logTestStep } from '../../helpers/testProgressLogger';

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const testsLogger = createTestsLogger();
const { isHttpStatusAllowed } = require('../../helpers/test-helper');

/** Applies where the case does and where it names the object it reads. */
function objectCase(
  handlerName: string,
  testCaseName: string,
  param: string,
  type: string,
): jest.It {
  return gateAll(
    gate(handlerName, testCaseName),
    gateOn(
      ({ isCloud }) =>
        !!new TestConfigResolver({
          isCloud,
          handlerName,
          testCaseName,
        }).getObjectName(param, type),
    ),
  );
}

describe('Shared - readMetadata', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;
  let isCloudSystem = false;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(testsLogger);
      const { client: resolvedClient } = await createTestAdtClient(
        connection,
        testsLogger,
      );
      client = resolvedClient;
      isCloudSystem = await isCloudEnvironment(connection);
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(async () => {
    if (connection) {
      await releaseTestConnection(connection);
    }
  });

  objectCase(
    'read_metadata',
    'read_class_metadata',
    'class_name',
    'class',
  )(
    'should read class metadata',
    async () => {
      const resolver = new TestConfigResolver({
        isCloud: isCloudSystem,
        logger: testsLogger,
        handlerName: 'read_metadata',
        testCaseName: 'read_class_metadata',
      });

      const className = resolver.getObjectName('class_name', 'class');
      if (!className) {
        throw new Error('No class configured in standard_objects');
      }
      try {
        logTestStep('read class metadata', testsLogger);
        testsLogger.info?.(`📋 Object: ${className} (class)`);
        testsLogger.info?.('📖 Reading metadata...');

        const activeResult = await orThrow(
          client.getUtils().readObjectMetadata('class', className, undefined, {
            analyse: analyseException,
            version: 'active',
          }),
        );
        const inactiveResult = await orThrow(
          client.getUtils().readObjectMetadata('class', className, undefined, {
            analyse: analyseException,
            version: 'inactive',
          }),
        );

        expect(activeResult).toBeDefined();
        logTestStep(
          `metadata active size: ${activeResult?.length || 0} bytes`,
          testsLogger,
        );

        expect(inactiveResult).toBeDefined();
        logTestStep(
          `metadata inactive size: ${inactiveResult?.length || 0} bytes`,
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
    },
    15000,
  );

  objectCase(
    'read_metadata',
    'read_domain_metadata',
    'domain_name',
    'domain',
  )(
    'should read domain metadata',
    async () => {
      const resolver = new TestConfigResolver({
        isCloud: isCloudSystem,
        logger: testsLogger,
        handlerName: 'read_metadata',
        testCaseName: 'read_domain_metadata',
      });

      const domainName = resolver.getObjectName('domain_name', 'domain');
      if (!domainName) {
        throw new Error('No domain configured in standard_objects');
      }
      try {
        logTestStep('read domain metadata', testsLogger);
        testsLogger.info?.(`📋 Object: ${domainName} (domain)`);
        testsLogger.info?.('📖 Reading metadata...');

        const result = await orThrow(
          client
            .getUtils()
            .readObjectMetadata('domain', domainName, undefined, {
              analyse: analyseException,
            }),
        );

        expect(result).toBeDefined();

        testsLogger.info?.('✅ Metadata retrieved');
        logTestStep(`metadata size: ${result?.length || 0} bytes`, testsLogger);
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
    },
    15000,
  );

  objectCase(
    'read_metadata',
    'read_table_metadata',
    'table_name',
    'table',
  )(
    'should read table metadata',
    async () => {
      const resolver = new TestConfigResolver({
        isCloud: isCloudSystem,
        logger: testsLogger,
        handlerName: 'read_metadata',
        testCaseName: 'read_table_metadata',
      });

      const tableName = resolver.getObjectName('table_name', 'table');
      if (!tableName) {
        throw new Error('No table configured in standard_objects');
      }
      try {
        logTestStep('read table metadata', testsLogger);
        const result = await orThrow(
          client.getUtils().readObjectMetadata('table', tableName, undefined, {
            analyse: analyseException,
          }),
        );
        expect(result).toBeDefined();
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
    },
    15000,
  );

  gate('read_metadata', 'read_metadata_error_unsupported')(
    'should throw error for unsupported object type',
    async () => {
      logTestStep('validate error for unsupported object type', testsLogger);
      await expect(
        client
          .getUtils()
          // Force runtime validation for invalid inputs.
          .readObjectMetadata(
            'unsupported_type' as unknown as AdtObjectType,
            'TEST',
            undefined,
            { analyse: analyseException },
          ),
      ).rejects.toThrow('Unsupported object type for metadata');
    },
  );
});

/**
 * Integration test for MetadataExtension
 * Tests using AdtClient for unified CRUD operations with BaseTester
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - MetadataExtension library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPatterns=metadataExtension
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtClient } from '../../../../clients/AdtClient';
import type {
  IMetadataExtensionConfig,
  IMetadataExtensionState,
} from '../../../../core/metadataExtension';
import { BaseTester } from '../../../helpers/BaseTester';
import { getConfig } from '../../../helpers/sessionConfig';
import {
  createConnectionLogger,
  createLibraryLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';

const {
  resolvePackageName,
  resolveTransportRequest,
  getTimeout,
} = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code uses DEBUG_ADT_LIBS
const libraryLogger: ILogger = createLibraryLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('MetadataExtension (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let tester: BaseTester<IMetadataExtensionConfig, IMetadataExtensionState>;

  function generateDefaultSourceCode(
    extName: string,
    targetEntity: string,
  ): string {
    return `@MetadataExtension : {
  @EndUserText.label: 'Metadata Extension for ${targetEntity}'
}
extend view ${targetEntity} with "${extName}"
{
  @EndUserText.label: 'Sample Field'
  SampleField;
}`;
  }

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, libraryLogger);
      hasConfig = true;

      tester = new BaseTester(
        client.getMetadataExtension(),
        'MetadataExtension',
        'create_metadata_extension',
        'adt_metadata_extension',
        testsLogger,
      );

      tester.setup({
        connection,
        client,
        hasConfig,
        isCloudSystem: false, // Not used for MetadataExtension
        buildConfig: (testCase: any, resolver?: any) => {
          const params = testCase?.params || {};
          // Use resolver to get resolved parameters (from test case params or global defaults)
          const packageName =
            resolver?.getPackageName?.() ||
            resolvePackageName(params.package_name);
          if (!packageName) {
            throw new Error(
              'Package name is not configured. Set params.package_name or environment.default_package',
            );
          }

          const extName =
            params.ext_name || params.name || params.metadata_extension_name;

          if (!extName) {
            throw new Error(
              'ext_name is not configured for MetadataExtension test',
            );
          }

          const targetEntity = (
            params.target_entity ||
            params.targetEntity ||
            params.cds_view_name
          )?.trim();

          if (!targetEntity) {
            throw new Error(
              'target_entity is not configured for MetadataExtension test. Use existing CDS view name.',
            );
          }

          const description =
            params.description || `Metadata Extension for ${targetEntity}`;

          const transportRequest =
            resolver?.getTransportRequest?.() ||
            resolveTransportRequest(params.transport_request);
          return {
            name: extName,
            packageName,
            targetEntity,
            description,
            transportRequest,
            sourceCode:
              params.source_code ||
              generateDefaultSourceCode(extName, targetEntity),
          };
        },
      });
    } catch (_error) {
      hasConfig = false;
    }
  });

  afterAll(() => tester?.afterAll()());

  describe('Full workflow', () => {
    beforeEach(() => tester?.beforeEach()());
    afterEach(() => tester?.afterEach()());

    it(
      'should execute full workflow and store all results',
      async () => {
        if (!tester) {
          return;
        }
        if (!hasConfig) {
          await tester.flowTestAuto();
          return;
        }
        const config = tester.getConfig();
        if (!config) {
          await tester.flowTestAuto();
          return;
        }

        await tester.flowTestAuto({
          sourceCode: config.sourceCode,
          readMetadata: true,
          readMetadataOptions: { withLongPolling: true },
          updateConfig: {
            name: config.name,
            sourceCode: config.sourceCode,
          },
        });
      },
      getTimeout('test'),
    );
  });
});

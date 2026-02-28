/**
 * Integration test for Domain
 * Tests using AdtClient for unified CRUD operations with BaseTester
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_ADT_LIBS=true    - Domain library logs
 *  DEBUG_CONNECTORS=true   - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPatterns=domain/Domain
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtClient } from '../../../../clients/AdtClient';
import type { IDomainConfig, IDomainState } from '../../../../core/domain';
import { getDomain } from '../../../../core/domain/read';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { BaseTester } from '../../../helpers/BaseTester';
import {
  getConfig,
  resolveSystemContext,
} from '../../../helpers/sessionConfig';
import { TestConfigResolver } from '../../../helpers/TestConfigResolver';
import {
  createConnectionLogger,
  createLibraryLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';
import {
  logTestEnd,
  logTestError,
  logTestSkip,
  logTestStart,
  logTestSuccess,
} from '../../../helpers/testProgressLogger';

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

// Library code (Domain) uses DEBUG_ADT_LIBS
const libraryLogger: ILogger = createLibraryLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('Domain (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;
  let tester: BaseTester<IDomainConfig, IDomainState>;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      isCloudSystem = await isCloudEnvironment(connection);
      const systemContext = await resolveSystemContext(
        connection,
        isCloudSystem,
      );
      client = new AdtClient(connection, libraryLogger, systemContext);
      hasConfig = true;

      tester = new BaseTester(
        client.getDomain(),
        'Domain',
        'create_domain',
        'adt_domain',
        testsLogger,
      );

      tester.setup({
        connection,
        client,
        hasConfig,
        isCloudSystem,
        buildConfig: (testCase: any, resolver?: any) => {
          const params = testCase?.params || {};
          // Use resolver to get resolved parameters (from test case params or global defaults)
          const packageName =
            resolver?.getPackageName?.() ||
            resolvePackageName(params.package_name);
          if (!packageName) throw new Error('package_name not configured');
          const transportRequest =
            resolver?.getTransportRequest?.() ||
            resolveTransportRequest(params.transport_request);
          return {
            domainName: params.domain_name,
            packageName,
            transportRequest,
            description: params.description,
            datatype: params.datatype || 'CHAR',
            length: params.length || 10,
            decimals: params.decimals,
            conversion_exit: params.conversion_exit,
            lowercase: params.lowercase,
            sign_exists: params.sign_exists,
            value_table: params.value_table,
            fixed_values: params.fixed_values,
          };
        },
        ensureObjectReady: async (domainName: string) => {
          if (!connection) return { success: true };
          try {
            await getDomain(connection, domainName);
            return {
              success: false,
              reason: `⚠️ SAFETY: Domain ${domainName} already exists!`,
            };
          } catch (error: any) {
            if (error.response?.status !== 404) {
              return {
                success: false,
                reason: `Cannot verify domain existence: ${error.message}`,
              };
            }
          }
          return { success: true };
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
          updateConfig: {
            domainName: config.domainName,
            packageName: config.packageName,
            description: config.description || '',
            datatype: config.datatype,
            length: config.length,
            decimals: config.decimals,
          },
        });
      },
      getTimeout('test'),
    );
  });

  describe('Read standard object', () => {
    it(
      'should read standard SAP domain',
      async () => {
        // Use TestConfigResolver for consistent parameter resolution
        const resolver = new TestConfigResolver({
          isCloud: isCloudSystem,
          logger: testsLogger,
        });
        const standardObject = resolver.getStandardObject('domain');

        if (!standardObject) {
          logTestStart(testsLogger, 'Domain - read standard object', {
            name: 'read_standard',
            params: {},
          });
          logTestSkip(
            testsLogger,
            'Domain - read standard object',
            `Standard domain not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`,
          );
          return;
        }

        const standardDomainName = standardObject.name;
        logTestStart(testsLogger, 'Domain - read standard object', {
          name: 'read_standard',
          params: { domain_name: standardDomainName },
        });

        if (!hasConfig || !tester) {
          logTestSkip(
            testsLogger,
            'Domain - read standard object',
            'No SAP configuration',
          );
          return;
        }

        try {
          const resultState = await tester.readTest({
            domainName: standardDomainName,
          });
          expect(resultState?.readResult).toBeDefined();
          const domainConfig = resultState?.readResult;
          if (
            domainConfig &&
            typeof domainConfig === 'object' &&
            'domainName' in domainConfig
          ) {
            expect((domainConfig as any).domainName).toBe(standardDomainName);
            expect((domainConfig as any).description).toBeDefined();
          }

          logTestSuccess(testsLogger, 'Domain - read standard object');
        } catch (error) {
          logTestError(testsLogger, 'Domain - read standard object', error);
          throw error;
        } finally {
          logTestEnd(testsLogger, 'Domain - read standard object');
        }
      },
      getTimeout('test'),
    );
  });
});

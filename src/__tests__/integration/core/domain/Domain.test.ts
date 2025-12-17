/**
 * Integration test for DomainBuilder
 * Tests using AdtClient for unified CRUD operations with BaseTester
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - DomainBuilder library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=domain/DomainBuilder
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { AdtClient } from '../../../../clients/AdtClient';
import { IDomainConfig, IDomainState } from '../../../../core/domain';
import { getDomain } from '../../../../core/domain/read';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { getConfig } from '../../../helpers/sessionConfig';
import { createConnectionLogger, createBuilderLogger, createTestsLogger } from '../../../helpers/testLogger';
import {
  logBuilderTestStart,
  logBuilderTestSkip,
  logBuilderTestSuccess,
  logBuilderTestError,
  logBuilderTestEnd
} from '../../../helpers/builderTestLogger';
import { BaseTester } from '../../../helpers/BaseTester';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const {
  getTestCaseDefinition,
  resolvePackageName,
  resolveTransportRequest,
  resolveStandardObject,
  getTimeout
} = require('../../../helpers/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code (DomainBuilder) uses DEBUG_ADT_LIBS
const builderLogger: ILogger = createBuilderLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('DomainBuilder (using AdtClient)', () => {
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
      client = new AdtClient(connection, builderLogger);
      hasConfig = true;
      isCloudSystem = await isCloudEnvironment(connection);

      tester = new BaseTester(
        client.getDomain(),
        'Domain',
        'create_domain',
        'adt_domain',
        testsLogger
      );

      tester.setup({
        connection,
        client,
        hasConfig,
        isCloudSystem,
        buildConfig: (testCase: any) => {
          const params = testCase?.params || {};
          const packageName = resolvePackageName(params.package_name);
          if (!packageName) throw new Error('package_name not configured');
          return {
            domainName: params.domain_name,
            packageName,
            transportRequest: resolveTransportRequest(params.transport_request),
            description: params.description,
            datatype: params.datatype || 'CHAR',
            length: params.length || 10,
            decimals: params.decimals,
            conversion_exit: params.conversion_exit,
            lowercase: params.lowercase,
            sign_exists: params.sign_exists,
            value_table: params.value_table,
            fixed_values: params.fixed_values
          };
        },
        ensureObjectReady: async (domainName: string) => {
          if (!connection) return { success: true };
          try {
            await getDomain(connection, domainName);
            return { success: false, reason: `⚠️ SAFETY: Domain ${domainName} already exists!` };
          } catch (error: any) {
            if (error.response?.status !== 404) {
              return { success: false, reason: `Cannot verify domain existence: ${error.message}` };
            }
          }
          return { success: true };
        }
      });
    } catch (error) {
      hasConfig = false;
    }
  });

  afterAll(() => tester?.afterAll()());

  describe('Full workflow', () => {
    beforeEach(() => tester?.beforeEach()());
    afterEach(() => tester?.afterEach()());

    it('should execute full workflow and store all results', async () => {
      if (!hasConfig || !tester) {
        return;
      }
      const config = tester.getConfig();
      if (!config) {
        return;
      }
      
      await tester.flowTestAuto({
        updateConfig: {
          domainName: config.domainName,
          packageName: config.packageName,
          description: config.description || '',
          datatype: config.datatype,
          length: config.length,
          decimals: config.decimals
        }
      });
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP domain', async () => {
      const testCase = getTestCaseDefinition('create_domain', 'adt_domain');
      const standardObject = resolveStandardObject('domain', isCloudSystem, testCase);

      if (!standardObject) {
        logBuilderTestStart(testsLogger, 'Domain - read standard object', {
          name: 'read_standard',
          params: {}
        });
        logBuilderTestSkip(testsLogger, 'Domain - read standard object',
          `Standard domain not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`);
        return;
      }

      const standardDomainName = standardObject.name;
      logBuilderTestStart(testsLogger, 'Domain - read standard object', {
        name: 'read_standard',
        params: { domain_name: standardDomainName }
      });

      if (!hasConfig || !tester) {
        logBuilderTestSkip(testsLogger, 'Domain - read standard object', 'No SAP configuration');
        return;
      }

      try {
        const resultState = await tester.readTest({ domainName: standardDomainName });
        expect(resultState?.readResult).toBeDefined();
        const domainConfig = resultState?.readResult;
        if (domainConfig && typeof domainConfig === 'object' && 'domainName' in domainConfig) {
          expect((domainConfig as any).domainName).toBe(standardDomainName);
          expect((domainConfig as any).description).toBeDefined();
        }

        logBuilderTestSuccess(testsLogger, 'Domain - read standard object');
      } catch (error) {
        logBuilderTestError(testsLogger, 'Domain - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'Domain - read standard object');
      }
    }, getTimeout('test'));
  });
});

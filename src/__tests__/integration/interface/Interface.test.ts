/**
 * Integration test for InterfaceBuilder
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - InterfaceBuilder library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=interface/InterfaceBuilder
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { AdtClient } from '../../../clients/AdtClient';
import { getInterface } from '../../../core/interface/read';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import { getConfig } from '../../helpers/sessionConfig';
import {
  logBuilderTestStart,
  logBuilderTestSkip,
  logBuilderTestSuccess,
  logBuilderTestError,
  logBuilderTestEnd
} from '../../helpers/builderTestLogger';
import { createConnectionLogger, createBuilderLogger, createTestsLogger } from '../../helpers/testLogger';
import { BaseTester } from '../../helpers/BaseTester';
import { IInterfaceConfig, IInterfaceState } from '../../../core/interface';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const {
  getTestCaseDefinition,
  resolvePackageName,
  resolveTransportRequest,
  resolveStandardObject,
  getTimeout
} = require('../../helpers/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code (AdtClient) uses DEBUG_ADT_LIBS
const builderLogger: ILogger = createBuilderLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('Interface (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;
  let tester: BaseTester<IInterfaceConfig, IInterfaceState>;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, builderLogger);
      hasConfig = true;
      isCloudSystem = await isCloudEnvironment(connection);

      tester = new BaseTester(
        client.getInterface(),
        'Interface',
        'create_interface',
        'adt_interface',
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
            interfaceName: params.interface_name,
            packageName,
            transportRequest: resolveTransportRequest(params.transport_request),
            description: params.description,
            sourceCode: params.source_code
          };
        },
        ensureObjectReady: async (interfaceName: string) => {
          if (!connection) return { success: true };
          try {
            await getInterface(connection, interfaceName);
            return { success: false, reason: `⚠️ SAFETY: Interface ${interfaceName} already exists!` };
          } catch (error: any) {
            if (error.response?.status !== 404) {
              return { success: false, reason: `Cannot verify interface existence: ${error.message}` };
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
        sourceCode: config.sourceCode,
        updateConfig: {
          interfaceName: config.interfaceName,
          packageName: config.packageName,
          description: config.description || '',
          sourceCode: config.sourceCode
        }
      });
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP interface', async () => {
      const testCase = getTestCaseDefinition('create_interface', 'adt_interface');
      const standardObject = resolveStandardObject('interface', isCloudSystem, testCase);

      if (!standardObject) {
        logBuilderTestStart(testsLogger, 'Interface - read standard object', {
          name: 'read_standard',
          params: {}
        });
        logBuilderTestSkip(
          testsLogger,
          'Interface - read standard object',
          `Standard interface not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`
        );
        return;
      }

      const standardInterfaceName = standardObject.name;
      logBuilderTestStart(testsLogger, 'Interface - read standard object', {
        name: 'read_standard',
        params: { interface_name: standardInterfaceName }
      });

      if (!hasConfig) {
        logBuilderTestSkip(testsLogger, 'Interface - read standard object', 'No SAP configuration');
        return;
      }

      try {
        const resultState = await tester.readTest({ interfaceName: standardInterfaceName });
        expect(resultState?.readResult).toBeDefined();
        const interfaceConfig = resultState?.readResult;
        if (interfaceConfig && typeof interfaceConfig === 'object' && 'interfaceName' in interfaceConfig) {
          expect((interfaceConfig as any).interfaceName).toBe(standardInterfaceName);
        }

        logBuilderTestSuccess(testsLogger, 'Interface - read standard object');
      } catch (error) {
        logBuilderTestError(testsLogger, 'Interface - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'Interface - read standard object');
      }
    }, getTimeout('test'));
  });
});


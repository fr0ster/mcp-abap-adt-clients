/**
 * Integration test for StructureBuilder
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - StructureBuilder library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=structure/StructureBuilder
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { AdtClient } from '../../../clients/AdtClient';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import { getConfig } from '../../helpers/sessionConfig';
import {
  logBuilderTestStart,
  logBuilderTestSkip,
  logBuilderTestSuccess,
  logBuilderTestError,
  logBuilderTestEnd
} from '../../helpers/builderTestLogger';
import { createBuilderLogger, createConnectionLogger, createTestsLogger } from '../../helpers/testLogger';
import { BaseTester } from '../../helpers/BaseTester';
import { IStructureConfig, IStructureState } from '../../../core/structure';
import { getStructure } from '../../../core/structure/read';
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

// Library code uses DEBUG_ADT_LIBS
const builderLogger: ILogger = createBuilderLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('StructureBuilder (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;
  let tester: BaseTester<IStructureConfig, IStructureState>;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, builderLogger);
      hasConfig = true;
      isCloudSystem = await isCloudEnvironment(connection);

      tester = new BaseTester(
        client.getStructure(),
        'Structure',
        'create_structure',
        'adt_structure',
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
            structureName: params.structure_name,
            packageName,
            transportRequest: resolveTransportRequest(params.transport_request),
            description: params.description,
            ddlCode: params.ddl_code
          };
        },
        ensureObjectReady: async (structureName: string) => {
          if (!connection) return { success: true };
          try {
            await getStructure(connection, structureName);
            return { success: false, reason: `⚠️ SAFETY: Structure ${structureName} already exists!` };
          } catch (error: any) {
            if (error.response?.status !== 404) {
              return { success: false, reason: `Cannot verify structure existence: ${error.message}` };
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

      const testCase = tester.getTestCaseDefinition();
      const updatedDdlCode = testCase?.params?.updated_ddl_code || config.ddlCode || '';

      await tester.flowTestAuto({
        sourceCode: updatedDdlCode,
        updateConfig: {
          structureName: config.structureName,
          packageName: config.packageName,
          description: config.description || '',
          ddlCode: updatedDdlCode
        }
      });
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP structure', async () => {
      const testCase = getTestCaseDefinition('create_structure', 'adt_structure');
      const standardObject = resolveStandardObject('structure', isCloudSystem, testCase);

      if (!standardObject) {
        logBuilderTestStart(testsLogger, 'Structure - read standard object', {
          name: 'read_standard',
          params: {}
        });
        logBuilderTestSkip(testsLogger, 'Structure - read standard object',
          `Standard structure not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`);
        return;
      }

      const standardStructureName = standardObject.name;
      logBuilderTestStart(testsLogger, 'Structure - read standard object', {
        name: 'read_standard',
        params: { structure_name: standardStructureName }
      });

      if (!hasConfig) {
        logBuilderTestSkip(testsLogger, 'Structure - read standard object', 'No SAP configuration');
        return;
      }

      try {
        const resultState = await tester.readTest({ structureName: standardStructureName });
        expect(resultState?.readResult).toBeDefined();
        const structureConfig = resultState?.readResult;
        if (structureConfig && typeof structureConfig === 'object' && 'structureName' in structureConfig) {
          expect((structureConfig as any).structureName).toBe(standardStructureName);
        }

        logBuilderTestSuccess(testsLogger, 'Structure - read standard object');
      } catch (error) {
        logBuilderTestError(testsLogger, 'Structure - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'Structure - read standard object');
      }
    }, getTimeout('test'));
  });
});

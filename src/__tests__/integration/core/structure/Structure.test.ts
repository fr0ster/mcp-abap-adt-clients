/**
 * Integration test for Structure
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_ADT_LIBS=true    - Structure library logs
 *  DEBUG_CONNECTORS=true   - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=structure/Structure
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtClient } from '../../../../clients/AdtClient';
import type {
 IStructureConfig,
 IStructureState,
} from '../../../../core/structure';
import { getStructure } from '../../../../core/structure/read';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { BaseTester } from '../../../helpers/BaseTester';
import {
 logTestEnd,
 logTestError,
 logTestSkip,
 logTestStart,
 logTestSuccess,
} from '../../../helpers/testProgressLogger';
import { getConfig } from '../../../helpers/sessionConfig';
import { TestConfigResolver } from '../../../helpers/TestConfigResolver';
import {
 createLibraryLogger,
 createConnectionLogger,
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

describe('Structure (using AdtClient)', () => {
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
   client = new AdtClient(connection, libraryLogger);
   hasConfig = true;
   isCloudSystem = await isCloudEnvironment(connection);

   tester = new BaseTester(
    client.getStructure(),
    'Structure',
    'create_structure',
    'adt_structure',
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
      structureName: params.structure_name,
      packageName,
      transportRequest,
      description: params.description,
      ddlCode: params.ddl_code,
     };
    },
    ensureObjectReady: async (structureName: string) => {
     if (!connection) return { success: true };
     try {
      await getStructure(connection, structureName);
      return {
       success: false,
       reason: `⚠️ SAFETY: Structure ${structureName} already exists!`,
      };
     } catch (error: any) {
      if (error.response?.status !== 404) {
       return {
        success: false,
        reason: `Cannot verify structure existence: ${error.message}`,
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

    const testCase = tester.getTestCaseDefinition();
    const updatedDdlCode =
     testCase?.params?.updated_ddl_code || config.ddlCode || '';

    await tester.flowTestAuto({
     sourceCode: updatedDdlCode,
     updateConfig: {
      structureName: config.structureName,
      packageName: config.packageName,
      description: config.description || '',
      ddlCode: updatedDdlCode,
     },
    });
   },
   getTimeout('test'),
  );
 });

 describe('Read standard object', () => {
  it(
   'should read standard SAP structure',
   async () => {
    // Use TestConfigResolver for consistent parameter resolution
    const resolver = new TestConfigResolver({
     isCloud: isCloudSystem,
     logger: testsLogger,
    });
    const standardObject = resolver.getStandardObject('structure');

    if (!standardObject) {
     logTestStart(testsLogger, 'Structure - read standard object', {
      name: 'read_standard',
      params: {},
     });
     logTestSkip(
      testsLogger,
      'Structure - read standard object',
      `Standard structure not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`,
     );
     return;
    }

    const standardStructureName = standardObject.name;
    logTestStart(testsLogger, 'Structure - read standard object', {
     name: 'read_standard',
     params: { structure_name: standardStructureName },
    });

    if (!hasConfig) {
     logTestSkip(
      testsLogger,
      'Structure - read standard object',
      'No SAP configuration',
     );
     return;
    }

    try {
     const resultState = await tester.readTest({
      structureName: standardStructureName,
     });
     expect(resultState?.readResult).toBeDefined();
     const structureConfig = resultState?.readResult;
     if (
      structureConfig &&
      typeof structureConfig === 'object' &&
      'structureName' in structureConfig
     ) {
      expect((structureConfig as any).structureName).toBe(
       standardStructureName,
      );
     }

     logTestSuccess(
      testsLogger,
      'Structure - read standard object',
     );
    } catch (error) {
     logTestError(
      testsLogger,
      'Structure - read standard object',
      error,
     );
     throw error;
    } finally {
     logTestEnd(testsLogger, 'Structure - read standard object');
    }
   },
   getTimeout('test'),
  );
 });
});

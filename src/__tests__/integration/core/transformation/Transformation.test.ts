/**
 * Integration test for Transformation - SimpleTransformation
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_ADT_LIBS=true    - Transformation library logs
 *  DEBUG_CONNECTORS=true   - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPatterns=transformation/Transformation
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import type {
  ITransformationConfig,
  ITransformationState,
} from '../../../../core/transformation';
import { getTransformation } from '../../../../core/transformation/read';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { BaseTester } from '../../../helpers/BaseTester';
import {
  createTestAdtClient,
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
  getEnabledTestCase,
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

describe('Transformation - SimpleTransformation (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;
  let isLegacy = false;
  let tester: BaseTester<ITransformationConfig, ITransformationState>;

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
      const { client: resolvedClient, isLegacy: legacy } =
        await createTestAdtClient(connection, libraryLogger, systemContext);
      client = resolvedClient;
      isLegacy = legacy;
      hasConfig = true;

      tester = new BaseTester(
        client.getTransformation(),
        'Transformation-ST',
        'create_transformation',
        'adt_simple_transformation',
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
            transformationName: params.transformation_name,
            transformationType:
              params.transformation_type || 'SimpleTransformation',
            packageName,
            transportRequest,
            description: params.description,
            sourceCode: params.source_code,
          };
        },
        ensureObjectReady: async (transformationName: string) => {
          if (!connection) return { success: true };
          try {
            await getTransformation(connection, transformationName);
            return {
              success: false,
              objectExists: true,
              reason: `SAFETY: Transformation ${transformationName} already exists!`,
            };
          } catch (error: any) {
            if (error.response?.status !== 404) {
              return {
                success: false,
                reason: `Cannot verify transformation existence: ${error.message}`,
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
        const defaultSourceCode = `<?sap.transform simple?>
<tt:transform xmlns:tt="http://www.sap.com/transformation-templates">
  <tt:root name="ROOT"/>
  <tt:template>
    <root>
      <tt:value ref="ROOT"/>
    </root>
  </tt:template>
</tt:transform>`;

        const sourceCode =
          testCase?.params?.source_code ||
          config.sourceCode ||
          defaultSourceCode;

        await tester.flowTestAuto({
          sourceCode: sourceCode,
          updateConfig: {
            transformationName: config.transformationName,
            transformationType:
              config.transformationType || 'SimpleTransformation',
            packageName: config.packageName,
            description: config.description || '',
            sourceCode: sourceCode,
          },
        });
      },
      getTimeout('test'),
    );
  });

  describe('Read standard object', () => {
    it(
      'should read standard SAP transformation',
      async () => {
        const {
          getTestCaseDefinition,
        } = require('../../../helpers/test-helper');
        const testCase = getTestCaseDefinition(
          'read_transformation',
          'read_standard_transformation',
        );

        if (!testCase) {
          logTestStart(testsLogger, 'Transformation - read standard object', {
            name: 'read_standard',
            params: {},
          });
          logTestSkip(
            testsLogger,
            'Transformation - read standard object',
            'Test case not defined in test-config.yaml',
          );
          return;
        }

        const enabledTestCase = getEnabledTestCase(
          'read_transformation',
          'read_standard_transformation',
        );
        if (!enabledTestCase) {
          logTestStart(testsLogger, 'Transformation - read standard object', {
            name: 'read_standard',
            params: {},
          });
          logTestSkip(
            testsLogger,
            'Transformation - read standard object',
            'Test case disabled or not found',
          );
          return;
        }

        // Get transformation name from test case params
        let transformationName =
          enabledTestCase.params?.transformation_name_cloud && isCloudSystem
            ? enabledTestCase.params.transformation_name_cloud
            : enabledTestCase.params?.transformation_name_onprem &&
                !isCloudSystem
              ? enabledTestCase.params.transformation_name_onprem
              : enabledTestCase.params?.transformation_name;

        if (!transformationName) {
          // Fallback to standard_objects registry using TestConfigResolver
          const resolver = new TestConfigResolver({
            isCloud: isCloudSystem,
            logger: testsLogger,
          });
          const standardObject = resolver.getStandardObject('transformation');
          if (!standardObject) {
            logTestStart(testsLogger, 'Transformation - read standard object', {
              name: 'read_standard',
              params: {},
            });
            logTestSkip(
              testsLogger,
              'Transformation - read standard object',
              `Standard transformation not configured for ${isCloudSystem ? 'cloud' : isLegacy ? 'legacy' : 'on-premise'} environment`,
            );
            return;
          }
          transformationName = standardObject.name;
        }

        logTestStart(testsLogger, 'Transformation - read standard object', {
          name: 'read_standard',
          params: { transformation_name: transformationName },
        });

        if (!hasConfig) {
          logTestSkip(
            testsLogger,
            'Transformation - read standard object',
            'No SAP configuration',
          );
          return;
        }

        try {
          const resultState = await tester.readTest({
            transformationName: transformationName,
          });
          if (!resultState) {
            logTestSkip(
              testsLogger,
              'Transformation - read standard object',
              `Standard transformation ${transformationName} not found in system`,
            );
            return;
          }
          expect(resultState.readResult).toBeDefined();

          logTestSuccess(testsLogger, 'Transformation - read standard object');
        } catch (error: any) {
          logTestError(
            testsLogger,
            'Transformation - read standard object',
            error,
          );
          throw error;
        } finally {
          logTestEnd(testsLogger, 'Transformation - read standard object');
        }
      },
      getTimeout('test'),
    );
  });
});

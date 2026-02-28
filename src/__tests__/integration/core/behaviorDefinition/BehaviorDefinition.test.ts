/**
 * Integration test for BehaviorDefinition
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 * - DEBUG_ADT_TESTS=true npm test -- --testPathPatterns=behaviorDefinition    (ADT-clients logs)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtClient } from '../../../../clients/AdtClient';
import type {
  IBehaviorDefinitionConfig,
  IBehaviorDefinitionState,
} from '../../../../core/behaviorDefinition';
import { read as readBdef } from '../../../../core/behaviorDefinition/read';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { BaseTester } from '../../../helpers/BaseTester';
import {
  getConfig,
  resolveSystemContext,
} from '../../../helpers/sessionConfig';
import {
  createConnectionLogger,
  createLibraryLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';

const {
  resolvePackageName,
  getEnvironmentConfig,
  getTimeout,
  ensureSharedPackage,
  ensureSharedDependency,
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

describe('BehaviorDefinition (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let systemContext: Awaited<ReturnType<typeof resolveSystemContext>>;
  let tester: BaseTester<IBehaviorDefinitionConfig, IBehaviorDefinitionState>;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      const isCloudSystem = await isCloudEnvironment(connection);
      systemContext = await resolveSystemContext(connection, isCloudSystem);
      client = new AdtClient(connection, libraryLogger, systemContext);
      hasConfig = true;

      await ensureSharedPackage(client, testsLogger);

      tester = new BaseTester(
        client.getBehaviorDefinition(),
        'BehaviorDefinition',
        'create_behavior_definition',
        'adt_behavior_definition',
        testsLogger,
      );

      tester.setup({
        connection,
        client,
        hasConfig,
        isCloudSystem: false,
        buildConfig: (testCase: any, resolver?: any) => {
          const params = testCase?.params || {};
          const packageName =
            resolver?.getPackageName?.() ||
            resolvePackageName(params.package_name);
          if (!packageName) throw new Error('Package name is not configured');
          return {
            name: params.bdef_name,
            packageName,
            rootEntity: params.root_entity,
            implementationType:
              params.implementation_type || params.implementationType,
            description: params.description,
            transportRequest:
              params.transport_request ||
              getEnvironmentConfig().default_transport ||
              '',
            sourceCode: params.source_code,
          };
        },
        ensureObjectReady: async (bdefName: string) => {
          if (!connection) return { success: true };
          try {
            await readBdef(connection, bdefName, '', 'active');
            return {
              success: false,
              reason: `SAFETY: BehaviorDefinition ${bdefName} already exists!`,
            };
          } catch (error: any) {
            if (error.response?.status !== 404) {
              return {
                success: false,
                reason: `Cannot verify behavior definition existence: ${error.message}`,
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

  describe('Full workflow test', () => {
    beforeEach(async () => {
      if (!hasConfig || !tester) return;

      const testCase = tester.getTestCaseDefinition();
      await tester.beforeEach()();

      if (!testCase?.params) return;
      const params = testCase.params;

      // Ensure shared dependencies exist (created once, never deleted)
      if (params.dep_table_name) {
        await ensureSharedDependency(
          client,
          'tables',
          params.dep_table_name,
          testsLogger,
        );
      }
      if (params.dep_view_name) {
        await ensureSharedDependency(
          client,
          'views',
          params.dep_view_name,
          testsLogger,
        );
      }
    });

    afterEach(async () => {
      if (!hasConfig || !tester) return;
      await tester.afterEach()();
    });

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
        const sourceCode =
          testCase?.params?.source_code || config.sourceCode || '';

        await tester.flowTestAuto({
          sourceCode: sourceCode,
          readMetadata: true,
          readMetadataOptions: { withLongPolling: true },
          updateConfig: {
            name: config.name,
            packageName: config.packageName,
            rootEntity: config.rootEntity,
            implementationType: config.implementationType,
            description: config.description || '',
            sourceCode: sourceCode,
          },
        });
      },
      getTimeout('test'),
    );
  });
});

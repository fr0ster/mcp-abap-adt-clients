/**
 * Integration test for BehaviorImplementation
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 * - DEBUG_ADT_TESTS=true npm test -- --testPathPatterns=behaviorImplementation    (ADT-clients logs)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtClient } from '../../../../clients/AdtClient';
import type {
  IBehaviorImplementationConfig,
  IBehaviorImplementationState,
} from '../../../../core/behaviorImplementation';
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

describe('BehaviorImplementation (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let systemContext: Awaited<ReturnType<typeof resolveSystemContext>>;
  let tester: BaseTester<
    IBehaviorImplementationConfig,
    IBehaviorImplementationState
  >;

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
        client.getBehaviorImplementation(),
        'BehaviorImplementation',
        'create_behavior_implementation',
        'adt_behavior_implementation',
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
          const className = params.class_name || params.test_class_name;
          if (!className) throw new Error('class_name is not configured');
          const behaviorDefinition = (
            params.behavior_definition ||
            params.bdef_name ||
            params.root_entity
          )?.trim();
          if (!behaviorDefinition)
            throw new Error('behavior_definition is not configured');
          return {
            className,
            packageName,
            behaviorDefinition,
            description:
              params.description ||
              `Behavior Implementation for ${behaviorDefinition}`,
            transportRequest:
              params.transport_request ||
              getEnvironmentConfig().default_transport ||
              '',
            sourceCode: params.source_code,
          };
        },
        ensureObjectReady: async () => ({ success: true }),
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
      if (params.dep_bdef_name) {
        await ensureSharedDependency(
          client,
          'behavior_definitions',
          params.dep_bdef_name,
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
            className: config.className,
            packageName: config.packageName,
            behaviorDefinition: config.behaviorDefinition,
            description: config.description || '',
            sourceCode: sourceCode,
          },
        });
      },
      getTimeout('test'),
    );
  });
});

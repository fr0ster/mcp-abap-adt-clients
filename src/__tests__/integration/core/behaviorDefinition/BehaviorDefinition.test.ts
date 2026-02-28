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
  resolveTransportRequest,
  getEnvironmentConfig,
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
    let tableCreated = false;
    let viewCreated = false;
    let depTableName: string | null = null;
    let depViewName: string | null = null;

    beforeEach(async () => {
      if (!hasConfig || !tester) return;

      const testCase = tester.getTestCaseDefinition();
      await tester.beforeEach()();

      if (!testCase?.params) return;
      const params = testCase.params;
      const packageName = resolvePackageName(params.package_name);
      const transportRequest = resolveTransportRequest(
        params.transport_request,
      );

      // Create dependency table (skip if already exists)
      if (params.dep_table_name && params.dep_table_source && packageName) {
        depTableName = params.dep_table_name;
        try {
          const depClient = new AdtClient(
            connection,
            libraryLogger,
            systemContext,
          );
          await depClient.getTable().create({
            tableName: depTableName!,
            packageName,
            description: `Dependency table for ${params.bdef_name}`,
            ddlCode: params.dep_table_source,
            transportRequest,
          });
          tableCreated = true;
          testsLogger.info?.(`Created dependency table ${depTableName}`);
        } catch (error: any) {
          if (
            error.message?.includes('409') ||
            error.message?.includes('already exist')
          ) {
            testsLogger.info?.(
              `Dependency table ${depTableName} already exists, reusing`,
            );
          } else {
            testsLogger.warn?.(
              `Failed to create dependency table ${depTableName}: ${error.message}`,
            );
          }
        }
      }

      // Create dependency CDS view (skip if already exists)
      if (params.dep_view_name && params.dep_view_ddl_source && packageName) {
        depViewName = params.dep_view_name;
        try {
          const depClient = new AdtClient(
            connection,
            libraryLogger,
            systemContext,
          );
          await depClient.getView().create({
            viewName: depViewName!,
            packageName,
            description:
              params.dep_view_description ||
              `Dependency view for ${params.bdef_name}`,
            ddlSource: params.dep_view_ddl_source,
            transportRequest,
          });
          viewCreated = true;
          testsLogger.info?.(`Created dependency CDS view ${depViewName}`);
        } catch (error: any) {
          if (
            error.message?.includes('409') ||
            error.message?.includes('already exist')
          ) {
            testsLogger.info?.(
              `Dependency CDS view ${depViewName} already exists, reusing`,
            );
          } else {
            testsLogger.warn?.(
              `Failed to create dependency CDS view ${depViewName}: ${error.message}`,
            );
          }
        }
      }
    });

    afterEach(async () => {
      if (!hasConfig || !tester) return;
      await tester.afterEach()();

      const envConfig = getEnvironmentConfig();
      const skipCleanup = envConfig.skip_cleanup === true;
      const cleanupAfterTest = envConfig.cleanup_after_test !== false;
      const shouldCleanup = cleanupAfterTest && !skipCleanup;

      if (!shouldCleanup) return;

      const transportRequest = resolveTransportRequest(
        tester.getTestCaseDefinition()?.params?.transport_request,
      );

      // Cleanup dependency CDS view
      if (viewCreated && depViewName) {
        try {
          await client.getView().delete({
            viewName: depViewName,
            transportRequest,
          });
          testsLogger.info?.(`Cleaned up dependency CDS view ${depViewName}`);
        } catch (error: any) {
          testsLogger.warn?.(
            `Failed to cleanup CDS view ${depViewName}: ${error.message}`,
          );
        }
      }

      // Cleanup dependency table
      if (tableCreated && depTableName) {
        try {
          await client.getTable().delete({
            tableName: depTableName,
            transportRequest,
          });
          testsLogger.info?.(`Cleaned up dependency table ${depTableName}`);
        } catch (error: any) {
          testsLogger.warn?.(
            `Failed to cleanup table ${depTableName}: ${error.message}`,
          );
        }
      }
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

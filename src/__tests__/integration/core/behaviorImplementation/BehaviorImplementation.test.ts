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
  resolveTransportRequest,
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
    let tableCreated = false;
    let viewCreated = false;
    let bdefCreated = false;
    let depTableName: string | null = null;
    let depViewName: string | null = null;
    let depBdefName: string | null = null;

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

      const delay = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));

      // Helper: ensure dependency object exists (create if missing, then update + activate + wait)
      const ensureDependency = async (
        label: string,
        createFn: () => Promise<any>,
        updateFn: () => Promise<any>,
        activateFn: () => Promise<any>,
        waitForActiveFn: () => Promise<any>,
      ): Promise<boolean> => {
        // Step 1: Try to create (skip if already exists)
        try {
          await createFn();
          testsLogger.info?.(`Created ${label}`);
          await delay(3000);
        } catch (error: any) {
          if (
            error.message?.includes('409') ||
            error.message?.includes('already exist')
          ) {
            testsLogger.info?.(`${label} already exists, reusing`);
          } else {
            testsLogger.warn?.(`Failed to create ${label}: ${error.message}`);
            // Continue — object may already exist despite non-409 error
          }
        }
        // Step 2: Update source code (lock → update → unlock)
        try {
          await updateFn();
          testsLogger.info?.(`Updated ${label}`);
          await delay(3000);
        } catch (error: any) {
          testsLogger.warn?.(`Failed to update ${label}: ${error.message}`);
        }
        // Step 3: Activate (starts the activation process)
        try {
          await activateFn();
          testsLogger.info?.(`Activation started for ${label}`);
        } catch (error: any) {
          testsLogger.warn?.(`Failed to activate ${label}: ${error.message}`);
          return false;
        }
        // Step 4: Wait for activation to complete (long polling read)
        try {
          await waitForActiveFn();
          testsLogger.info?.(`${label} is active and ready`);
          return true;
        } catch (error: any) {
          testsLogger.warn?.(
            `${label} may not be fully active yet: ${error.message}`,
          );
          // Still return true — activation was started, might need more time
          await delay(5000);
          return true;
        }
      };

      // Create dependency table → update → activate
      if (params.dep_table_name && params.dep_table_source && packageName) {
        depTableName = params.dep_table_name;
        const depClient = new AdtClient(
          connection,
          libraryLogger,
          systemContext,
        );
        const tableHandler = depClient.getTable();
        tableCreated = await ensureDependency(
          `table ${depTableName}`,
          () =>
            tableHandler.create({
              tableName: depTableName!,
              packageName,
              description: `Dependency table for ${params.class_name}`,
              ddlCode: params.dep_table_source,
              transportRequest,
            }),
          () =>
            tableHandler.update(
              {
                tableName: depTableName!,
                ddlCode: params.dep_table_source,
                transportRequest,
              },
              { sourceCode: params.dep_table_source },
            ),
          () => tableHandler.activate({ tableName: depTableName! }),
          () =>
            tableHandler.read({ tableName: depTableName! }, 'active', {
              withLongPolling: true,
            }),
        );
      }

      // Create dependency CDS view → update → activate
      if (params.dep_view_name && params.dep_view_ddl_source && packageName) {
        depViewName = params.dep_view_name;
        const depClient = new AdtClient(
          connection,
          libraryLogger,
          systemContext,
        );
        const viewHandler = depClient.getView();
        viewCreated = await ensureDependency(
          `CDS view ${depViewName}`,
          () =>
            viewHandler.create({
              viewName: depViewName!,
              packageName,
              description:
                params.dep_view_description ||
                `Dependency view for ${params.class_name}`,
              ddlSource: params.dep_view_ddl_source,
              transportRequest,
            }),
          () =>
            viewHandler.update(
              {
                viewName: depViewName!,
                ddlSource: params.dep_view_ddl_source,
                transportRequest,
              },
              { sourceCode: params.dep_view_ddl_source },
            ),
          () => viewHandler.activate({ viewName: depViewName! }),
          () =>
            viewHandler.read({ viewName: depViewName! }, 'active', {
              withLongPolling: true,
            }),
        );
      }

      // Create dependency BDEF → update with activation (full chain)
      if (params.dep_bdef_name && params.dep_bdef_source_code && packageName) {
        depBdefName = params.dep_bdef_name;
        const depClient = new AdtClient(
          connection,
          libraryLogger,
          systemContext,
        );
        const bdefHandler = depClient.getBehaviorDefinition();

        // Step 1: Try to create (skip if already exists)
        try {
          await bdefHandler.create({
            name: depBdefName!,
            packageName,
            rootEntity: params.dep_bdef_root_entity || depBdefName,
            implementationType:
              params.dep_bdef_implementation_type || 'Managed',
            description:
              params.dep_bdef_description ||
              `Dependency BDEF for ${params.class_name}`,
            sourceCode: params.dep_bdef_source_code,
            transportRequest,
          });
          testsLogger.info?.(`Created BDEF ${depBdefName}`);
          await delay(3000);
        } catch (error: any) {
          if (
            error.message?.includes('409') ||
            error.message?.includes('already exist')
          ) {
            testsLogger.info?.(`BDEF ${depBdefName} already exists, reusing`);
          } else {
            testsLogger.warn?.(
              `Failed to create BDEF ${depBdefName}: ${error.message}`,
            );
          }
        }

        // Step 2: Update with activateOnUpdate (lock → check → update → unlock → check → activate → long poll)
        try {
          const updateState = await bdefHandler.update(
            {
              name: depBdefName!,
              sourceCode: params.dep_bdef_source_code,
              transportRequest,
            },
            {
              sourceCode: params.dep_bdef_source_code,
              activateOnUpdate: true,
            },
          );
          bdefCreated = true;
          testsLogger.info?.(
            `BDEF ${depBdefName} updated and activated successfully`,
          );
        } catch (error: any) {
          testsLogger.warn?.(
            `Failed to update/activate BDEF ${depBdefName}: ${error.message}`,
          );
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

      // Cleanup in reverse order: BDEF → view → table
      if (bdefCreated && depBdefName) {
        try {
          await client.getBehaviorDefinition().delete({
            name: depBdefName!,
            transportRequest,
          });
          testsLogger.info?.(`Cleaned up dependency BDEF ${depBdefName}`);
        } catch (error: any) {
          testsLogger.warn?.(
            `Failed to cleanup BDEF ${depBdefName}: ${error.message}`,
          );
        }
      }

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

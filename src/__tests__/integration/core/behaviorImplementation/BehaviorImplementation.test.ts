/**
 * Integration test for BehaviorImplementation
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 * - DEBUG_ADT_TESTS=true npm test -- --testPathPattern=behaviorImplementation    (ADT-clients logs)
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
import { BaseTester } from '../../../helpers/BaseTester';
import { getConfig } from '../../../helpers/sessionConfig';
import {
  createConnectionLogger,
  createLibraryLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';

const {
  getTestCaseDefinition,
  resolvePackageName,
  getEnvironmentConfig,
  getTimeout,
  resolveTransportRequest,
  createDependencyBehaviorDefinition,
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
  let _connectionConfig: any = null;
  let hasConfig = false;
  let tester: BaseTester<
    IBehaviorImplementationConfig,
    IBehaviorImplementationState
  >;

  beforeAll(async () => {
    try {
      const config = getConfig();
      _connectionConfig = config;
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, libraryLogger);
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
          // Use resolver to get resolved parameters (from test case params or global defaults)
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
            sourceCode:
              params.source_code ||
              generateDefaultImplementationCode(className, behaviorDefinition),
          };
        },
        ensureObjectReady: async () => ({ success: true }),
      });
    } catch (_error) {
      hasConfig = false;
    }
  });

  afterAll(() => tester?.afterAll()());

  function generateDefaultImplementationCode(
    _className: string,
    behaviorDefinition: string,
  ): string {
    const localHandlerName = `lhc_${behaviorDefinition}`;
    return `CLASS ${localHandlerName} DEFINITION INHERITING FROM cl_abap_behavior_handler.
  PRIVATE SECTION.
    METHODS get_instance_authorizations FOR INSTANCE AUTHORIZATION
      IMPORTING keys REQUEST requested_authorizations FOR ${behaviorDefinition.toLowerCase()} RESULT result.

    METHODS get_global_authorizations FOR GLOBAL AUTHORIZATION
      IMPORTING REQUEST requested_authorizations FOR ${behaviorDefinition.toLowerCase()} RESULT result.

ENDCLASS.

CLASS ${localHandlerName} IMPLEMENTATION.

  METHOD get_instance_authorizations.

  ENDMETHOD.

  METHOD get_global_authorizations.

  ENDMETHOD.

ENDCLASS.`;
  }

  describe('Full workflow test', () => {
    let behaviorDefinitionName: string | null = null;
    let behaviorDefinitionCreated: boolean = false;

    beforeEach(async () => {
      // Create behavior definition before test if needed
      const testCase = tester.getTestCaseDefinition();
      if (
        testCase?.params?.behavior_definition_name &&
        testCase?.params?.behavior_definition_source
      ) {
        const packageName = resolvePackageName(testCase.params.package_name);
        if (packageName) {
          const behaviorDefinitionConfig = {
            bdefName: testCase.params.behavior_definition_name,
            packageName: packageName,
            description: `Test behavior definition for ${testCase.params.class_name || testCase.params.test_class_name}`,
            rootEntity:
              testCase.params.root_entity ||
              testCase.params.behavior_definition_name,
            implementationType:
              testCase.params.implementation_type || 'Managed',
            sourceCode: testCase.params.behavior_definition_source,
            transportRequest: resolveTransportRequest(
              testCase.params.transport_request,
            ),
          };

          const behaviorDefinitionResult =
            await createDependencyBehaviorDefinition(
              client,
              behaviorDefinitionConfig,
              testCase,
            );

          if (behaviorDefinitionResult.success) {
            behaviorDefinitionName = testCase.params.behavior_definition_name;
            behaviorDefinitionCreated =
              behaviorDefinitionResult.created || false;
          }
        }
      }
      tester?.beforeEach()();
    });

    afterEach(async () => {
      tester?.afterEach()();
      // Cleanup behavior definition if it was created in beforeEach
      if (behaviorDefinitionCreated && behaviorDefinitionName) {
        try {
          await client.getBehaviorDefinition().delete({
            name: behaviorDefinitionName,
            transportRequest:
              resolveTransportRequest(
                tester.getTestCaseDefinition()?.params?.transport_request,
              ) || '',
          });
        } catch (cleanupError) {
          testsLogger.warn?.(
            `Cleanup failed for behavior definition ${behaviorDefinitionName}:`,
            cleanupError,
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

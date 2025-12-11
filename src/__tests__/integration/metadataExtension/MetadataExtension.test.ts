/**
 * Integration test for MetadataExtensionBuilder
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 * - DEBUG_ADT_TESTS=true npm test -- --testPathPattern=metadataExtension    (ADT-clients logs)
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { AdtClient } from '../../../clients/AdtClient';
import { IAdtLogger } from '../../../utils/logger';
import { getConfig } from '../../helpers/sessionConfig';
import {
  logBuilderTestStart,
  logBuilderTestSkip,
  logBuilderTestSuccess,
  logBuilderTestError,
  logBuilderTestEnd,
  logBuilderTestStep,
  logBuilderTestStepError,
  getHttpStatusText
} from '../../helpers/builderTestLogger';
import { createConnectionLogger, createBuilderLogger, createTestsLogger } from '../../helpers/testLogger';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const {
  getEnabledTestCase,
  getTestCaseDefinition,
  resolvePackageName,
  resolveStandardObject,
  getEnvironmentConfig,
  getTimeout,
  getOperationDelay,
  resolveTransportRequest,
  createDependencyCdsView
} = require('../../helpers/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const debugEnabled = process.env.DEBUG_ADT_TESTS === 'true' || process.env.DEBUG_ADT === 'true';
const debugConnection = process.env.DEBUG_CONNECTORS === 'true'; // Connection uses DEBUG_CONNECTORS

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code uses DEBUG_ADT_LIBS
const builderLogger: IAdtLogger = createBuilderLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: IAdtLogger = createTestsLogger();

describe('MetadataExtensionBuilder (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let connectionConfig: any = null;
  let hasConfig = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connectionConfig = config;
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, builderLogger);
      hasConfig = true;
    } catch (error) {
      testsLogger.warn?.('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterAll(async () => {
    if (connection) {
      connection.reset();
    }
  });

  function getBuilderTestDefinition() {
    return getTestCaseDefinition('create_metadata_extension', 'builder_metadata_extension');
  }

  function buildBuilderConfig(testCase: any) {
    const params = testCase?.params || {};

    const packageName =
      params.package_name ||
      resolvePackageName(undefined);
    if (!packageName) {
      throw new Error('Package name is not configured. Set params.package_name or environment.default_package');
    }

    const extName =
      params.ext_name ||
      params.name ||
      params.metadata_extension_name;

    if (!extName) {
      throw new Error('ext_name is not configured for MetadataExtensionBuilder test');
    }

    const targetEntity = (
      params.target_entity ||
      params.targetEntity ||
      params.cds_view_name
    )?.trim();

    if (!targetEntity) {
      throw new Error('target_entity is not configured for MetadataExtensionBuilder test');
    }

    const description = params.description || `Metadata Extension for ${targetEntity}`;

    return {
      extName,
      packageName,
      targetEntity,
      description,
      transportRequest: params.transport_request || getEnvironmentConfig().default_transport || '',
      sourceCode: params.source_code || generateDefaultSourceCode(extName, targetEntity)
    };
  }

  function generateDefaultSourceCode(extName: string, targetEntity: string): string {
    return `@MetadataExtension : {
  @EndUserText.label: 'Metadata Extension for ${targetEntity}'
}
extend view ${targetEntity} with "${extName}"
{
  @EndUserText.label: 'Sample Field'
  SampleField;
}`;
  }

  describe('Full workflow test', () => {
    let testCase: any = null;
    let extName: string | null = null;
    let viewName: string | null = null;
    let viewCreated: boolean = false;
    let skipReason: string | null = null;

    beforeAll(async () => {
      if (!hasConfig) {
        skipReason = 'No connection configuration available';
        return;
      }

      const definition = getBuilderTestDefinition();
      if (!definition) {
        skipReason = 'Test case not defined in test-config.yaml';
        return;
      }

      const tc = getEnabledTestCase('create_metadata_extension', 'builder_metadata_extension');
      if (!tc) {
        skipReason = 'Test case disabled or not found';
        return;
      }

      const packageName = tc.params.package_name || resolvePackageName(undefined);
      if (!packageName) {
        skipReason = 'Package name is not configured. Set params.package_name or environment.default_package';
        return;
      }
      tc.params.package_name = packageName;

      testCase = tc;
      extName = tc.params.ext_name || tc.params.name || tc.params.metadata_extension_name;

      // Create CDS view before test if view_name and ddl_source are provided
      if (tc.params.view_name && tc.params.ddl_source) {
        const viewConfig = {
          viewName: tc.params.view_name,
          packageName: packageName,
          description: `Test CDS view for ${extName}`,
          ddlSource: tc.params.ddl_source,
          transportRequest: resolveTransportRequest(tc.params.transport_request)
        };

        // Note: createDependencyCdsView expects CrudClient, but we can use AdtClient.getView()
        const tempCrudClient = new (require('../../../clients/CrudClient').CrudClient)(connection);
        const viewResult = await createDependencyCdsView(tempCrudClient, viewConfig, tc);
        
        if (!viewResult.success) {
          skipReason = viewResult.reason || `environment problem, test skipped: Failed to create required dependency CDS view ${tc.params.view_name}`;
          testCase = null;
          extName = null;
          return;
        }

        viewName = tc.params.view_name;
        viewCreated = viewResult.created || false;
      }
    });

    afterAll(async () => {
      // Cleanup CDS view if it was created in beforeAll
      if (viewCreated && viewName) {
        try {
          await client.getView().delete({
            viewName: viewName,
            transportRequest: resolveTransportRequest(testCase?.params?.transport_request)
          });
        } catch (cleanupError) {
          // Log but don't fail - cleanup errors are silent
          testsLogger.warn?.(`Cleanup failed for CDS view ${viewName}:`, cleanupError);
        }
      }
    });

    it('should execute full workflow and store all results', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(testsLogger, 'MetadataExtensionBuilder - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(testsLogger, 'MetadataExtensionBuilder - full workflow', skipReason);
        return;
      }

      if (!testCase || !extName) {
        logBuilderTestSkip(testsLogger, 'MetadataExtensionBuilder - full workflow', skipReason || 'Test case not available');
        return;
      }

      const config = buildBuilderConfig(testCase);
      let metadataExtensionCreated = false;
      let currentStep = '';

      try {
        currentStep = 'validate';
        logBuilderTestStep(currentStep);
        const validationState = await client.getMetadataExtension().validate({
          name: config.extName,
          packageName: config.packageName,
          description: config.description
        });
        const validationResponse = validationState?.validationResponse;
        
        // If validation returns 400 and object already exists, skip test
        if (validationResponse?.status === 400) {
          const errorData = validationResponse?.data;
          const errorText = typeof errorData === 'string' ? errorData : JSON.stringify(errorData || {});
          if (errorText.toLowerCase().includes('already exists') ||
              errorText.toLowerCase().includes('does already exist') ||
              (errorText.toLowerCase().includes('resource') && errorText.toLowerCase().includes('exist'))) {
            logBuilderTestSkip(testsLogger, 'MetadataExtensionBuilder - full workflow', 
              `⚠️ SAFETY: Metadata extension ${config.extName} already exists! ` +
              `Delete manually or use different test name to avoid accidental deletion.`);
            return; // Skip test - object already exists, don't delete it
          }
        }
        
        // Validation successful (200) - object can be created
        if (validationResponse?.status !== 200) {
          const errorData = typeof validationResponse?.data === 'string' 
            ? validationResponse.data 
            : JSON.stringify(validationResponse?.data);
          console.error(`Validation failed (HTTP ${validationResponse?.status}): ${errorData}`);
          throw new Error(`Validation failed with status ${validationResponse?.status}`);
        }
        
        currentStep = 'create';
        logBuilderTestStep(currentStep);
        await client.getMetadataExtension().create({
          name: config.extName,
          packageName: config.packageName,
          description: config.description,
          transportRequest: config.transportRequest
        }, { activateOnCreate: false, sourceCode: config.sourceCode });
        metadataExtensionCreated = true;
        
        const createDelay = getOperationDelay('create', testCase);
        if (createDelay > 0) {
          logBuilderTestStep(`wait (after create ${createDelay}ms)`);
          await new Promise(resolve => setTimeout(resolve, createDelay));
        }
        
        logBuilderTestStep('read');
        // Read metadata extension source to verify it was created
        const readState = await client.getMetadataExtension().read({ name: config.extName }, 'inactive');
        expect(readState).toBeDefined();
        expect(readState?.readResult).toBeDefined();
        
        currentStep = 'check before update';
        logBuilderTestStep(currentStep);
        await client.getMetadataExtension().check({ name: config.extName });
        
        currentStep = 'update';
        logBuilderTestStep(currentStep);
        await client.getMetadataExtension().update({
          name: config.extName
        }, { sourceCode: config.sourceCode });
        
        const updateDelay = getOperationDelay('update', testCase);
        if (updateDelay > 0) {
          logBuilderTestStep(`wait (after update ${updateDelay}ms)`);
          await new Promise(resolve => setTimeout(resolve, updateDelay));
        }
        
        logBuilderTestStep('check(inactive)');
        const checkResult1State = await client.getMetadataExtension().check({ name: config.extName }, 'inactive');
        const checkResult1 = checkResult1State?.checkResult;
        expect(checkResult1?.status).toBeDefined();
        
        logBuilderTestStep('activate');
        await client.getMetadataExtension().activate({ name: config.extName });
        
        const activateDelay = getOperationDelay('activate', testCase);
        if (activateDelay > 0) {
          logBuilderTestStep(`wait (after activate ${activateDelay}ms)`);
          await new Promise(resolve => setTimeout(resolve, activateDelay));
        }
        
        logBuilderTestStep('check(active)');
        const checkResult2State = await client.getMetadataExtension().check({ name: config.extName }, 'active');
        const checkResult2 = checkResult2State?.checkResult;
        expect(checkResult2?.status).toBeDefined();

        logBuilderTestSuccess(testsLogger, 'MetadataExtensionBuilder - full workflow');
      } catch (error: any) {
        // Log step error with details before failing test
        logBuilderTestStepError(currentStep || 'unknown', error);

        // Cleanup: delete if object was created
        if (metadataExtensionCreated) {
          try {
            logBuilderTestStep('delete (cleanup)');
            await client.getMetadataExtension().delete({
              name: config.extName,
              transportRequest: config.transportRequest
            });
          } catch (cleanupError) {
            // Log cleanup error but don't fail test - original error is more important
            testsLogger.warn?.(`Cleanup failed for ${config.extName}:`, cleanupError);
          }
        }

        const statusText = getHttpStatusText(error);
        const enhancedError = statusText !== 'HTTP ?'
          ? Object.assign(new Error(`[${statusText}] ${error.message}`), { stack: error.stack })
          : error;
        logBuilderTestError(testsLogger, 'MetadataExtensionBuilder - full workflow', enhancedError);
        throw enhancedError;
      } finally {
        // Cleanup: delete metadata extension only if it was created in this test
        if (extName && metadataExtensionCreated) {
          try {
            logBuilderTestStep('delete (cleanup)');
            await client.getMetadataExtension().delete({
              name: extName,
              transportRequest: testCase?.params?.transport_request || getEnvironmentConfig().default_transport || ''
            });
            testsLogger.info?.('Metadata extension deleted successfully during cleanup');
          } catch (deleteError: any) {
            testsLogger.warn?.('Failed to delete metadata extension during cleanup:', deleteError.message || deleteError);
          }
        }
        logBuilderTestEnd(testsLogger, 'MetadataExtensionBuilder - full workflow');
      }
    }, getTimeout('test'));
  });
});


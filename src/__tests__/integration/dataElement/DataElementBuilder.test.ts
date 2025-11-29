/**
 * Integration test for DataElementBuilder
 * Tests using CrudClient for unified CRUD operations
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - DataElementBuilder library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=dataElement/DataElementBuilder
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { CrudClient } from '../../../clients/CrudClient';
import { DataElementBuilder } from '../../../core/dataElement';
import { IAdtLogger } from '../../../utils/logger';
import { getDataElement } from '../../../core/dataElement/read';
import { isCloudEnvironment } from '../../../utils/systemInfo';
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
import { createBuilderLogger, createConnectionLogger, createTestsLogger, isDebugEnabled } from '../../helpers/testLogger';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const {
  getEnabledTestCase,
  getTestCaseDefinition,
  resolvePackageName,
  resolveTransportRequest,
  ensurePackageConfig,
  resolveStandardObject,
  getTimeout,
  getOperationDelay,
  retryCheckAfterActivate,
  createDependencyDomain,
  extractValidationErrorMessage
} = require('../../helpers/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// E2E tests use DEBUG_ADT_E2E_TESTS for test code
// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
// Library code (DataElementBuilder) uses DEBUG_ADT_LIBS

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code uses DEBUG_ADT_LIBS
const builderLogger: IAdtLogger = createBuilderLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: IAdtLogger = createTestsLogger();

describe('DataElementBuilder (using CrudClient)', () => {
  let connection: AbapConnection;
  let client: CrudClient;
  let hasConfig = false;
  let isCloudSystem = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new CrudClient(connection);
      hasConfig = true;
      // Check if this is a cloud system
      isCloudSystem = await isCloudEnvironment(connection);
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

  /**
   * Pre-check: Verify test data element doesn't exist
   * Safety: Skip test if object exists to avoid accidental deletion
   */
  async function ensureDataElementReady(dataElementName: string): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: true };
    }

    // Check if data element exists
    try {
      await getDataElement(connection, dataElementName);
      return {
        success: false,
        reason: `⚠️ SAFETY: Data Element ${dataElementName} already exists! ` +
                `Delete manually or use different test name to avoid accidental deletion.`
      };
    } catch (error: any) {
      // 404 is expected - object doesn't exist, we can proceed
      if (error.response?.status !== 404) {
        return {
          success: false,
          reason: `Cannot verify data element existence: ${error.message}`
        };
      }
    }

    return { success: true };
  }

  function getBuilderTestDefinition() {
    return getTestCaseDefinition('create_data_element', 'builder_data_element');
  }

  function buildBuilderConfig(testCase: any) {
    const params = testCase?.params || {};
    const packageName = resolvePackageName(params.package_name);
    if (!packageName) {
      throw new Error('package_name not configured for DataElementBuilder test');
    }
    return {
      dataElementName: params.data_element_name,
      packageName,
      transportRequest: resolveTransportRequest(params.transport_request),
      description: params.description,
      dataType: params.data_type,
      length: params.length,
      decimals: params.decimals,
      shortLabel: params.short_label,
      mediumLabel: params.medium_label,
      longLabel: params.long_label,
      headingLabel: params.heading_label,
      typeKind: params.type_kind,
      typeName: params.type_name
    };
  }


  describe('Full workflow', () => {
    let testCase: any = null;
    let dataElementName: string | null = null;
    let domainName: string | null = null;
    let domainCreated: boolean = false;
    let skipReason: string | null = null;

    beforeEach(async () => {
      skipReason = null;
      testCase = null;
      dataElementName = null;
      domainName = null;
      domainCreated = false;

      if (!hasConfig) {
        skipReason = 'No SAP configuration';
        return;
      }

      const definition = getBuilderTestDefinition();
      if (!definition) {
        skipReason = 'Test case not defined in test-config.yaml';
        return;
      }

      const tc = getEnabledTestCase('create_data_element', 'builder_data_element');
      if (!tc) {
        skipReason = 'Test case disabled or not found';
        return;
      }

      const packageCheck = ensurePackageConfig(tc.params, 'DataElementBuilder - full workflow');
      if (!packageCheck.success) {
        skipReason = packageCheck.reason || 'Default package is not configured';
        return;
      }

      testCase = tc;
      dataElementName = tc.params.data_element_name;

      // Create domain before test if type_kind is 'domain' and type_name (domain name) is provided
      if (tc.params.type_kind === 'domain' && (tc.params.type_name || tc.params.domain_name)) {
        const domainNameToUse = tc.params.type_name || tc.params.domain_name;
        const packageName = resolvePackageName(tc.params.package_name);
        if (!packageName) {
          skipReason = 'environment problem, test skipped: package_name not configured for domain creation';
          testCase = null;
          dataElementName = null;
          return;
        }

        const domainConfig = {
          domainName: domainNameToUse,
          packageName: packageName,
          description: `Test domain for ${dataElementName}`,
          dataType: tc.params.domain_data_type || 'CHAR',
          length: tc.params.domain_length || 10,
          decimals: tc.params.domain_decimals || 0,
          transportRequest: resolveTransportRequest(tc.params.transport_request)
        };

        const domainResult = await createDependencyDomain(client, domainConfig, tc);
        
        if (!domainResult.success) {
          skipReason = domainResult.reason || `environment problem, test skipped: Failed to create required dependency domain ${domainNameToUse}`;
          testCase = null;
          dataElementName = null;
          return;
        }

        domainName = domainNameToUse;
        domainCreated = domainResult.created || false;
      }

      // Cleanup before test
      if (dataElementName) {
        const cleanup = await ensureDataElementReady(dataElementName);
        if (!cleanup.success) {
          skipReason = cleanup.reason || 'Failed to cleanup data element before test';
          testCase = null;
          dataElementName = null;
          domainName = null;
          domainCreated = false;
        }
      }
    });

    afterEach(async () => {
      // Cleanup domain if it was created in beforeEach
      if (domainCreated && domainName) {
        try {
          await client.deleteDomain({
            domainName: domainName,
            transportRequest: resolveTransportRequest(testCase?.params?.transport_request)
          });
        } catch (cleanupError) {
          // Log but don't fail - cleanup errors are silent
          testsLogger.warn?.(`Cleanup failed for domain ${domainName}:`, cleanupError);
        }
      }
    });

    it('should execute full workflow and store all results', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(testsLogger, 'DataElementBuilder - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(testsLogger, 'DataElementBuilder - full workflow', skipReason);
        return;
      }

      if (!testCase || !dataElementName) {
        logBuilderTestSkip(testsLogger, 'DataElementBuilder - full workflow', skipReason || 'Test case not available');
        return;
      }

      const config = buildBuilderConfig(testCase);

      try {
        logBuilderTestStep('validate');
        const validationResponse = await client.validateDataElement({
          dataElementName: config.dataElementName,
          packageName: config.packageName!,
          description: config.description || ''
        });
        if (validationResponse?.status !== 200) {
          const errorMessage = extractValidationErrorMessage(validationResponse);
          logBuilderTestStepError('validate', {
            response: {
              status: validationResponse?.status,
              data: validationResponse?.data
            }
          });
          logBuilderTestSkip(testsLogger, 'DataElementBuilder - full workflow', 
            `Validation failed: ${errorMessage} - environment problem, test skipped`);
          return;
        }
        
            logBuilderTestStep('create');
        await client.createDataElement(config);
            await new Promise(resolve => setTimeout(resolve, getOperationDelay('create', testCase)));
        
            logBuilderTestStep('lock');
        await client.lockDataElement({ dataElementName: config.dataElementName });
            await new Promise(resolve => setTimeout(resolve, getOperationDelay('lock', testCase)));
        
            logBuilderTestStep('update');
        await client.updateDataElement({
          dataElementName: config.dataElementName,
          packageName: config.packageName!,
          description: config.description || '',
          dataType: config.dataType,
          length: config.length,
          decimals: config.decimals,
          shortLabel: config.shortLabel,
          mediumLabel: config.mediumLabel,
          longLabel: config.longLabel,
          headingLabel: config.headingLabel,
          typeKind: config.typeKind,
          typeName: config.typeName
        });
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('update', testCase)));
        
            logBuilderTestStep('check(inactive)');
        const checkResultInactive = await client.checkDataElement({ dataElementName: config.dataElementName });
        expect(checkResultInactive?.status).toBeDefined();
        
            logBuilderTestStep('unlock');
        await client.unlockDataElement({ dataElementName: config.dataElementName });
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('unlock', testCase)));
        
            logBuilderTestStep('activate');
        await client.activateDataElement({ dataElementName: config.dataElementName });
        // Wait for activation to complete (activation is asynchronous)
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('activate', testCase) || 2000));
        
            logBuilderTestStep('check(active)');
        // Retry check for active version - activation may take time
        const checkResultActive = await retryCheckAfterActivate(
          () => client.checkDataElement({ dataElementName: config.dataElementName }),
          {
            maxAttempts: 5,
            delay: 1000,
            logger: testsLogger,
            objectName: config.dataElementName
          }
        );
        expect(checkResultActive?.status).toBeDefined();
        
            logBuilderTestStep('delete (cleanup)');
        await client.deleteDataElement({
          dataElementName: config.dataElementName,
          transportRequest: config.transportRequest
        });

        expect(client.getCreateResult()).toBeDefined();
        expect(client.getActivateResult()).toBeDefined();

        logBuilderTestSuccess(testsLogger, 'DataElementBuilder - full workflow');
      } catch (error: any) {
        logBuilderTestError(testsLogger, 'DataElementBuilder - full workflow', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'DataElementBuilder - full workflow');
      }
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP data element', async () => {
      const testCase = getTestCaseDefinition('create_data_element', 'builder_data_element');
      const standardObject = resolveStandardObject('dataElement', isCloudSystem, testCase);

      if (!standardObject) {
        logBuilderTestStart(testsLogger, 'DataElementBuilder - read standard object', {
          name: 'read_standard',
          params: {}
        });
        logBuilderTestSkip(testsLogger, 'DataElementBuilder - read standard object',
          `Standard data element not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`);
        return;
      }

      const standardDataElementName = standardObject.name;
      logBuilderTestStart(testsLogger, 'DataElementBuilder - read standard object', {
        name: 'read_standard',
        params: { data_element_name: standardDataElementName }
      });

      if (!hasConfig) {
        logBuilderTestSkip(testsLogger, 'DataElementBuilder - read standard object', 'No SAP configuration');
        return;
      }

      try {
        logBuilderTestStep('read');
        const result = await client.readDataElement(standardDataElementName);
        expect(result).toBeDefined();
        expect(result?.dataElementName).toBe(standardDataElementName);

        logBuilderTestSuccess(testsLogger, 'DataElementBuilder - read standard object');
      } catch (error) {
        logBuilderTestError(testsLogger, 'DataElementBuilder - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'DataElementBuilder - read standard object');
      }
    }, getTimeout('test'));
  });
});


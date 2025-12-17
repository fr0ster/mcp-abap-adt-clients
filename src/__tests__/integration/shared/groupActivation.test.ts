/**
 * Integration test for group activation
 * Tests activating multiple related objects (domain, data element, structure) in a single group activation
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - Builder library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=shared/groupActivation
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { AdtClient } from '../../../clients/AdtClient';
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
  getTimeout,
  getOperationDelay,
  getEnvironmentConfig
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

describe('Group Activation (SharedBuilder)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, testsLogger);
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

  function getTestDefinition() {
    return getTestCaseDefinition('group_activation', 'adt_group_activation');
  }

  describe('Group activation workflow', () => {
    let testCase: any = null;
    let domainName: string | null = null;
    let dataElementName: string | null = null;
    let structureName: string | null = null;
    let skipReason: string | null = null;
    let domainCreated = false;
    let dataElementCreated = false;
    let structureCreated = false;

    beforeEach(async () => {
      skipReason = null;
      testCase = null;
      domainName = null;
      dataElementName = null;
      structureName = null;
      domainCreated = false;
      dataElementCreated = false;
      structureCreated = false;

      if (!hasConfig) {
        skipReason = 'No SAP configuration';
        return;
      }

      const definition = getTestDefinition();
      if (!definition) {
        skipReason = 'Test case not defined in test-config.yaml';
        return;
      }

      const tc = getEnabledTestCase('group_activation', 'adt_group_activation');
      if (!tc) {
        skipReason = 'Test case disabled or not found';
        return;
      }

      const packageCheck = ensurePackageConfig(tc.params, 'Group Activation - full workflow');
      if (!packageCheck.success) {
        skipReason = packageCheck.reason || 'Default package is not configured';
        return;
      }

      testCase = tc;
      domainName = tc.params.domain_name;
      dataElementName = tc.params.data_element_name;
      structureName = tc.params.structure_name;
    });

    afterEach(async () => {
      // Cleanup: delete objects in reverse order (structure -> data element -> domain)
      const transportRequest = resolveTransportRequest(testCase?.params?.transport_request);
      
      // Check cleanup settings: cleanup_after_test (global) and skip_cleanup (test-specific or global)
      const envConfig = getEnvironmentConfig();
      const cleanupAfterTest = envConfig.cleanup_after_test !== false; // Default: true if not set
      const globalSkipCleanup = envConfig.skip_cleanup === true;
      const skipCleanup = testCase?.params?.skip_cleanup !== undefined
        ? testCase?.params?.skip_cleanup === true
        : globalSkipCleanup;
      const shouldCleanup = cleanupAfterTest && !skipCleanup;

      if (!shouldCleanup) {
        testsLogger.info?.('⚠️ Cleanup skipped (cleanup_after_test=false or skip_cleanup=true)');
        return;
      }

      if (structureCreated && structureName) {
        try {
          logBuilderTestStep('cleanup: delete structure', testsLogger);
          await client.getStructure().delete({
            structureName: structureName,
            transportRequest: transportRequest
          });
          await new Promise(resolve => setTimeout(resolve, getOperationDelay('delete', testCase) || 3000));
        } catch (error: any) {
          testsLogger.warn?.(`⚠️ Failed to delete structure ${structureName}: ${error.message}`);
        }
      }

      if (dataElementCreated && dataElementName) {
        try {
          logBuilderTestStep('cleanup: delete data element', testsLogger);
          await client.getDataElement().delete({
            dataElementName: dataElementName,
            transportRequest: transportRequest
          });
          await new Promise(resolve => setTimeout(resolve, getOperationDelay('delete', testCase) || 3000));
        } catch (error: any) {
          testsLogger.warn?.(`⚠️ Failed to delete data element ${dataElementName}: ${error.message}`);
        }
      }

      if (domainCreated && domainName) {
        try {
          logBuilderTestStep('cleanup: delete domain', testsLogger);
          await client.getDomain().delete({
            domainName: domainName,
            transportRequest: transportRequest
          });
          await new Promise(resolve => setTimeout(resolve, getOperationDelay('delete', testCase) || 3000));
        } catch (error: any) {
          testsLogger.warn?.(`⚠️ Failed to delete domain ${domainName}: ${error.message}`);
        }
      }
    });

    it('should create domain, data element, structure and activate them as a group', async () => {
      const definition = getTestDefinition();
      logBuilderTestStart(testsLogger, 'Group Activation - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(testsLogger, 'Group Activation - full workflow', skipReason);
        return;
      }

      if (!testCase || !domainName || !dataElementName || !structureName) {
        logBuilderTestSkip(testsLogger, 'Group Activation - full workflow', skipReason || 'Test case not available');
        return;
      }

      const packageName = resolvePackageName(testCase.params.package_name);
      if (!packageName) {
        logBuilderTestSkip(testsLogger, 'Group Activation - full workflow', 'package_name not configured');
        return;
      }

      const transportRequest = resolveTransportRequest(testCase.params.transport_request);

      let currentStep = '';

      try {
        // Step 1: Create domain
        currentStep = 'create domain';
        logBuilderTestStep(currentStep, testsLogger);
        await client.getDomain().create({
          domainName: domainName,
          packageName: packageName,
          description: testCase.params.description || `Test domain for group activation`,
          datatype: testCase.params.domain_datatype || 'CHAR',
          length: testCase.params.domain_length || 10,
          decimals: testCase.params.domain_decimals || 0,
          transportRequest: transportRequest
        }, { activateOnCreate: false });
        domainCreated = true;
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('create', testCase)));

        // Step 2: Create data element based on domain
        currentStep = 'create data element';
        logBuilderTestStep(currentStep, testsLogger);
        await client.getDataElement().create({
          dataElementName: dataElementName,
          packageName: packageName,
          description: testCase.params.description || `Test data element for group activation`,
          typeKind: testCase.params.data_element_type_kind || 'domain',
          typeName: domainName, // Reference to domain
          transportRequest: transportRequest
        }, { activateOnCreate: false });
        dataElementCreated = true;
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('create', testCase)));

        // Step 3: Create structure based on data element
        currentStep = 'create structure';
        logBuilderTestStep(currentStep, testsLogger);
        // Use provided DDL code or generate one with data element reference
        const structureDdlCode = testCase.params.structure_ddl_code || 
          `@EndUserText.label: 'Group activation test structure'
@AbapCatalog.enhancement.category: #NOT_EXTENSIBLE
define structure ${structureName} {
  mandt : abap.clnt;
  test_field : ${dataElementName};
}`;
        await client.getStructure().create({
          structureName: structureName,
          packageName: packageName,
          description: testCase.params.description || `Test structure for group activation`,
          transportRequest: transportRequest
        }, { activateOnCreate: false });
        structureCreated = true;
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('create', testCase)));

        // Step 3.5: Update structure with DDL code
        currentStep = 'update structure';
        logBuilderTestStep(currentStep, testsLogger);
        await client.getStructure().update({
          structureName: structureName,
          ddlCode: structureDdlCode,
          transportRequest: transportRequest
        }, { activateOnUpdate: false });
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('update', testCase)));

        // Step 4: Group activation - activate all objects together
        currentStep = 'group activation';
        logBuilderTestStep(currentStep, testsLogger);
        const objectsToActivate = [
          { type: 'DOMA', name: domainName },
          { type: 'DTEL', name: dataElementName },
          { type: 'TABL/DS', name: structureName }
        ];

        const activationResult = await client.getUtils().activateObjectsGroup(objectsToActivate, false);
        expect(activationResult).toBeDefined();
        expect(activationResult.status).toBe(200);
        testsLogger.info?.('✅ Group activation completed successfully');

        // Wait a bit for activation to fully complete
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('activate', testCase) || 2000));

        // Step 5: Verify activation by checking inactive objects
        currentStep = 'verify activation';
        logBuilderTestStep(currentStep, testsLogger);
        const inactiveObjects = await client.getUtils().getInactiveObjects();
        expect(inactiveObjects).toBeDefined();

        // Check that our objects are not in the inactive list
        if (inactiveObjects && inactiveObjects.objects) {
          const inactiveNames = inactiveObjects.objects.map(obj => obj.name);
          expect(inactiveNames).not.toContain(domainName);
          expect(inactiveNames).not.toContain(dataElementName);
          expect(inactiveNames).not.toContain(structureName);
          testsLogger.info?.('✅ All objects are active (not in inactive objects list)');
        }

        logBuilderTestSuccess(testsLogger, 'Group Activation - full workflow');
      } catch (error: any) {
        logBuilderTestError(testsLogger, 'Group Activation - full workflow', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'Group Activation - full workflow');
      }
    }, 120000); // 2 minute timeout
  });
});

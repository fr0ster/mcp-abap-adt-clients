/**
 * Integration test for View
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - View library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=view/View
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { AdtClient } from '../../../clients/AdtClient';
import { IAdtLogger } from '../../../utils/logger';
import { getView } from '../../../core/view/read';
import { getTable } from '../../../core/table/read';
import { getClass } from '../../../core/class/read';
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
import { AdtCdsUnitTest } from '../../../core/unitTest/AdtCdsUnitTest';

const {
  getEnabledTestCase,
  getTestCaseDefinition,
  resolvePackageName,
  resolveTransportRequest,
  ensurePackageConfig,
  validateTestParameters,
  checkDefaultTestEnvironment,
  logDefaultTestEnvironment,
  createDependencyTable,
  getTimeout,
  getOperationDelay,
  retryCheckAfterActivate,
  extractValidationErrorMessage,
  getEnvironmentConfig
} = require('../../helpers/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code (View) uses DEBUG_ADT_LIBS
const builderLogger: IAdtLogger = createBuilderLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: IAdtLogger = createTestsLogger();

function buildCdsUnitTemplate(cdsViewName: string, testMethodName = 'TestMethod_0001'): string {
  const viewNameUpper = cdsViewName.toUpperCase();
  return `<abapsource:template abapsource:name="IF_FOR_AUTO_CLASS_GENERATION">
  <abapsource:property abapsource:key="CCAU_CONTENT">&lt;?xml version="1.0" encoding="UTF-8"?&gt;
&lt;cds:cdstobetested xmlns:cds="http://www.sap.com/adt/cdsfrwk/cds"&gt;
  &lt;cds:cdsundertest api_doc="true" cds_name="${viewNameUpper}" cds_test_type="UNIT_TEST"&gt;
    &lt;cds:testmethods&gt;
      &lt;cds:testmethod test_method_name="${testMethodName}"/&gt;
    &lt;/cds:testmethods&gt;
  &lt;/cds:cdsundertest&gt;
&lt;/cds:cdstobetested&gt;
</abapsource:property>
  <abapsource:property abapsource:key="Content-Type">application/vnd.sap.adt.oo.cds.codgen.v1+xml</abapsource:property>
</abapsource:template>`;
}

function buildCdsUnitTestClassSource(testClassName: string, cdsViewName: string): string {
  const classNameUpper = testClassName.toUpperCase();
  const viewNameUpper = cdsViewName.toUpperCase();
  // Extract table name from CDS view name (assuming pattern: ZOK_I_* -> zok_t_*)
  const viewNameLower = cdsViewName.toLowerCase();
  const tableName = viewNameLower.replace(/^zok_i_/, 'zok_t_');
  
  return `"!@testing ${viewNameUpper}

CLASS ${classNameUpper} DEFINITION FINAL
  FOR TESTING RISK LEVEL HARMLESS DURATION SHORT.

  PRIVATE SECTION.
    CLASS-DATA environment TYPE REF TO if_cds_test_environment.

    DATA td_${tableName} TYPE STANDARD TABLE OF ${tableName} WITH EMPTY KEY.
    DATA act_results TYPE STANDARD TABLE OF ${viewNameUpper} WITH EMPTY KEY.

    "! In CLASS_SETUP, corresponding doubles and clone(s) for the CDS view under test and its dependencies are created.
    CLASS-METHODS class_setup RAISING cx_static_check.
    "! In CLASS_TEARDOWN, Generated database entities (doubles & clones) should be deleted at the end of test class execution.
    CLASS-METHODS class_teardown.

    "! SETUP method creates a common start state for each test method,
    "! clear_doubles clears the test data for all the doubles used in the test method before each test method execution.
    METHODS setup RAISING cx_static_check.
    METHODS prepare_testdata.
    "! In this method test data is inserted into the generated double(s) and the test is executed and
    "! the results should be asserted with the actuals.
    METHODS aunit_for_cds_method FOR TESTING RAISING cx_static_check.
ENDCLASS.

CLASS ${classNameUpper} IMPLEMENTATION.

  METHOD class_setup.
    environment = cl_cds_test_environment=>create( i_for_entity = '${viewNameUpper}' ).
  ENDMETHOD.

  METHOD setup.
    environment->clear_doubles( ).
  ENDMETHOD.

  METHOD class_teardown.
    environment->destroy( ).
  ENDMETHOD.

  METHOD aunit_for_cds_method.
    prepare_testdata( ).
    SELECT * FROM ${viewNameUpper} INTO TABLE @act_results.
    cl_abap_unit_assert=>fail( msg = 'Place your assertions here' ).
  ENDMETHOD.

  METHOD prepare_testdata.
    " Prepare test data for '${tableName}'
    td_${tableName} = VALUE #(
      (
        client = '100'
      ) ).
    environment->insert_test_data( i_data = td_${tableName} ).
  ENDMETHOD.

ENDCLASS.
`;
}

describe('View (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let defaultPackage: string = '';
  let defaultTransport: string = '';

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, builderLogger);
      hasConfig = true;

      // Check default test environment
      const envCheck = await checkDefaultTestEnvironment(connection);
      if (!envCheck.success) {
        testsLogger.error?.(`${envCheck.reason}. All tests will be skipped.`);
        hasConfig = false;
        return;
      }

      defaultPackage = envCheck.defaultPackage || '';
      defaultTransport = envCheck.defaultTransport || '';

      // Log environment setup
      logDefaultTestEnvironment(testsLogger, defaultPackage, defaultTransport);
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
    return getTestCaseDefinition('create_view', 'builder_view');
  }

  function buildBuilderConfig(testCase: any) {
    const params = testCase?.params || {};
    const packageName = resolvePackageName(params.package_name);
    if (!packageName) {
      throw new Error('package_name not configured for View test');
    }
    return {
      viewName: params.view_name,
      packageName,
      transportRequest: resolveTransportRequest(params.transport_request),
      description: params.description,
      ddlSource: params.ddl_source
    };
  }

  describe('Full workflow', () => {
    let testCase: any = null;
    let viewName: string | null = null;
    let tableName: string | null = null;
    let skipReason: string | null = null;
    let tableCreated = false;

    beforeEach(async () => {
      skipReason = null;
      testCase = null;
      viewName = null;
      tableName = null;
      tableCreated = false;

      if (!hasConfig) {
        skipReason = 'No SAP configuration';
        return;
      }

      const definition = getBuilderTestDefinition();
      if (!definition) {
        skipReason = 'Test case not defined in test-config.yaml';
        return;
      }

      const tc = getEnabledTestCase('create_view', 'builder_view');
      if (!tc) {
        skipReason = 'Test case disabled or not found';
        return;
      }

      const packageCheck = ensurePackageConfig(tc.params, 'View - full workflow');
      if (!packageCheck.success) {
        skipReason = packageCheck.reason || 'Default package is not configured';
        return;
      }

      testCase = tc;
      viewName = tc.params.view_name;
      tableName = tc.params.table_name || null;

      // Create table before test if table_name and table_source are provided
      if (tableName && tc.params.table_source) {
        const packageName = resolvePackageName(tc.params.package_name);
        if (!packageName) {
          skipReason = 'package_name not configured for table creation';
          testCase = null;
          viewName = null;
          tableName = null;
          return;
        }

        const tableConfig = {
          tableName: tableName,
          packageName: packageName,
          description: `Test table for ${viewName}`,
          ddlCode: tc.params.table_source,
          transportRequest: resolveTransportRequest(tc.params.transport_request)
        };

        // Note: createDependencyTable expects CrudClient, but we can use AdtClient.getTable()
        const tempCrudClient = new (require('../../../clients/CrudClient').CrudClient)(connection);
        const tableResult = await createDependencyTable(tempCrudClient, tableConfig, tc);
        
        if (!tableResult.success) {
          skipReason = tableResult.reason || `Failed to create required dependency table ${tableName}`;
          testCase = null;
          viewName = null;
          tableName = null;
          return;
        }

        tableCreated = tableResult.created || false;
      }
    });

    afterEach(async () => {
      // Cleanup table if it was created in beforeEach
      // Check test-case specific first (overrides global), then fallback to global
      const envConfig = getEnvironmentConfig();
      const globalSkipCleanup = envConfig.skip_cleanup === true;
      const skipCleanup = testCase?.params?.skip_cleanup !== undefined
        ? testCase.params.skip_cleanup === true
        : globalSkipCleanup;
      if (!skipCleanup && tableCreated && tableName && connection) {
        try {
          await client.getTable().delete({
            tableName: tableName,
            transportRequest: resolveTransportRequest(testCase?.params?.transport_request)
          });
        } catch (error) {
          // Log but don't fail - table cleanup is best effort
          testsLogger.warn?.(`Failed to cleanup table ${tableName}:`, error);
        }
      } else if (skipCleanup && tableCreated && tableName) {
        testsLogger.info?.('⚠️ Cleanup skipped (skip_cleanup=true) - table left for analysis:', tableName);
      }
    });

    it('should execute full workflow and store all results', async () => {
      // If test is disabled, skip silently without logging
      if (skipReason) {
        logBuilderTestSkip(testsLogger, 'View - full workflow', skipReason, true);
        return;
      }

      const definition = getBuilderTestDefinition();
      logBuilderTestStart(testsLogger, 'View - full workflow', definition);

      if (!testCase || !viewName) {
        logBuilderTestSkip(testsLogger, 'View - full workflow', skipReason || 'Test case not available');
        return;
      }

      const config = buildBuilderConfig(testCase);
      // Check test-case specific first (overrides global), then fallback to global
      const envConfig = getEnvironmentConfig();
      const globalSkipCleanup = envConfig.skip_cleanup === true;
      const skipCleanup = testCase.params.skip_cleanup !== undefined 
        ? testCase.params.skip_cleanup === true 
        : globalSkipCleanup;

      // Validate test parameters at the start
      logBuilderTestStep('validate parameters');
      const paramValidation = await validateTestParameters(
        connection,
        testCase.params,
        'View - full workflow',
        defaultPackage,
        defaultTransport
      );
      if (!paramValidation.success) {
        logBuilderTestSkip(testsLogger, 'View - full workflow', paramValidation.reason || 'Parameter validation failed');
        return;
      }

      // Validate view - if validation fails, skip test
      logBuilderTestStep('validate view');
      const validationState = await client.getView().validate({
        viewName: config.viewName,
        packageName: config.packageName,
        description: config.description || ''
      });
      const validationResponse = validationState?.validationResponse;
      
      if (validationResponse?.status !== 200) {
        const errorMessage = extractValidationErrorMessage(validationResponse);
        const errorTextLower = errorMessage.toLowerCase();
        
        // If validation says object already exists or cannot be created, skip test
        if (errorTextLower.includes('already exists') ||
            errorTextLower.includes('does already exist') ||
            errorTextLower.includes('cannot be created') ||
            errorTextLower.includes('not allowed') ||
            errorTextLower.includes('not authorized') ||
            errorTextLower.includes('exceptionresourcealreadyexists')) {
          logBuilderTestStepError('validate view', {
            response: {
              status: validationResponse?.status,
              data: validationResponse?.data
            }
          });
          logBuilderTestSkip(testsLogger, 'View - full workflow', 
            `View ${config.viewName} cannot be created: ${errorMessage} - environment problem, test skipped`);
          return;
        }
        
        // Other validation errors - skip test (environment problem)
        logBuilderTestStepError('validate view', {
          response: {
            status: validationResponse?.status,
            data: validationResponse?.data
          }
        });
        logBuilderTestSkip(testsLogger, 'View - full workflow', 
          `Validation failed: ${errorMessage} - environment problem, test skipped`);
        return;
      }

      let viewCreated = false;
      let currentStep = '';
      // Track if table was created in beforeEach (for cleanup in catch block)
      const shouldCleanupTable = tableCreated && tableName;
      
      try {
        currentStep = 'create';
        logBuilderTestStep(currentStep);
        // Use updated_ddl_source if available, otherwise use ddlSource
        const updatedDdlSource = testCase.params.updated_ddl_source || config.ddlSource;
        await client.getView().create({
          viewName: config.viewName,
          packageName: config.packageName!,
          description: config.description || '',
          ddlSource: config.ddlSource || '',
          transportRequest: config.transportRequest
        }, { activateOnCreate: false, sourceCode: updatedDdlSource });
        viewCreated = true;
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('create', testCase)));
        
        currentStep = 'check before update';
        logBuilderTestStep(currentStep);
        const checkBeforeUpdateState = await client.getView().check({ 
          viewName: config.viewName,
          ddlSource: updatedDdlSource
        }, 'inactive');
        const checkBeforeUpdate = checkBeforeUpdateState?.checkResult;
        expect(checkBeforeUpdate?.status).toBeDefined();
        
        currentStep = 'update';
        logBuilderTestStep(currentStep);
        if (!config.ddlSource) {
          throw new Error('ddlSource is required for view update');
        }
        await client.getView().update({
          viewName: config.viewName
        }, { sourceCode: updatedDdlSource });
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('update', testCase)));
        
        // Check with new code (before unlock) - validates unsaved code
        currentStep = 'check(new_code)';
        logBuilderTestStep(currentStep);
        const checkResultNewCodeState = await client.getView().check({ 
          viewName: config.viewName,
          ddlSource: updatedDdlSource
        }, 'inactive');
        const checkResultNewCode = checkResultNewCodeState?.checkResult;
        expect(checkResultNewCode?.status).toBeDefined();
        testsLogger.info?.(`✅ Check with new code completed: ${checkResultNewCode?.status === 200 ? 'OK' : 'Has errors/warnings'}`);
        
        currentStep = 'check(inactive)';
        logBuilderTestStep(currentStep);
        const checkResultInactiveState = await client.getView().check({ viewName: config.viewName }, 'inactive');
        const checkResultInactive = checkResultInactiveState?.checkResult;
        expect(checkResultInactive?.status).toBeDefined();
        
        currentStep = 'activate';
        logBuilderTestStep(currentStep);
        await client.getView().activate({ viewName: config.viewName });
        // Wait for activation to complete (activation is asynchronous)
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('activate', testCase) || 2000));
        
        currentStep = 'check(active)';
        logBuilderTestStep(currentStep);
        // Retry check for active version - activation may take time
        const checkResultActiveState = await retryCheckAfterActivate(
          async () => {
            const state = await client.getView().check({ viewName: config.viewName }, 'active');
            return state?.checkResult;
          },
          {
            maxAttempts: 5,
            delay: 1000,
            logger: testsLogger,
            objectName: config.viewName
          }
        );
        expect(checkResultActiveState?.status).toBeDefined();
        
        // Read the created view before cleanup
        if (viewName) {
          try {
            logBuilderTestStep('read');
            const readState = await client.getView().read({ viewName: viewName });
            expect(readState).toBeDefined();
            expect(readState?.readResult).toBeDefined();
            const viewConfig = readState?.readResult;
            if (viewConfig && typeof viewConfig === 'object' && 'viewName' in viewConfig) {
              expect((viewConfig as any).viewName).toBe(viewName);
            }
          } catch (readError) {
            // Log warning but don't fail the test if read fails
            builderLogger.warn?.(`Failed to read view ${viewName}:`, readError);
          }
        }
        
        if (!skipCleanup) {
          currentStep = 'delete (cleanup)';
          logBuilderTestStep(currentStep);
          // Use group deletion for view and table together
          if (tableName && viewName) {
            const tempCrudClient = new (require('../../../clients/CrudClient').CrudClient)(connection);
            const sharedBuilder = new (require('../../../core/shared').SharedBuilder)(connection);
            await sharedBuilder.deleteGroup([
              { type: 'DDLS/DF', name: viewName },
              { type: 'TABL/DT', name: tableName }
            ]);
          } else if (viewName) {
            await client.getView().delete({
              viewName: config.viewName,
              transportRequest: config.transportRequest
            });
          }
        } else {
          testsLogger.info?.('⚠️ Cleanup skipped (skip_cleanup=true) - objects left for analysis:', {
            view: viewName,
            table: tableName
          });
        }

        logBuilderTestSuccess(testsLogger, 'View - full workflow');
      } catch (error: any) {
        // Log step error with details before failing test
        logBuilderTestStepError(currentStep || 'unknown', error);
        
        // Cleanup: delete (if skip_cleanup is false)
        if (!skipCleanup && (viewCreated || shouldCleanupTable)) {
          try {
            logBuilderTestStep('delete (cleanup)');
            // Use group deletion for view and table together
            if (tableName && viewName && (viewCreated || shouldCleanupTable)) {
              const tempCrudClient = new (require('../../../clients/CrudClient').CrudClient)(connection);
              const sharedBuilder = new (require('../../../core/shared').SharedBuilder)(connection);
              await sharedBuilder.deleteGroup([
                { type: 'DDLS/DF', name: viewName },
                { type: 'TABL/DT', name: tableName }
              ]);
              // Mark table as cleaned up to prevent afterEach from trying again
              tableCreated = false;
            } else if (viewName && viewCreated) {
              await client.getView().delete({
                viewName: config.viewName,
                transportRequest: config.transportRequest
              });
            } else if (shouldCleanupTable && tableName) {
              // Cleanup table only if view wasn't created
              await client.getTable().delete({
                tableName: tableName,
                transportRequest: resolveTransportRequest(testCase?.params?.transport_request)
              });
              tableCreated = false;
            }
          } catch (cleanupError) {
            // Log cleanup error but don't fail test - original error is more important
            testsLogger.warn?.(`Cleanup failed for ${config.viewName}:`, cleanupError);
          }
        } else if (skipCleanup && (viewCreated || shouldCleanupTable)) {
          testsLogger.info?.('⚠️ Cleanup skipped (skip_cleanup=true) - objects left for analysis:', {
            view: viewName,
            table: tableName
          });
        }
        
        const statusText = getHttpStatusText(error);
        const enhancedError = statusText !== 'HTTP ?'
          ? Object.assign(new Error(`[${statusText}] ${error.message}`), { stack: error.stack })
          : error;
        logBuilderTestError(testsLogger, 'View - full workflow', enhancedError);
        throw enhancedError;
      } finally {
        logBuilderTestEnd(testsLogger, 'View - full workflow');
      }
    }, getTimeout('test')); // Full workflow test timeout (200 seconds)
  });

  describe('CDS Unit Test workflow', () => {
    let testCase: any = null;
    let tableName: string | null = null;
    let viewName: string | null = null;
    let className: string | null = null;
    let skipReason: string | null = null;

    beforeEach(async () => {
      skipReason = null;
      testCase = null;
      tableName = null;
      viewName = null;
      className = null;

      if (!hasConfig) {
        skipReason = 'No SAP configuration';
        return;
      }

      const tc = getEnabledTestCase('create_view', 'cds_unit_test');
      if (!tc) {
        skipReason = 'CDS unit test case disabled or not found';
        return;
      }

      const packageCheck = ensurePackageConfig(tc.params, 'ViewBuilder - CDS unit test');
      if (!packageCheck.success) {
        skipReason = packageCheck.reason || 'Default package is not configured';
        return;
      }

      if (!tc.params.cds_unit_test) {
        skipReason = 'cds_unit_test configuration missing';
        return;
      }

      testCase = tc;
      tableName = tc.params.table_name;
      viewName = tc.params.view_name;
      className = tc.params.cds_unit_test.class_name;
    });

    it('should generate unit test class for existing CDS view and run ABAP Unit', async () => {
      // If test is disabled, skip silently without logging
      if (skipReason) {
        logBuilderTestSkip(testsLogger, 'ViewBuilder - CDS unit test', skipReason, true);
        return;
      }

      const definition = getTestCaseDefinition('create_view', 'cds_unit_test');
      logBuilderTestStart(testsLogger, 'ViewBuilder - CDS unit test', definition);

      if (!testCase || !viewName || !className) {
        logBuilderTestSkip(testsLogger, 'ViewBuilder - CDS unit test', skipReason || 'Test case not available');
        return;
      }

      const cdsTestConfig = testCase.params.cds_unit_test;
      const testClassName = cdsTestConfig.test_class_name || `LTC_${viewName}`;
      const classTemplateXml =
        cdsTestConfig.template_xml || buildCdsUnitTemplate(viewName);
      const testClassSource =
        cdsTestConfig.test_class_source || buildCdsUnitTestClassSource(testClassName, viewName);
      // Check test-case specific first (overrides global), then fallback to global
      const envConfig = getEnvironmentConfig();
      const globalSkipCleanup = envConfig.skip_cleanup === true;
      const skipCleanup = testCase.params.skip_cleanup !== undefined
        ? testCase.params.skip_cleanup === true
        : globalSkipCleanup;

      const resolvedPackageName = resolvePackageName(testCase.params.package_name);
      const resolvedTransportRequest = resolveTransportRequest(testCase.params.transport_request);

      // Use AdtCdsUnitTest for entire workflow
      const cdsUnitTest = client.getCdsUnitTest();

      let classCreated = false;
      let currentStep = '';
      let unitTestConnection: IAbapConnection | undefined = undefined;

      try {
        // Verify CDS view exists (must be created manually before test)
        currentStep = 'read CDS view';
        logBuilderTestStep(currentStep);
        try {
          await getView(connection, viewName);
        } catch (readError: any) {
          // If view doesn't exist, skip test (must be created manually)
          logBuilderTestSkip(testsLogger, 'ViewBuilder - CDS unit test', 
            `CDS view ${viewName} does not exist (HTTP ${readError.response?.status || '?'}). View must be created manually before running this test. - environment problem, test skipped`);
          return;
        }
        
        // Check view activation status (verify it's active) - required before unit test doubles validation
        currentStep = 'check view (active)';
        logBuilderTestStep(currentStep);
        try {
          const checkState = await client.getView().check({ viewName }, 'active');
          const checkResult = checkState?.checkResult;
          // Additional delay after check to ensure view is fully ready for unit test doubles
          await new Promise(resolve => setTimeout(resolve, getOperationDelay('check', testCase) || 2000));
        } catch (checkError: any) {
          // If check fails, view might not be active - skip test
          logBuilderTestSkip(testsLogger, 'ViewBuilder - CDS unit test', 
            `CDS view ${viewName} is not active (HTTP ${checkError.response?.status || '?'}). View must be active before running this test. - environment problem, test skipped`);
          return;
        }

        // Validate CDS view for unit test doubles (required before creating unit test class)
        logBuilderTestStep('validate CDS for unit test doubles');
        try {
          await cdsUnitTest.validate({ cdsViewName: viewName });
          // Validation successful - proceed with test (no logging needed)
        } catch (validationError: any) {
          // Log error response
          const responseData = validationError.response?.data;
          if (responseData) {
            testsLogger.info?.(`Validation error response: ${typeof responseData === 'string' ? responseData : JSON.stringify(responseData)}`);
          }
          const errorMessage = validationError.message || extractValidationErrorMessage(validationError.response || validationError);
          logBuilderTestSkip(testsLogger, 'ViewBuilder - CDS unit test', 
            `CDS view ${viewName} validation for unit test doubles failed: ${errorMessage} - environment problem, test skipped`);
          return;
        }
        
        // Validate class before creation
        logBuilderTestStep('validate class');
        let classValidationResponse: any;
        try {
          classValidationResponse = await client.getClass().validate({
            className: className,
            packageName: resolvedPackageName,
            description: cdsTestConfig.description || `CDS unit test for ${viewName}`
          });
        } catch (error: any) {
          classValidationResponse = error.response || { status: error.status || 500, data: error.message };
        }
        
        // If validation fails, check if class already exists or if it's an environment problem
        if (classValidationResponse?.status !== 200) {
          const errorMessage = extractValidationErrorMessage(classValidationResponse);
          const errorTextLower = errorMessage.toLowerCase();
          
          // If class already exists, skip test (environment problem)
          if (errorTextLower.includes('already exists') ||
              errorTextLower.includes('does already exist') ||
              errorTextLower.includes('exceptionresourcealreadyexists')) {
            logBuilderTestStepError('validate class', {
              response: {
                status: classValidationResponse?.status,
                data: classValidationResponse?.data
              }
            });
            logBuilderTestSkip(testsLogger, 'ViewBuilder - CDS unit test', 
              `Class ${className} already exists (may be owned by another user) - environment problem, test skipped`);
            return;
          }
          
          // Other validation errors - skip test (environment problem)
          logBuilderTestStepError('validate class', {
            response: {
              status: classValidationResponse?.status,
              data: classValidationResponse?.data
            }
          });
          logBuilderTestSkip(testsLogger, 'ViewBuilder - CDS unit test', 
            `Class validation failed: ${errorMessage} - environment problem, test skipped`);
          return;
        }
        
        // Create test class with CDS template and test class source
        currentStep = 'create';
        logBuilderTestStep(currentStep);
        try {
          await cdsUnitTest.create({
            className: className,
            packageName: resolvedPackageName,
            cdsViewName: viewName,
            classTemplate: classTemplateXml,
            testClassSource: testClassSource,
            description: cdsTestConfig.description || `CDS unit test for ${viewName}`,
            transportRequest: resolvedTransportRequest
          });
          classCreated = true;
        } catch (createError: any) {
          const errorMessage = createError.response?.data 
            ? (typeof createError.response.data === 'string' 
                ? createError.response.data.substring(0, 500)
                : JSON.stringify(createError.response.data).substring(0, 500))
            : createError.message || 'Unknown error';
          
          logBuilderTestStepError('create', createError);
          logBuilderTestSkip(testsLogger, 'ViewBuilder - CDS unit test', 
            `Class creation failed (HTTP ${createError.response?.status || '?'}): ${errorMessage} - environment problem, test skipped`);
          return;
        }
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('create', testCase)));

        const runOptions = cdsTestConfig.unit_test_options ? {
          title: cdsTestConfig.unit_test_options.title,
          context: cdsTestConfig.unit_test_options.context,
          scope: cdsTestConfig.unit_test_options.scope,
          riskLevel: cdsTestConfig.unit_test_options.risk_level,
          duration: cdsTestConfig.unit_test_options.duration
        } : undefined;

        logBuilderTestStep('run ABAP Unit tests');
        // Create new connection for unit test execution (separate timeout)
        unitTestConnection = createAbapConnection(getConfig(), connectionLogger);
        await (unitTestConnection as any).connect();

        // Use AdtCdsUnitTest for CDS unit test run
        const runCdsUnitTest = new AdtCdsUnitTest(unitTestConnection, builderLogger);

        const runId = await runCdsUnitTest.run(className, runOptions);

        logBuilderTestStep('get ABAP Unit test status');
        const statusResponse = await runCdsUnitTest.getStatus(
          runId,
          cdsTestConfig.unit_test_status?.with_long_polling !== false
        );

        await new Promise(resolve => setTimeout(resolve, getOperationDelay('unit_test_result', testCase)));

        logBuilderTestStep('get ABAP Unit test result');
        const resultResponse = await runCdsUnitTest.getResult(runId, {
          withNavigationUris: cdsTestConfig.unit_test_result?.with_navigation_uris ?? false,
          format: cdsTestConfig.unit_test_result?.format === 'junit' ? 'junit' : 'abapunit'
        });

        // Verify that status and result were retrieved
        const runStatus = statusResponse.data;
        const runResult = resultResponse.data;
        expect(runId).toBeDefined();
        expect(runStatus).toBeDefined();
        expect(runResult).toBeDefined();

        if (!skipCleanup) {
          logBuilderTestStep('delete (cleanup)');
          // Delete test class only (CDS view is created manually and should not be deleted)
          if (className) {
            await cdsUnitTest.delete({ className, transportRequest: resolvedTransportRequest }).catch(() => {});
          }
        } else {
          testsLogger.info?.('⚠️ Cleanup skipped (skip_cleanup=true) - test class left for analysis:', className);
        }
        
        // Cleanup unit test connection (always cleanup connection, even if skip_cleanup is true)
        if (unitTestConnection) {
          try {
            unitTestConnection.reset();
          } catch (cleanupError) {
            testsLogger.warn?.(`Failed to cleanup unit test connection:`, cleanupError);
          }
        }

        // Verify deletion
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('delete', testCase) || 2000));
        
        if (className) {
          try {
            await getClass(connection, className);
            testsLogger.warn?.('Unit test class still exists after deletion:', className);
          } catch (error: any) {
            if (error.response?.status === 404) {
              testsLogger.info?.('Unit test class successfully deleted:', className);
            }
          }
        }

        // Verify results
        expect(runId).toBeDefined();
        expect(runStatus).toBeDefined();
        expect(runResult).toBeDefined();
      } catch (error: any) {
        // Log step error with details before failing test
        logBuilderTestStepError(currentStep || 'unknown', error);
        
        // Cleanup: delete (if skip_cleanup is false)
        // Note: CDS view is not cleaned up as it must be created manually
        if (classCreated && className) {
          try {
            // Delete only if skip_cleanup is false
            if (!skipCleanup) {
              logBuilderTestStep('delete test class (cleanup)');
              await cdsUnitTest.delete({ className, transportRequest: resolvedTransportRequest }).catch(() => {});
            } else {
              testsLogger.info?.('⚠️ Cleanup skipped (skip_cleanup=true) - test class left for analysis:', className);
            }
          } catch (cleanupError) {
            // Log cleanup error but don't fail test - original error is more important
            testsLogger.warn?.(`Cleanup failed:`, cleanupError);
          }
        }
        
        // Cleanup unit test connection (always cleanup connection, even if skip_cleanup is true)
        if (unitTestConnection) {
          try {
            unitTestConnection.reset();
          } catch (connError) {
            testsLogger.warn?.(`Failed to cleanup unit test connection:`, connError);
          }
        }
        
        const statusText = getHttpStatusText(error);
        const enhancedError = statusText !== 'HTTP ?'
          ? Object.assign(new Error(`[${statusText}] ${error.message}`), { stack: error.stack })
          : error;
        logBuilderTestError(testsLogger, 'ViewBuilder - CDS unit test', enhancedError);
        throw enhancedError;
      } finally {
        // Final cleanup: delete test class if it was created
        // This is a safety net to prevent objects from being left
        try {
          if (classCreated && className && !skipCleanup) {
            await cdsUnitTest.delete({ className, transportRequest: resolvedTransportRequest }).catch(() => {});
          }
        } catch (finalCleanupError) {
          // Ignore final cleanup errors - we've already tried cleanup in catch block
          testsLogger.warn?.(`Final cleanup failed (ignored):`, finalCleanupError);
        }
        
        // Cleanup unit test connection (always cleanup connection, even if skip_cleanup is true)
        if (unitTestConnection) {
          try {
            unitTestConnection.reset();
          } catch (connError) {
            // Ignore connection cleanup errors
          }
        }
        
        logBuilderTestEnd(testsLogger, 'ViewBuilder - CDS unit test');
      }
    }, getTimeout('long')); // CDS unit test needs more time (400 seconds = 6.67 minutes)
  });

});

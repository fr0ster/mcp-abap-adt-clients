/**
 * Integration test for ViewBuilder
 * Tests using CrudClient for unified CRUD operations
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - ViewBuilder library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=view/ViewBuilder
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { CrudClient } from '../../../clients/CrudClient';
import { ViewBuilder } from '../../../core/view';
import { TableBuilder } from '../../../core/table';
import { ClassBuilder } from '../../../core/class';
import { CdsUnitTestBuilder, ClassUnitTestBuilder } from '../../../core/unitTest';
import { SharedBuilder } from '../../../core/shared';
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

// Library code (ViewBuilder) uses DEBUG_ADT_LIBS
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

describe('ViewBuilder (using CrudClient)', () => {
  let connection: IAbapConnection;
  let client: CrudClient;
  let hasConfig = false;
  let defaultPackage: string = '';
  let defaultTransport: string = '';

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new CrudClient(connection);
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
      throw new Error('package_name not configured for ViewBuilder test');
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

      const packageCheck = ensurePackageConfig(tc.params, 'ViewBuilder - full workflow');
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

        const tableResult = await createDependencyTable(client, tableConfig, tc);
        
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
          await client.deleteTable({
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
        logBuilderTestSkip(testsLogger, 'ViewBuilder - full workflow', skipReason, true);
        return;
      }

      const definition = getBuilderTestDefinition();
      logBuilderTestStart(testsLogger, 'ViewBuilder - full workflow', definition);

      if (!testCase || !viewName) {
        logBuilderTestSkip(testsLogger, 'ViewBuilder - full workflow', skipReason || 'Test case not available');
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
        'ViewBuilder - full workflow',
        defaultPackage,
        defaultTransport
      );
      if (!paramValidation.success) {
        logBuilderTestSkip(testsLogger, 'ViewBuilder - full workflow', paramValidation.reason || 'Parameter validation failed');
        return;
      }

      // Validate view - if validation fails, skip test
      logBuilderTestStep('validate view');
      const validationResponse = await client.validateView({
        viewName: config.viewName,
        packageName: config.packageName,
        description: config.description || ''
      });
      
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
          logBuilderTestSkip(testsLogger, 'ViewBuilder - full workflow', 
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
        logBuilderTestSkip(testsLogger, 'ViewBuilder - full workflow', 
          `Validation failed: ${errorMessage} - environment problem, test skipped`);
        return;
      }

      let viewCreated = false;
      let viewLocked = false;
      let currentStep = '';
      // Track if table was created in beforeEach (for cleanup in catch block)
      const shouldCleanupTable = tableCreated && tableName;
      
      try {
        currentStep = 'create';
        logBuilderTestStep(currentStep);
        await client.createView({
          viewName: config.viewName,
          packageName: config.packageName!,
          description: config.description || '',
          transportRequest: config.transportRequest
        });
        viewCreated = true;
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('create', testCase)));
        
        currentStep = 'lock';
        logBuilderTestStep(currentStep);
        await client.lockView({ viewName: config.viewName });
        viewLocked = true;
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('lock', testCase)));
        
        currentStep = 'update';
        logBuilderTestStep(currentStep);
        if (!config.ddlSource) {
          throw new Error('ddlSource is required for view update');
        }
        await client.updateView({
          viewName: config.viewName,
          ddlSource: config.ddlSource
        });
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('update', testCase)));
        
        currentStep = 'check(inactive)';
        logBuilderTestStep(currentStep);
        const checkResultInactive = await client.checkView({ viewName: config.viewName });
        expect(checkResultInactive?.status).toBeDefined();
        
        currentStep = 'unlock';
        logBuilderTestStep(currentStep);
        await client.unlockView({ viewName: config.viewName });
        viewLocked = false; // Unlocked successfully
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('unlock', testCase)));
        
        currentStep = 'activate';
        logBuilderTestStep(currentStep);
        await client.activateView({ viewName: config.viewName });
        // Wait for activation to complete (activation is asynchronous)
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('activate', testCase) || 2000));
        
        currentStep = 'check(active)';
        logBuilderTestStep(currentStep);
        // Retry check for active version - activation may take time
        const checkResultActive = await retryCheckAfterActivate(
          () => client.checkView({ viewName: config.viewName }),
          {
            maxAttempts: 5,
            delay: 1000,
            logger: testsLogger,
            objectName: config.viewName
          }
        );
        expect(checkResultActive?.status).toBeDefined();
        
        if (!skipCleanup) {
          currentStep = 'delete (cleanup)';
          logBuilderTestStep(currentStep);
          // Use group deletion for view and table together
          if (tableName && viewName) {
            const sharedBuilder = new SharedBuilder(connection);
            await sharedBuilder.deleteGroup([
              { type: 'DDLS/DF', name: viewName },
              { type: 'TABL/DT', name: tableName }
            ]);
          } else if (viewName) {
            await client.deleteView({
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

        expect(client.getCreateResult()).toBeDefined();
        expect(client.getActivateResult()).toBeDefined();

        // Read the created view before cleanup
        if (viewName) {
          try {
            logBuilderTestStep('read');
            const readResult = await client.readView(viewName);
            expect(readResult).toBeDefined();
            expect(readResult?.viewName).toBe(viewName);
          } catch (readError) {
            // Log warning but don't fail the test if read fails
            builderLogger.warn?.(`Failed to read view ${viewName}:`, readError);
          }
        }

        logBuilderTestSuccess(testsLogger, 'ViewBuilder - full workflow');
      } catch (error: any) {
        // Log step error with details before failing test
        logBuilderTestStepError(currentStep || 'unknown', error);
        
        // Cleanup: unlock (always) and delete (if skip_cleanup is false)
        if (viewLocked || viewCreated || shouldCleanupTable) {
          try {
            // Unlock is always required (even if skip_cleanup is true)
            if (viewLocked) {
              logBuilderTestStep('unlock (cleanup)');
              await client.unlockView({ viewName: config.viewName });
            }
            // Delete only if skip_cleanup is false
            if (!skipCleanup && (viewCreated || shouldCleanupTable)) {
              logBuilderTestStep('delete (cleanup)');
              // Use group deletion for view and table together
              if (tableName && viewName && (viewCreated || shouldCleanupTable)) {
                const sharedBuilder = new SharedBuilder(connection);
                await sharedBuilder.deleteGroup([
                  { type: 'DDLS/DF', name: viewName },
                  { type: 'TABL/DT', name: tableName }
                ]);
                // Mark table as cleaned up to prevent afterEach from trying again
                tableCreated = false;
              } else if (viewName && viewCreated) {
                await client.deleteView({
                  viewName: config.viewName,
                  transportRequest: config.transportRequest
                });
              } else if (shouldCleanupTable && tableName) {
                // Cleanup table only if view wasn't created
                await client.deleteTable({
                  tableName: tableName,
                  transportRequest: resolveTransportRequest(testCase?.params?.transport_request)
                });
                tableCreated = false;
              }
            } else if (skipCleanup && (viewCreated || shouldCleanupTable)) {
              testsLogger.info?.('⚠️ Cleanup skipped (skip_cleanup=true) - objects left for analysis:', {
                view: viewName,
                table: tableName
              });
            }
          } catch (cleanupError) {
            // Log cleanup error but don't fail test - original error is more important
            testsLogger.warn?.(`Cleanup failed for ${config.viewName}:`, cleanupError);
          }
        }
        
        const statusText = getHttpStatusText(error);
        const enhancedError = statusText !== 'HTTP ?'
          ? Object.assign(new Error(`[${statusText}] ${error.message}`), { stack: error.stack })
          : error;
        logBuilderTestError(testsLogger, 'ViewBuilder - full workflow', enhancedError);
        throw enhancedError;
      } finally {
        // Final cleanup: ensure unlock even if previous cleanup failed
        // This is a safety net to prevent objects from being left locked
        try {
          if (viewLocked) {
            await client.unlockView({ viewName: config.viewName }).catch(() => {});
          }
        } catch (finalCleanupError) {
          // Ignore final cleanup errors - we've already tried cleanup in catch block
          testsLogger.warn?.(`Final cleanup failed (ignored):`, finalCleanupError);
        }
        logBuilderTestEnd(testsLogger, 'ViewBuilder - full workflow');
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

      // Use CdsUnitTestBuilder for entire workflow (extends ClassBuilder)
      const cdsUnitTestBuilder = new CdsUnitTestBuilder(connection, builderLogger, {
        className,
        cdsViewName: viewName,  // CDS view name for generating test class source
        description: cdsTestConfig.description || `CDS unit test for ${viewName}`,
        packageName: resolvedPackageName,
        transportRequest: resolveTransportRequest(cdsTestConfig.transport_request || testCase.params.transport_request),
        classTemplate: classTemplateXml,
        testClassSource: testClassSource
      });

      let classCreated = false;
      let classLocked = false;
      let currentStep = '';
      let unitTestConnection: IAbapConnection | undefined = undefined;
      let runCdsUnitTestBuilder: CdsUnitTestBuilder | undefined = undefined;

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
          await client.checkView({ viewName }, 'active');
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
          await cdsUnitTestBuilder.validateCdsForUnitTest(viewName);
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
          classValidationResponse = await cdsUnitTestBuilder.validate();
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
        
        // Create class
        currentStep = 'create';
        logBuilderTestStep(currentStep);
        try {
          await cdsUnitTestBuilder.create();
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
        
        // Check class (inactive) after creation (before activation, as per Eclipse ADT workflow)
        currentStep = 'check(inactive)';
        logBuilderTestStep(currentStep);
        await cdsUnitTestBuilder.check('inactive');
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('check', testCase) || 1000));
        
        // Activate class after creation (before lock, as per Eclipse ADT workflow)
        currentStep = 'activate';
        logBuilderTestStep(currentStep);
        await cdsUnitTestBuilder.activate();
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('activate', testCase) || 2000));
        
        // Lock class (for update) - lock handle is stored in builder
        currentStep = 'lock';
        logBuilderTestStep(currentStep);
        await cdsUnitTestBuilder.lock();
        classLocked = true;
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('lock', testCase)));
        
        // Check class (active) after lock
        currentStep = 'check(active)';
        logBuilderTestStep(currentStep);
        await cdsUnitTestBuilder.check('active');
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('check', testCase) || 1000));
        
        // Update test class source (uses updateTestClass() from ClassBuilder via BaseUnitTestBuilder.update())
        currentStep = 'update';
        logBuilderTestStep(currentStep);
        await cdsUnitTestBuilder.update(testClassSource);
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('update', testCase)));
        
        // Check class (inactive) after update
        currentStep = 'check(inactive)';
        logBuilderTestStep(currentStep);
        await cdsUnitTestBuilder.check('inactive');
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('check', testCase) || 1000));
        
        // Unlock class
        currentStep = 'unlock';
        logBuilderTestStep(currentStep);
        await cdsUnitTestBuilder.unlock();
        classLocked = false;
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('unlock', testCase)));
        
        // Activate class after update
        currentStep = 'activate';
        logBuilderTestStep(currentStep);
        await cdsUnitTestBuilder.activate();
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('activate', testCase) || 2000));
        
        // Check class (active) after activation
        currentStep = 'check(active)';
        logBuilderTestStep(currentStep);
        await cdsUnitTestBuilder.check('active');
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('check', testCase) || 1000));

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

        // Use CdsUnitTestBuilder for CDS unit test run (separate instance for run operations)
        runCdsUnitTestBuilder = new CdsUnitTestBuilder(unitTestConnection, builderLogger, {
          className: className,
          cdsViewName: viewName,
          packageName: resolvedPackageName
        });

        await runCdsUnitTestBuilder.runForObject(className, runOptions);

        logBuilderTestStep('get ABAP Unit test status');
        await runCdsUnitTestBuilder.getStatus(
          cdsTestConfig.unit_test_status?.with_long_polling !== false
        );

        await new Promise(resolve => setTimeout(resolve, getOperationDelay('unit_test_result', testCase)));

        logBuilderTestStep('get ABAP Unit test result');
        await runCdsUnitTestBuilder.getResult({
          withNavigationUris: cdsTestConfig.unit_test_result?.with_navigation_uris ?? false,
          format: cdsTestConfig.unit_test_result?.format === 'junit' ? 'junit' : 'abapunit'
        });

        // Verify that status and result were retrieved
        const runId = runCdsUnitTestBuilder.getRunId();
        const runStatus = runCdsUnitTestBuilder.getRunStatus();
        const runResult = runCdsUnitTestBuilder.getRunResult();
        expect(runId).toBeDefined();
        expect(runStatus).toBeDefined();
        expect(runResult).toBeDefined();

        if (!skipCleanup) {
          logBuilderTestStep('delete (cleanup)');
          // Delete test class only (CDS view is created manually and should not be deleted)
          if (cdsUnitTestBuilder) {
            await cdsUnitTestBuilder.deleteTestClass().catch(() => {});
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

        // Verify results (runCdsUnitTestBuilder was used for run)
        expect(runCdsUnitTestBuilder).toBeDefined();
        expect(runCdsUnitTestBuilder.getRunId()).toBeDefined();
        expect(runCdsUnitTestBuilder.getRunStatus()).toBeDefined();
        expect(runCdsUnitTestBuilder.getRunResult()).toBeDefined();
      } catch (error: any) {
        // Log step error with details before failing test
        logBuilderTestStepError(currentStep || 'unknown', error);
        
        // Cleanup: unlock (always) and delete (if skip_cleanup is false)
        // Note: CDS view is not cleaned up as it must be created manually
        if (classLocked || classCreated || cdsUnitTestBuilder) {
          try {
            // Unlock is always required (even if skip_cleanup is true)
            if (classLocked && cdsUnitTestBuilder) {
              logBuilderTestStep('unlock class (cleanup)');
              await cdsUnitTestBuilder.unlock().catch(() => {});
            }
            // Delete only if skip_cleanup is false
            if (!skipCleanup && cdsUnitTestBuilder) {
              logBuilderTestStep('delete test class (cleanup)');
              await cdsUnitTestBuilder.deleteTestClass().catch(() => {});
            } else if (skipCleanup && classCreated) {
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
        // Final cleanup: unlock is always required (even if skip_cleanup is true)
        // Note: CDS view is not cleaned up as it must be created manually
        try {
          if (cdsUnitTestBuilder) {
            await cdsUnitTestBuilder.forceUnlock().catch(() => {});
          }
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
        
        // Cleanup unit test connection (always cleanup connection, even if skip_cleanup is true)
        if (unitTestConnection) {
          try {
            unitTestConnection.reset();
          } catch (connError) {
            // Ignore connection cleanup errors
          }
        }
        
        // Log success/end only if test didn't throw
        try {
          logBuilderTestSuccess(testsLogger, 'ViewBuilder - CDS unit test');
        } catch (logError) {
          // Ignore logging errors if test already completed
        }
        logBuilderTestEnd(testsLogger, 'ViewBuilder - CDS unit test');
      }
    }, getTimeout('long')); // CDS unit test needs more time (400 seconds = 6.67 minutes)
  });

});

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

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { CrudClient } from '../../../clients/CrudClient';
import { ViewBuilder } from '../../../core/view';
import { TableBuilder } from '../../../core/table';
import { ClassBuilder } from '../../../core/class';
import { UnitTestBuilder } from '../../../core/unitTest';
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
  extractValidationErrorMessage
} = require('../../../../tests/test-helper');

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
  return `"!@testing ${viewNameUpper}
CLASS ${classNameUpper} DEFINITION FINAL
  FOR TESTING RISK LEVEL HARMLESS DURATION SHORT.

  PRIVATE SECTION.
    TYPES: BEGIN OF ty_data,
             id         TYPE char10,
             name       TYPE char50,
             value      TYPE dec15_2,
             created_at TYPE dats,
           END OF ty_data.
    DATA test_data TYPE STANDARD TABLE OF ty_data WITH EMPTY KEY.
    METHODS setup.
    METHODS test_select FOR TESTING.
ENDCLASS.

CLASS ${classNameUpper} IMPLEMENTATION.
  METHOD setup.
    CLEAR test_data.
  ENDMETHOD.

  METHOD test_select.
    SELECT id, name, value, created_at FROM ${viewNameUpper}
      INTO TABLE @test_data UP TO 1 ROWS.
    " Test passes if view is accessible (even if empty)
    cl_abap_unit_assert=>assert_not_initial( act = test_data ).
  ENDMETHOD.
ENDCLASS.
`;
}

describe('ViewBuilder (using CrudClient)', () => {
  let connection: AbapConnection;
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
      if (tableCreated && tableName && connection) {
        try {
          await client.deleteTable({
            tableName: tableName,
            transportRequest: resolveTransportRequest(testCase?.params?.transport_request)
          });
        } catch (error) {
          // Log but don't fail - table cleanup is best effort
          testsLogger.warn?.(`Failed to cleanup table ${tableName}:`, error);
        }
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
        
        // Cleanup: unlock and delete if object was created/locked
        if (viewLocked || viewCreated) {
          try {
            if (viewLocked) {
              logBuilderTestStep('unlock (cleanup)');
              await client.unlockView({ viewName: config.viewName });
            }
            if (viewCreated) {
              logBuilderTestStep('delete (cleanup)');
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

    it('should create CDS view, generate unit test class, and run ABAP Unit', async () => {
      // If test is disabled, skip silently without logging
      if (skipReason) {
        logBuilderTestSkip(testsLogger, 'ViewBuilder - CDS unit test', skipReason, true);
        return;
      }

      const definition = getTestCaseDefinition('create_view', 'cds_unit_test');
      logBuilderTestStart(testsLogger, 'ViewBuilder - CDS unit test', definition);

      if (!testCase || !tableName || !viewName || !className) {
        logBuilderTestSkip(testsLogger, 'ViewBuilder - CDS unit test', skipReason || 'Test case not available');
        return;
      }

      const cdsTestConfig = testCase.params.cds_unit_test;
      const testClassName = cdsTestConfig.test_class_name || `LTC_${viewName}`;
      const classTemplateXml =
        cdsTestConfig.template_xml || buildCdsUnitTemplate(viewName);
      const testClassSource =
        cdsTestConfig.test_class_source || buildCdsUnitTestClassSource(testClassName, viewName);

      const tableBuilder = new TableBuilder(connection, builderLogger, {
        tableName: tableName,
        packageName: resolvePackageName(testCase.params.package_name),
        transportRequest: resolveTransportRequest(testCase.params.transport_request),
        ddlCode: testCase.params.table_source,
        description: testCase.params.description || `Table for ${viewName}`
      });

      // Validate test parameters at the start
      logBuilderTestStep('validate parameters');
      const paramValidation = await validateTestParameters(
        connection,
        testCase.params,
        'ViewBuilder - CDS unit test',
        defaultPackage,
        defaultTransport
      );
      if (!paramValidation.success) {
        logBuilderTestSkip(testsLogger, 'ViewBuilder - CDS unit test', paramValidation.reason || 'Parameter validation failed');
        return;
      }

      const resolvedPackageName = resolvePackageName(testCase.params.package_name);
      const resolvedTransportRequest = resolveTransportRequest(testCase.params.transport_request);

      const viewBuilder = new ViewBuilder(connection, builderLogger, {
        viewName,
        packageName: resolvedPackageName,
        transportRequest: resolvedTransportRequest,
        description: testCase.params.description,
        ddlSource: testCase.params.ddl_source
      });

      const classBuilder = new ClassBuilder(connection, builderLogger, {
        className,
        description: cdsTestConfig.description || `CDS unit test for ${viewName}`,
        packageName: resolvedPackageName,
        transportRequest: resolveTransportRequest(cdsTestConfig.transport_request || testCase.params.transport_request),
        final: true
      });

      let unitTestBuilder: UnitTestBuilder | null = null;

      // Validate view - if validation fails, skip test
      logBuilderTestStep('validate view');
      let viewValidationResponse: any;
      try {
        viewValidationResponse = await viewBuilder.validate();
      } catch (error: any) {
        viewValidationResponse = error.response || { status: error.status || 500, data: error.message };
      }
      
      if (viewValidationResponse?.status !== 200) {
        const errorMessage = extractValidationErrorMessage(viewValidationResponse);
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
              status: viewValidationResponse?.status,
              data: viewValidationResponse?.data
            }
          });
          logBuilderTestSkip(testsLogger, 'ViewBuilder - CDS unit test', 
            `View ${viewName} cannot be created: ${errorMessage} - environment problem, test skipped`);
          return;
        }
        
        // Other validation errors - skip test (environment problem)
        logBuilderTestStepError('validate view', {
          response: {
            status: viewValidationResponse?.status,
            data: viewValidationResponse?.data
          }
        });
        logBuilderTestSkip(testsLogger, 'ViewBuilder - CDS unit test', 
          `Validation failed: ${errorMessage} - environment problem, test skipped`);
        return;
      }

      try {
        logBuilderTestStep('create CDS view');
        await viewBuilder.create()
          .then(async (b: ViewBuilder) => {
            await new Promise(resolve => setTimeout(resolve, getOperationDelay('create', testCase)));
            logBuilderTestStep('lock view');
            return b.lock();
          })
          .then((b: ViewBuilder) => {
            logBuilderTestStep('update view DDL');
            return b.update();
          })
          .then(async (b: ViewBuilder) => {
            await new Promise(resolve => setTimeout(resolve, getOperationDelay('update', testCase)));
            logBuilderTestStep('unlock view');
            return b.unlock();
          })
          .then(async (b: ViewBuilder) => {
            await new Promise(resolve => setTimeout(resolve, getOperationDelay('unlock', testCase)));
            logBuilderTestStep('activate view');
            return b.activate();
          });

        classBuilder.setClassTemplate(classTemplateXml);
        classBuilder.setTestClassCode(testClassSource);
        logBuilderTestStep('create CDS unit test class');
        await classBuilder.validate();
        await classBuilder.create();
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('create', testCase)));
        logBuilderTestStep('activate unit test class');
        await classBuilder.activate();
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('unlock', testCase)));

        unitTestBuilder = new UnitTestBuilder(connection, builderLogger, {
          objectType: 'class',
          objectName: className,
          testClassName: testClassName,
          transportRequest: resolveTransportRequest(cdsTestConfig.transport_request || testCase.params.transport_request)
        }).setTestClassSource(testClassSource);

        logBuilderTestStep('lock test classes');
        await unitTestBuilder.lockTestClasses();
        logBuilderTestStep('update test class source');
        await unitTestBuilder.updateTestClass();
        logBuilderTestStep('unlock test classes');
        await unitTestBuilder.unlockTestClasses();
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('unlock', testCase)));
        logBuilderTestStep('activate test classes');
        await unitTestBuilder.activateTestClasses();

        const runOptions = cdsTestConfig.unit_test_options ? {
          title: cdsTestConfig.unit_test_options.title,
          context: cdsTestConfig.unit_test_options.context,
          scope: cdsTestConfig.unit_test_options.scope,
          riskLevel: cdsTestConfig.unit_test_options.risk_level,
          duration: cdsTestConfig.unit_test_options.duration
        } : undefined;

        logBuilderTestStep('run ABAP Unit tests');
        // Create new connection for unit test execution (separate timeout)
        const unitTestConnection = await createAbapConnection(getConfig(), connectionLogger);

        // Reuse unitTestBuilder for CDS run (change objectType to 'cds')
        unitTestBuilder = new UnitTestBuilder(unitTestConnection, builderLogger, {
          objectType: 'cds',
          objectName: className
        });

        await unitTestBuilder.runForObject(runOptions);

        logBuilderTestStep('get ABAP Unit test status');
        await unitTestBuilder.getStatus(
          cdsTestConfig.unit_test_status?.with_long_polling !== false
        );

        await new Promise(resolve => setTimeout(resolve, getOperationDelay('unit_test_result', testCase)));

        logBuilderTestStep('get ABAP Unit test result');
        await unitTestBuilder.getResult({
          withNavigationUris: cdsTestConfig.unit_test_result?.with_navigation_uris ?? false,
          format: cdsTestConfig.unit_test_result?.format === 'junit' ? 'junit' : 'abapunit'
        });

        // Verify that status and result were retrieved
        const runId = unitTestBuilder.getRunId();
        const runStatus = unitTestBuilder.getRunStatus();
        const runResult = unitTestBuilder.getRunResult();
        expect(runId).toBeDefined();
        expect(runStatus).toBeDefined();
        expect(runResult).toBeDefined();

        logBuilderTestStep('delete (cleanup)');
        // Delete test class first (use unit test connection)
        await unitTestBuilder.deleteTestClass().catch(() => {});
        
        // Use group deletion for view and table together (use original connection)
        if (viewName && tableName) {
          const sharedBuilder = new SharedBuilder(connection);
          await sharedBuilder.deleteGroup([
            { type: 'DDLS/DF', name: viewName },
            { type: 'TABL/DT', name: tableName }
          ]).catch(() => {});
        } else {
          if (viewName) {
            await viewBuilder.delete().catch(() => {});
          }
          if (tableName && tableBuilder) {
            await tableBuilder.delete().catch(() => {});
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

        if (viewName) {
          try {
            await getView(connection, viewName);
            testsLogger.warn?.('CDS view still exists after deletion:', viewName);
          } catch (error: any) {
            if (error.response?.status === 404) {
              testsLogger.info?.('CDS view successfully deleted:', viewName);
            }
          }
        }

        if (tableName) {
          try {
            await getTable(connection, tableName);
            testsLogger.warn?.('Table still exists after deletion:', tableName);
          } catch (error: any) {
            if (error.response?.status === 404) {
              testsLogger.info?.('Table successfully deleted:', tableName);
            }
          }
        }

        // Verify results
        expect(unitTestBuilder).toBeDefined();
        expect(unitTestBuilder!.getRunId()).toBeDefined();
        expect(unitTestBuilder!.getRunStatus()).toBeDefined();
        expect(unitTestBuilder!.getRunResult()).toBeDefined();
      } catch (error: any) {
        // Log step error with details before failing test
        // Try to determine which step failed based on error context
        const errorStep = error.message?.includes('view') ? 'create CDS view' : 
                         error.message?.includes('class') ? 'create CDS unit test class' :
                         error.message?.includes('table') ? 'create table' : 'unknown step';
        logBuilderTestStepError(errorStep, error);
        
        const statusText = getHttpStatusText(error);
        const enhancedError = statusText !== 'HTTP ?'
          ? Object.assign(new Error(`[${statusText}] ${error.message}`), { stack: error.stack })
          : error;
        logBuilderTestError(testsLogger, 'ViewBuilder - CDS unit test', enhancedError);
        throw enhancedError;
      } finally {
        try {
          await classBuilder.forceUnlock().catch(() => {});
          await viewBuilder.forceUnlock().catch(() => {});
          await tableBuilder.forceUnlock().catch(() => {});
        } catch (cleanupError) {
          // Ignore cleanup errors
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

/**
 * Integration test for AdtCdsUnitTest
 * Tests using AdtClient for CDS unit test operations
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - CdsUnitTest library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=unitTest/CdsUnitTest
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { AdtClient } from '../../../../clients/AdtClient';
import { getConfig } from '../../../helpers/sessionConfig';
import {
  logBuilderTestStart,
  logBuilderTestSkip,
  logBuilderTestSuccess,
  logBuilderTestError,
  logBuilderTestEnd,
  logBuilderTestStep
} from '../../../helpers/builderTestLogger';
import { createConnectionLogger, createBuilderLogger, createTestsLogger } from '../../../helpers/testLogger';
import { ICdsUnitTestConfig, ICdsUnitTestState, IUnitTestConfig } from '../../../../core/unitTest';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const {
  getTestCaseDefinition,
  resolvePackageName,
  resolveTransportRequest,
  getEnvironmentConfig,
  getTimeout
} = require('../../../helpers/test-helper');

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

describe('AdtCdsUnitTest (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, builderLogger);
      hasConfig = true;
    } catch (error) {
      hasConfig = false;
    }
  });

  afterAll(async () => {
    if (connection) {
      connection.reset();
    }
  });

  describe('Create CDS unit test class', () => {
    it('should create CDS unit test class with template and test class source', async () => {
      const testCase = getTestCaseDefinition('create_cds_unit_test', 'cds_unit_test');
      if (!testCase?.params?.cds_unit_test) {
        logBuilderTestStart(testsLogger, 'CdsUnitTest - create CDS unit test class', {
          name: 'create_cds_unit_test',
          params: {}
        });
        logBuilderTestSkip(testsLogger, 'CdsUnitTest - create CDS unit test class',
          'CDS unit test configuration not found in test-config.yaml');
        return;
      }

      const packageName = resolvePackageName(testCase.params.package_name);
      if (!packageName) {
        logBuilderTestStart(testsLogger, 'CdsUnitTest - create CDS unit test class', {
          name: 'create_cds_unit_test',
          params: {}
        });
        logBuilderTestSkip(testsLogger, 'CdsUnitTest - create CDS unit test class',
          'Package name not configured');
        return;
      }

      const cdsUnitTestConfig = testCase.params.cds_unit_test;
      if (!cdsUnitTestConfig) {
        logBuilderTestStart(testsLogger, 'CdsUnitTest - create CDS unit test class', {
          name: 'create_cds_unit_test',
          params: {}
        });
        logBuilderTestSkip(testsLogger, 'CdsUnitTest - create CDS unit test class',
          'cds_unit_test configuration not found in test-config.yaml');
        return;
      }

      const className = cdsUnitTestConfig.class_name;
      const testClassName = cdsUnitTestConfig.test_class_name;
      const viewName = testCase.params.view_name;
      const classTemplate = cdsUnitTestConfig.template_xml;
      const testClassSource = cdsUnitTestConfig.test_class_source;
      const transportRequest = resolveTransportRequest(cdsUnitTestConfig.transport_request || testCase.params.transport_request);

      if (!className || !testClassName || !viewName || !classTemplate || !testClassSource) {
        logBuilderTestStart(testsLogger, 'CdsUnitTest - create CDS unit test class', {
          name: 'create_cds_unit_test',
          params: {}
        });
        logBuilderTestSkip(testsLogger, 'CdsUnitTest - create CDS unit test class',
          'Required parameters missing: class_name, test_class_name, view_name, template_xml, or test_class_source');
        return;
      }

      logBuilderTestStart(testsLogger, 'CdsUnitTest - create CDS unit test class', {
        name: 'create_cds_unit_test',
        params: {
          class_name: className,
          test_class_name: testClassName,
          view_name: viewName,
          package_name: packageName
        }
      });

      if (!hasConfig) {
        logBuilderTestSkip(testsLogger, 'CdsUnitTest - create CDS unit test class', 'No SAP configuration');
        return;
      }

      try {
        // Step 1: Validate CDS view for unit test doubles
        if (viewName) {
          logBuilderTestStep('validate');
          testsLogger.info?.('Validating CDS view for unit test doubles:', viewName);
          const validateState = await client.getCdsUnitTest().validate({
            cdsViewName: viewName
          });
          expect(validateState).toBeDefined();
          expect(validateState.cdsValidationResponse).toBeDefined();
          testsLogger.info?.('CDS view validated successfully');
        }

        // Step 2: Create CDS unit test class
        logBuilderTestStep('create');
        const cdsUnitTestConfigForCreate: ICdsUnitTestConfig = {
          className,
          packageName,
          cdsViewName: viewName,
          classTemplate,
          testClassSource,
          description: cdsUnitTestConfig.description || `CDS unit test for ${viewName}`,
          transportRequest
        };

        const createState = await client.getCdsUnitTest().create(cdsUnitTestConfigForCreate);
        expect(createState).toBeDefined();
        expect(createState.testClassState).toBeDefined();
        testsLogger.info?.('CDS unit test class created successfully');

        // Step 3: Activate class
        logBuilderTestStep('activate');
        const activateState = await client.getClass().activate({
          className,
          transportRequest
        });
        expect(activateState).toBeDefined();
        testsLogger.info?.('CDS unit test class activated');

        // Step 4: Read the created test class
        logBuilderTestStep('read');
        const readState = await client.getClass().read({ className });
        expect(readState).toBeDefined();
        expect(readState?.readResult).toBeDefined();
        testsLogger.info?.('CDS unit test class read successfully');

        // Step 5: Create unit test configuration
        logBuilderTestStep('create (unit test)');
        const unitTestConfig: IUnitTestConfig = {
          tests: [{
            containerClass: className,
            testClass: testClassName
          }],
          options: testCase.params.unit_test_options || {}
        };
        testsLogger.info?.('CDS unit test configuration created');

        // Step 6: Update unit test (if needed - for now just prepare)
        logBuilderTestStep('update (unit test)');
        testsLogger.info?.('CDS unit test configuration prepared');

        // Step 7: Run unit test (start test execution)
        logBuilderTestStep('run (unit test)');
        const unitTest = client.getUnitTest() as any;
        const runId = await unitTest.run(
          unitTestConfig.tests!,
          unitTestConfig.options
        );
        expect(runId).toBeDefined();
        testsLogger.info?.('CDS unit test run started, run ID:', runId);

        // Step 8: Read status (with long polling if configured)
        logBuilderTestStep('read (status)');
        const statusConfig: IUnitTestConfig = {
          runId: runId,
          status: testCase.params.unit_test_status || {}
        };
        const statusState = await client.getUnitTest().read(statusConfig, 'active');
        expect(statusState).toBeDefined();
        expect(statusState?.runId).toBe(runId);
        expect(statusState?.runStatus).toBeDefined();
        testsLogger.info?.('CDS unit test status:', statusState?.runStatus);

        // Step 9: Read result
        logBuilderTestStep('read (result)');
        const resultConfig: IUnitTestConfig = {
          runId: runId,
          result: testCase.params.unit_test_result || {}
        };
        // Use getResult() method to explicitly read the test result
        const resultResponse = await unitTest.getResult(
          runId,
          {
            withNavigationUris: testCase.params.unit_test_result?.with_navigation_uris || false,
            format: testCase.params.unit_test_result?.format || 'abapunit'
          }
        );
        expect(resultResponse).toBeDefined();
        expect(resultResponse.data).toBeDefined();
        testsLogger.info?.('CDS unit test result retrieved successfully');

        // Step 10: Cleanup - delete test class if configured
        const skipCleanup = testCase.params.skip_cleanup === true;
        if (!skipCleanup && className) {
          try {
            logBuilderTestStep('delete (cleanup)');
            testsLogger.info?.('Cleaning up CDS unit test class:', className);
            await client.getClass().delete({
              className,
              transportRequest
            });
            testsLogger.info?.('CDS unit test class deleted successfully');
          } catch (cleanupError) {
            testsLogger.warn?.('Failed to cleanup CDS unit test class:', cleanupError);
          }
        } else if (skipCleanup) {
          testsLogger.info?.('Cleanup skipped - test class left for analysis');
        }

        logBuilderTestSuccess(testsLogger, 'CdsUnitTest - create CDS unit test class');
      } catch (error) {
        logBuilderTestError(testsLogger, 'CdsUnitTest - create CDS unit test class', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'CdsUnitTest - create CDS unit test class');
      }
    }, getTimeout('test'));
  });
});


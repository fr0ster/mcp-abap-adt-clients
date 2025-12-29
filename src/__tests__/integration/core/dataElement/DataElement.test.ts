/**
 * Integration test for DataElement
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_ADT_LIBS=true    - DataElement library logs
 *  DEBUG_CONNECTORS=true   - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=dataElement/DataElement
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtClient } from '../../../../clients/AdtClient';
import { getDataElement } from '../../../../core/dataElement/read';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { BaseTester } from '../../../helpers/BaseTester';
import {
 logTestEnd,
 logTestError,
 logTestSkip,
 logTestStart,
 logTestSuccess,
} from '../../../helpers/testProgressLogger';
import { getConfig } from '../../../helpers/sessionConfig';
import { TestConfigResolver } from '../../../helpers/TestConfigResolver';
import {
 createLibraryLogger,
 createConnectionLogger,
 createTestsLogger,
} from '../../../helpers/testLogger';

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
 extractValidationErrorMessage,
 getEnvironmentConfig,
} = require('../../../helpers/test-helper');

const envPath =
 process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
 dotenv.config({ path: envPath, quiet: true });
}

// E2E tests use DEBUG_ADT_E2E_TESTS for test code
// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
// Library code (DataElement) uses DEBUG_ADT_LIBS

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code uses DEBUG_ADT_LIBS
const libraryLogger: ILogger = createLibraryLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('DataElement (using AdtClient)', () => {
 let connection: IAbapConnection;
 let client: AdtClient;
 let hasConfig = false;
 let isCloudSystem = false;

 beforeAll(async () => {
  try {
   const config = getConfig();
   connection = createAbapConnection(config, connectionLogger);
   await (connection as any).connect();
   client = new AdtClient(connection, libraryLogger);
   hasConfig = true;
   // Check if this is a cloud system
   isCloudSystem = await isCloudEnvironment(connection);
  } catch (_error) {
   testsLogger.warn?.(
    '⚠️ Skipping tests: No .env file or SAP configuration found',
   );
   hasConfig = false;
  }
 });

 afterAll(async () => {
  if (connection) {
   (connection as any).reset();
  }
 });

 /**
  * Pre-check: Verify test data element doesn't exist
  * Safety: Skip test if object exists to avoid accidental deletion
  */
 async function ensureDataElementReady(
  dataElementName: string,
 ): Promise<{ success: boolean; reason?: string }> {
  if (!connection) {
   return { success: true };
  }

  // Check if data element exists
  try {
   await getDataElement(connection, dataElementName);
   return {
    success: false,
    reason:
     `⚠️ SAFETY: Data Element ${dataElementName} already exists! ` +
     `Delete manually or use different test name to avoid accidental deletion.`,
   };
  } catch (error: any) {
   // 404 is expected - object doesn't exist, we can proceed
   if (error.response?.status !== 404) {
    return {
     success: false,
     reason: `Cannot verify data element existence: ${error.message}`,
    };
   }
  }

  return { success: true };
 }

 function getTestDefinition() {
  return getTestCaseDefinition('create_data_element', 'adt_data_element');
 }

 function buildConfig(testCase: any, resolver?: any) {
  const params = testCase?.params || {};
  // Use resolver to get resolved parameters (from test case params or global defaults)
  const packageName =
   resolver?.getPackageName?.() || resolvePackageName(params.package_name);
  if (!packageName) {
   throw new Error(
    'package_name not configured for DataElement test',
   );
  }
  const transportRequest =
   resolver?.getTransportRequest?.() ||
   resolveTransportRequest(params.transport_request);
  return {
   dataElementName: params.data_element_name,
   packageName,
   transportRequest,
   description: params.description,
   dataType: params.data_type,
   length: params.length,
   decimals: params.decimals,
   shortLabel: params.short_label,
   mediumLabel: params.medium_label,
   longLabel: params.long_label,
   headingLabel: params.heading_label,
   typeKind: params.type_kind,
   typeName: params.type_name,
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

   const definition = getTestDefinition();
   if (!definition) {
    skipReason = 'Test case not defined in test-config.yaml';
    return;
   }

   const tc = getEnabledTestCase('create_data_element', 'adt_data_element');
   if (!tc) {
    skipReason = 'Test case disabled or not found';
    return;
   }

   const packageCheck = ensurePackageConfig(
    tc.params,
    'DataElement - full workflow',
   );
   if (!packageCheck.success) {
    skipReason = packageCheck.reason || 'Default package is not configured';
    return;
   }

   testCase = tc;
   dataElementName = tc.params.data_element_name;

   // Create domain before test if type_kind is 'domain' and type_name (domain name) is provided
   if (
    tc.params.type_kind === 'domain' &&
    (tc.params.type_name || tc.params.domain_name)
   ) {
    const domainNameToUse = tc.params.type_name || tc.params.domain_name;
    // Use resolver for consistent parameter resolution
    const {
     TestConfigResolver,
    } = require('../../../helpers/TestConfigResolver');
    const domainResolver = new TestConfigResolver({
     testCase: tc,
     isCloud: isCloudSystem,
     logger: testsLogger,
    });
    const packageName = domainResolver.getPackageName();
    if (!packageName) {
     skipReason =
      'environment problem, test skipped: package_name not configured for domain creation';
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
     transportRequest: domainResolver.getTransportRequest(),
    };

    // Create domain using AdtClient
    const domainResult = await createDependencyDomain(
     client,
     domainConfig,
     tc,
    );

    if (!domainResult.success) {
     skipReason =
      domainResult.reason ||
      `environment problem, test skipped: Failed to create required dependency domain ${domainNameToUse}`;
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
     skipReason =
      cleanup.reason || 'Failed to cleanup data element before test';
     testCase = null;
     dataElementName = null;
     domainName = null;
     domainCreated = false;
    }
   }
  });

  afterEach(async () => {
   // Cleanup domain if it was created in beforeEach
   // Check cleanup settings: cleanup_after_test (global) and skip_cleanup (test-specific or global)
   const envConfig = getEnvironmentConfig();
   const cleanupAfterTest = envConfig.cleanup_after_test !== false; // Default: true if not set
   const globalSkipCleanup = envConfig.skip_cleanup === true;
   const skipCleanup =
    testCase?.params?.skip_cleanup !== undefined
     ? testCase.params.skip_cleanup === true
     : globalSkipCleanup;
   const shouldCleanup = cleanupAfterTest && !skipCleanup;

   if (shouldCleanup && domainCreated && domainName) {
    try {
     // Use resolver for consistent parameter resolution
     const {
      TestConfigResolver,
     } = require('../../../helpers/TestConfigResolver');
     const cleanupResolver = new TestConfigResolver({
      testCase,
      isCloud: isCloudSystem,
      logger: testsLogger,
     });
     await client.getDomain().delete({
      domainName: domainName,
      transportRequest: cleanupResolver.getTransportRequest(),
     });
    } catch (cleanupError) {
     // Log but don't fail - cleanup errors are silent
     testsLogger.warn?.(
      `Cleanup failed for domain ${domainName}:`,
      cleanupError,
     );
    }
   } else if (!shouldCleanup && domainCreated && domainName) {
    testsLogger.info?.(
     `⚠️ Cleanup skipped (cleanup_after_test=${cleanupAfterTest}, skip_cleanup=${skipCleanup}) - domain left for analysis:`,
     domainName,
    );
   }
  });

  it(
   'should execute full workflow and store all results',
   async () => {
    const definition = getTestDefinition();
    logTestStart(
     testsLogger,
     'DataElement - full workflow',
     definition,
    );

    if (skipReason) {
     logTestSkip(
      testsLogger,
      'DataElement - full workflow',
      skipReason,
     );
     return;
    }

    if (!testCase || !dataElementName) {
     logTestSkip(
      testsLogger,
      'DataElement - full workflow',
      skipReason || 'Test case not available',
     );
     return;
    }

    // Create resolver for consistent parameter resolution
    const {
     TestConfigResolver,
    } = require('../../../helpers/TestConfigResolver');
    const resolver = new TestConfigResolver({
     testCase,
     isCloud: isCloudSystem,
     logger: testsLogger,
    });
    const config = buildConfig(testCase, resolver);

    // Create BaseTester instance
    const tester = new BaseTester(
     client.getDataElement(),
     'DataElement',
     'create_data_element',
     'adt_data_element',
     testsLogger,
    );

    try {
     // Use BaseTester.flowTest() for standardized CRUD flow
     await tester.flowTest(config, testCase.params, {
      updateConfig: {
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
       typeName: config.typeName,
      },
     });

     logTestSuccess(testsLogger, 'DataElement - full workflow');
    } catch (error: any) {
     logTestError(
      testsLogger,
      'DataElement - full workflow',
      error,
     );
     throw error;
    } finally {
     logTestEnd(testsLogger, 'DataElement - full workflow');
    }
   },
   getTimeout('test'),
  );
 });

 describe('Read standard object', () => {
  it(
   'should read standard SAP data element',
   async () => {
    // Use TestConfigResolver for consistent parameter resolution
    const resolver = new TestConfigResolver({
     isCloud: isCloudSystem,
     logger: testsLogger,
    });
    const standardObject = resolver.getStandardObject('dataElement');

    if (!standardObject) {
     logTestStart(
      testsLogger,
      'DataElement - read standard object',
      {
       name: 'read_standard',
       params: {},
      },
     );
     logTestSkip(
      testsLogger,
      'DataElement - read standard object',
      `Standard data element not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`,
     );
     return;
    }

    const standardDataElementName = standardObject.name;
    logTestStart(
     testsLogger,
     'DataElement - read standard object',
     {
      name: 'read_standard',
      params: { data_element_name: standardDataElementName },
     },
    );

    if (!hasConfig) {
     logTestSkip(
      testsLogger,
      'DataElement - read standard object',
      'No SAP configuration',
     );
     return;
    }

    try {
     // Create BaseTester instance
     const tester = new BaseTester(
      client.getDataElement(),
      'DataElement',
      'create_data_element',
      'adt_data_element',
      testsLogger,
     );

     // Use BaseTester.readTest() for standardized read operation
     const resultState = await tester.readTest({
      dataElementName: standardDataElementName,
     });

     expect(resultState).toBeDefined();
     expect(resultState?.readResult).toBeDefined();
     // DataElement read returns data element config - check if dataElementName is present
     const dataElementConfig = resultState?.readResult;
     if (
      dataElementConfig &&
      typeof dataElementConfig === 'object' &&
      'dataElementName' in dataElementConfig
     ) {
      expect((dataElementConfig as any).dataElementName).toBe(
       standardDataElementName,
      );
     }

     logTestSuccess(
      testsLogger,
      'DataElement - read standard object',
     );
    } catch (error) {
     logTestError(
      testsLogger,
      'DataElement - read standard object',
      error,
     );
     throw error;
    } finally {
     logTestEnd(
      testsLogger,
      'DataElement - read standard object',
     );
    }
   },
   getTimeout('test'),
  );
 });
});

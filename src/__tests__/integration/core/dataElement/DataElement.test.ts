/**
 * Integration test for DataElement
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_ADT_LIBS=true    - DataElement library logs
 *  DEBUG_CONNECTORS=true   - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPatterns=dataElement/DataElement
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyseDeletion } from '@mcp-abap-adt/adt-strategies';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import type { IDataElementConfig } from '../../../../core/dataElement';
import { getDataElement } from '../../../../core/dataElement/read';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { patchXmlAttribute } from '../../../../utils/xmlPatch';
import { integrationHeadersOf } from '../../../helpers/adtHeaders';
import { BaseTester } from '../../../helpers/BaseTester';
import {
  configuredCase,
  gate,
  gateAll,
  gateStandardObject,
  missingCaseMessage,
} from '../../../helpers/caseGate';
import { expectResult } from '../../../helpers/contract';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
  resolveSystemContext,
  skipUnlessConfigured,
} from '../../../helpers/sessionConfig';
import { TestConfigResolver } from '../../../helpers/TestConfigResolver';
import {
  createConnectionLogger,
  createLibraryLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';
import {
  logTestEnd,
  logTestError,
  logTestStart,
  logTestSuccess,
} from '../../../helpers/testProgressLogger';

const {
  resolvePackageName,
  resolveTransportRequest,
  ensurePackageConfig,
  resolveStandardObject,
  getTimeout,
  getOperationDelay,
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
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;
  let hasConfig = false;
  let isLegacy = false;
  let isCloudSystem = false;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
      isCloudSystem = await isCloudEnvironment(connection);
      const systemContext = await resolveSystemContext(
        connection,
        isCloudSystem,
      );
      const { client: resolvedClient, isLegacy: legacy } =
        await createTestAdtClient(connection, libraryLogger, systemContext);
      client = resolvedClient;
      isLegacy = legacy;
      hasConfig = true;
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      hasConfig = skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(async () => {
    if (connection) {
      await releaseTestConnection(connection);
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
    return configuredCase('create_data_element', 'adt_data_element');
  }

  function buildConfig(testCase: any, resolver?: any) {
    const params = testCase?.params || {};
    // Use resolver to get resolved parameters (from test case params or global defaults)
    const packageName =
      resolver?.getPackageName?.() || resolvePackageName(params.package_name);
    if (!packageName) {
      throw new Error('package_name not configured for DataElement test');
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
      typeKind: params.type_kind,
    };
  }

  describe('Full workflow', () => {
    let testCase: any = null;
    let dataElementName: string | null = null;
    let domainName: string | null = null;
    let domainCreated: boolean = false;
    let setupError: string | null = null;

    beforeAll(async () => {
      setupError = null;
      testCase = null;
      dataElementName = null;
      domainName = null;
      domainCreated = false;

      if (!hasConfig) {
        setupError = 'No SAP configuration';
        return;
      }

      // The gate registered the test, so the case is configured, enabled and
      // available here; a case that is not there is a defect, not a skip.
      const tc = getTestDefinition();
      if (!tc) {
        setupError = missingCaseMessage(
          'create_data_element',
          'adt_data_element',
        );
        return;
      }

      const packageCheck = ensurePackageConfig(
        tc.params,
        'DataElement - full workflow',
      );
      if (!packageCheck.success) {
        setupError = packageCheck.reason || 'Default package is not configured';
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
          setupError =
            'environment problem: package_name not configured for domain creation';
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
          setupError =
            domainResult.reason ||
            `environment problem: Failed to create required dependency domain ${domainNameToUse}`;
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
          setupError =
            cleanup.reason || 'Failed to cleanup data element before test';
          testCase = null;
          dataElementName = null;
          domainName = null;
          domainCreated = false;
        }
      }
    });

    afterAll(async () => {
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
        // Use resolver for consistent parameter resolution
        const {
          TestConfigResolver,
        } = require('../../../helpers/TestConfigResolver');
        const cleanupResolver = new TestConfigResolver({
          testCase,
          isCloud: isCloudSystem,
          logger: testsLogger,
        });
        // The domain this suite created and could not remove fails the suite:
        // the next run's create meets it.
        expectResult(
          await client.getDomain().delete(
            {
              domainName: domainName,
              transportRequest: cleanupResolver.getTransportRequest(),
            },
            {
              analyse: analyseDeletion,
              headers: integrationHeadersOf(client.getDomain(), 'delete'),
            },
          ),
          `cleanup domain ${domainName}`,
        );
      } else if (!shouldCleanup && domainCreated && domainName) {
        testsLogger.info?.(
          `⚠️ Cleanup skipped (cleanup_after_test=${cleanupAfterTest}, skip_cleanup=${skipCleanup}) - domain left for analysis:`,
          domainName,
        );
      }
    });

    gate('create_data_element', 'adt_data_element')(
      'should execute full workflow and store all results',
      async () => {
        const definition = getTestDefinition();
        logTestStart(testsLogger, 'DataElement - full workflow', definition);

        if (setupError) {
          throw new Error(
            `Test could not be set up: ${setupError}. Nothing was verified.`,
          );
        }

        if (!testCase || !dataElementName) {
          throw new Error('data_element_name not configured');
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
          // getDataElement() declares no IAdtVersionable (no
          // getVersions/getVersionSource); BaseTester's generic type still
          // requires the full interface — cast through it.
          client.getDataElement(),
          'DataElement',
          'create_data_element',
          'adt_data_element',
          testsLogger,
        );

        try {
          // Use BaseTester.flowTest() for standardized CRUD flow
          await tester.flowTest(config, testCase.params, {
            updateTakesDocument: (current) =>
              patchXmlAttribute(
                current,
                'adtcore:description',
                `${config.description || ''} (updated)`.slice(0, 60),
              ),
            updateConfig: {
              dataElementName: config.dataElementName,
              packageName: config.packageName!,
              description: config.description || '',
              dataType: config.dataType,
              length: config.length,
              decimals: config.decimals,
              typeKind: config.typeKind,
            },
          });

          logTestSuccess(testsLogger, 'DataElement - full workflow');
        } catch (error: any) {
          logTestError(testsLogger, 'DataElement - full workflow', error);
          throw error;
        } finally {
          logTestEnd(testsLogger, 'DataElement - full workflow');
        }
      },
      getTimeout('test'),
    );
  });

  describe('Read standard object', () => {
    // Applies where the case does and where a standard data element is set.
    gateAll(
      gate('create_data_element', 'adt_data_element'),
      gateStandardObject('dataElement'),
    )(
      'should read standard SAP data element',
      async () => {
        // Use TestConfigResolver for consistent parameter resolution
        const resolver = new TestConfigResolver({
          isCloud: isCloudSystem,
          isLegacy,
          logger: testsLogger,
          handlerName: 'create_data_element',
          testCaseName: 'adt_data_element',
        });

        const standardObject = resolver.getStandardObject('dataElement');

        if (!standardObject) {
          throw new Error(
            `Standard data element not configured for ${isCloudSystem ? 'cloud' : isLegacy ? 'legacy' : 'on-premise'} environment`,
          );
        }

        const standardDataElementName = standardObject.name;
        logTestStart(testsLogger, 'DataElement - read standard object', {
          name: 'read_standard',
          params: { data_element_name: standardDataElementName },
        });

        try {
          // Create BaseTester instance
          const tester = new BaseTester(
            // getDataElement() declares no IAdtVersionable (no
            // getVersions/getVersionSource); cast through the full interface.
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
          expect(resultState).toBeDefined();
          // DataElement read returns data element config - check if dataElementName is present
          const dataElementConfig = resultState;
          if (
            dataElementConfig &&
            typeof dataElementConfig === 'object' &&
            'dataElementName' in dataElementConfig
          ) {
            expect((dataElementConfig as any).dataElementName).toBe(
              standardDataElementName,
            );
          }

          logTestSuccess(testsLogger, 'DataElement - read standard object');
        } catch (error) {
          logTestError(
            testsLogger,
            'DataElement - read standard object',
            error,
          );
          throw error;
        } finally {
          logTestEnd(testsLogger, 'DataElement - read standard object');
        }
      },
      getTimeout('test'),
    );
  });
});

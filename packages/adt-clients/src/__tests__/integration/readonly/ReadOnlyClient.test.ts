import { analyseException } from '@mcp-abap-adt/adt-strategies';
import type {
  IAdtMetadataReadable,
  IAdtReadable,
} from '@mcp-abap-adt/interfaces-adt';
/**
 * Integration test for AdtClient read operations
 * Tests read/readMetadata for all object types
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - ADT library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPatterns=readonly/ReadOnlyClient
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../clients/AdtClient';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import {
  gate,
  gateAll,
  gateOn,
  gateStandardObject,
} from '../../helpers/caseGate';
import { expectResult } from '../../helpers/contract';
import {
  createTestAdtClient,
  createTestConnection,
  getConfig,
} from '../../helpers/sessionConfig';
import { TestConfigResolver } from '../../helpers/TestConfigResolver';
import {
  createConnectionLogger,
  createTestsLogger,
} from '../../helpers/testLogger';
import {
  logTestEnd,
  logTestError,
  logTestStart,
  logTestStep,
  logTestSuccess,
} from '../../helpers/testProgressLogger';

const {
  getTimeout,
  resolveStandardObject,
} = require('../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('AdtClient read operations', () => {
  let connection: IAbapConnection | null = null;
  let client: AdtClient | null = null;
  let isCloud = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      if (!config) {
        testsLogger.warn?.(
          '⚠️ Skipping tests: No .env file or SAP configuration found',
        );
        return;
      }

      connection = await createTestConnection(connectionLogger);
      const { client: resolvedClient } = await createTestAdtClient(
        connection,
        connectionLogger,
      );
      client = resolvedClient;
      isCloud = await isCloudEnvironment(connection);

      testsLogger.info?.(
        `✅ AdtClient read test environment setup complete (${isCloud ? 'cloud' : 'onprem'})`,
      );
    } catch (error: any) {
      testsLogger.error?.('❌ Failed to setup test environment:', error);
      throw error;
    }
  });

  afterAll(async () => {
    if (connection) {
      // Connection cleanup is handled by @mcp-abap-adt/connection
      testsLogger.info?.('✅ AdtClient read test environment cleanup complete');
    }
  });

  function requireClient(): AdtClient {
    if (!client) {
      throw new Error('AdtClient was not created: see the setup errors above');
    }
    return client;
  }

  function getDataLength(data: unknown): number {
    if (typeof data === 'string') {
      return data.length;
    }
    if (data) {
      try {
        return JSON.stringify(data).length;
      } catch {
        return 0;
      }
    }
    return 0;
  }

  // Helper function to create a read/readMetadata test
  function createReadTest(
    testName: string,
    objectType: string,
    buildConfig: (name: string, group?: string) => any,
    // **Typed, not `any`.** Held as `any`, this hid four calls to `read()` on
    // types that no longer have one — a domain, a data element, a function
    // group and a package are their own document, so reading them is
    // `readMetadata`. `tsc` said nothing and the full run failed on all four
    // at once. The shape below is what those handlers actually offer: either
    // member, and the reader below asks for the one that is there.
    getAdtObject: () =>
      | (Partial<IAdtReadable<any, unknown>> &
          Partial<IAdtMetadataReadable<any, unknown>>)
      | undefined,
    handlerName?: string,
    testCaseName?: string,
  ) {
    return async () => {
      // Use TestConfigResolver for consistent parameter resolution
      const resolver = new TestConfigResolver({
        isCloud,
        logger: testsLogger,
        handlerName: handlerName || `read_${objectType}`,
        testCaseName: testCaseName || `readonly_read_${objectType}`,
      });

      const standardObject = resolver.getStandardObject(objectType);

      if (!standardObject) {
        throw new Error(
          `Standard ${objectType} not configured for ${isCloud ? 'cloud' : 'on-premise'} environment`,
        );
      }

      const objectName = standardObject.name;
      const groupName = standardObject.group;
      const params = buildConfig(objectName, groupName);

      logTestStart(testsLogger, `AdtClient - ${testName}`, {
        name: `readonly_read_${objectType}`,
        params,
      });

      try {
        const adtObject = getAdtObject();
        if (!adtObject) throw new Error(`${testName}: no client`);
        // A type with a source reads it; a type that *is* its document reads
        // that. Which one this is, is a property of the type, so the test asks
        // rather than assuming — the same choice `BaseTester` makes.
        const readVersion = (version: 'active' | 'inactive') =>
          adtObject.read
            ? adtObject.read(params, version, { analyse: analyseException })
            : // biome-ignore lint/style/noNonNullAssertion: one of the two is always there
              adtObject.readMetadata!(params, {
                version,
                analyse: analyseException,
              });

        const readMetadata = (version: 'active' | 'inactive') => {
          if (!adtObject.readMetadata) {
            throw new Error(
              `${testName}: the handler offers no readMetadata() — every ADT ` +
                'object has a document of its own.',
            );
          }
          return adtObject.readMetadata(params, {
            analyse: analyseException,
            version,
          });
        };

        logTestStep('read active', testsLogger);
        const readActiveState = expectResult(
          await readVersion('active'),
          'readActiveState',
        );
        expect(readActiveState).toBeDefined();
        logTestStep(
          `active length: ${getDataLength(readActiveState)}`,
          testsLogger,
        );

        logTestStep('read inactive', testsLogger);
        const readInactiveState = expectResult(
          await readVersion('inactive'),
          'readInactiveState',
        );
        expect(readInactiveState).toBeDefined();
        logTestStep(
          `inactive length: ${getDataLength(readInactiveState)}`,
          testsLogger,
        );

        logTestStep('read metadata (active)', testsLogger);
        const metadataActiveState = expectResult(
          await readMetadata('active'),
          'metadataActiveState',
        );
        expect(metadataActiveState).toBeDefined();
        logTestStep(
          `metadata active length: ${getDataLength(metadataActiveState)}`,
          testsLogger,
        );

        logTestStep('read metadata (inactive)', testsLogger);
        const metadataInactiveState = expectResult(
          await readMetadata('inactive'),
          'metadataInactiveState',
        );
        expect(metadataInactiveState).toBeDefined();
        logTestStep(
          `metadata inactive length: ${getDataLength(metadataInactiveState)}`,
          testsLogger,
        );

        logTestSuccess(testsLogger, `AdtClient - ${testName}`);
      } catch (error) {
        logTestError(testsLogger, `AdtClient - ${testName}`, error);
        throw error;
      } finally {
        logTestEnd(testsLogger, `AdtClient - ${testName}`);
      }
    };
  }

  describe('readProgram', () => {
    gateAll(
      gate('read_program', 'readonly_read_program'),
      gateStandardObject('program'),
    )(
      'should read existing program',
      createReadTest(
        'readProgram',
        'program',
        (name) => ({ programName: name }),
        () => client?.getProgram(),
        'read_program',
        'readonly_read_program',
      ),
      getTimeout('test'),
    );
  });

  describe('readClass', () => {
    gateAll(
      gate('read_class', 'readonly_read_class'),
      gateStandardObject('class'),
    )(
      'should read existing class',
      createReadTest(
        'readClass',
        'class',
        (name) => ({ className: name }),
        () => client?.getClass(),
        'read_class',
        'readonly_read_class',
      ),
      getTimeout('test'),
    );
  });

  describe('readInterface', () => {
    gateAll(
      gate('read_interface', 'readonly_read_interface'),
      gateStandardObject('interface'),
    )(
      'should read existing interface',
      createReadTest(
        'readInterface',
        'interface',
        (name) => ({ interfaceName: name }),
        () => client?.getInterface(),
        'read_interface',
        'readonly_read_interface',
      ),
      getTimeout('test'),
    );
  });

  describe('readDomain', () => {
    gateAll(
      gate('read_domain', 'readonly_read_domain'),
      gateStandardObject('domain'),
    )(
      'should read existing domain',
      createReadTest(
        'readDomain',
        'domain',
        (name) => ({ domainName: name }),
        () => client?.getDomain(),
        'read_domain',
        'readonly_read_domain',
      ),
      getTimeout('test'),
    );
  });

  describe('readDataElement', () => {
    gateAll(
      gate('read_data_element', 'readonly_read_data_element'),
      gateStandardObject('dataElement'),
    )(
      'should read existing data element',
      createReadTest(
        'readDataElement',
        'dataElement',
        (name) => ({ dataElementName: name }),
        () => client?.getDataElement(),
        'read_data_element',
        'readonly_read_data_element',
      ),
      getTimeout('test'),
    );
  });

  describe('readStructure', () => {
    gateAll(
      gate('read_structure', 'readonly_read_structure'),
      gateStandardObject('structure'),
    )(
      'should read existing structure',
      createReadTest(
        'readStructure',
        'structure',
        (name) => ({ structureName: name }),
        () => client?.getStructure(),
        'read_structure',
        'readonly_read_structure',
      ),
      getTimeout('test'),
    );
  });

  describe('readTable', () => {
    // Cloud reads a CDS view, on-premise a table: whichever the system has.
    gateAll(
      gate('read_table', 'readonly_read_table'),
      gateOn(
        ({ isCloud }) =>
          !!resolveStandardObject(isCloud ? 'view' : 'table', isCloud, null),
      ),
    )(
      'should read existing table',
      async () => {
        // Use TestConfigResolver to check if test is available for current environment
        const resolver = new TestConfigResolver({
          isCloud,
          logger: testsLogger,
          handlerName: 'read_table',
          testCaseName: 'readonly_read_table',
        });

        // Cloud systems: 99% of tables are not readable via ADT, endpoint cannot read tables
        // On-premise: most tables are readable via ADT
        if (isCloud) {
          // On cloud, use CDS view instead of table (tables endpoint cannot read tables)
          const standardView = resolver.getStandardObject('view');

          if (!standardView) {
            throw new Error(
              'Standard CDS view not configured for cloud environment. ' +
                'Note: On cloud systems, 99% of tables are not readable via ADT, use CDS views instead.',
            );
          }

          const ddlName = standardView.name;
          logTestStart(testsLogger, 'AdtClient - readTable', {
            name: 'readonly_read_table',
            params: {
              ddlName,
              note: 'On cloud: using CDS view instead of table (99% of tables are not readable via ADT)',
            },
          });

          try {
            const viewClient = requireClient().getDdl();
            logTestStep('read active (cloud view)', testsLogger);
            const readActiveState = expectResult(
              await viewClient.read({ ddlName }, 'active', {
                analyse: analyseException,
              }),
              'readActiveState',
            );
            expect(readActiveState).toBeDefined();
            logTestStep(
              `active length: ${getDataLength(readActiveState)}`,
              testsLogger,
            );

            logTestStep('read inactive (cloud view)', testsLogger);
            const readInactiveState = expectResult(
              await viewClient.read({ ddlName }, 'inactive', {
                analyse: analyseException,
              }),
              'readInactiveState',
            );
            expect(readInactiveState).toBeDefined();
            logTestStep(
              `inactive length: ${getDataLength(readInactiveState)}`,
              testsLogger,
            );

            logTestStep('read metadata (active, cloud view)', testsLogger);
            const metadataActiveState = expectResult(
              await viewClient.readMetadata(
                { ddlName },
                { analyse: analyseException, version: 'active' },
              ),
              'metadataActiveState',
            );
            expect(metadataActiveState).toBeDefined();
            logTestStep(
              `metadata active length: ${getDataLength(metadataActiveState)}`,
              testsLogger,
            );

            logTestStep('read metadata (inactive, cloud view)', testsLogger);
            const metadataInactiveState = expectResult(
              await viewClient.readMetadata(
                { ddlName },
                { analyse: analyseException, version: 'inactive' },
              ),
              'metadataInactiveState',
            );
            expect(metadataInactiveState).toBeDefined();
            expect(metadataInactiveState).toBeDefined();
            logTestStep(
              `metadata inactive length: ${getDataLength(
                metadataInactiveState,
              )}`,
              testsLogger,
            );

            logTestSuccess(
              testsLogger,
              'AdtClient - readTable (CDS view on cloud)',
            );
          } catch (error) {
            logTestError(testsLogger, 'AdtClient - readTable', error);
            throw error;
          } finally {
            logTestEnd(testsLogger, 'AdtClient - readTable');
          }
        } else {
          // On-premise: use standard table
          const standardTable = resolver.getStandardObject('table');

          if (!standardTable) {
            throw new Error(
              'Standard table not configured for on-premise environment',
            );
          }

          const tableName = standardTable.name;
          logTestStart(testsLogger, 'AdtClient - readTable', {
            name: 'readonly_read_table',
            params: { tableName },
          });

          try {
            const tableClient = requireClient().getTable();
            logTestStep('read active', testsLogger);
            const readActiveState = expectResult(
              await tableClient.read({ tableName }, 'active', {
                analyse: analyseException,
              }),
              'readActiveState',
            );
            expect(readActiveState).toBeDefined();
            logTestStep(
              `active length: ${getDataLength(readActiveState)}`,
              testsLogger,
            );

            logTestStep('read inactive', testsLogger);
            const readInactiveState = expectResult(
              await tableClient.read({ tableName }, 'inactive', {
                analyse: analyseException,
              }),
              'readInactiveState',
            );
            expect(readInactiveState).toBeDefined();
            logTestStep(
              `inactive length: ${getDataLength(readInactiveState)}`,
              testsLogger,
            );

            logTestStep('read metadata (active)', testsLogger);
            const metadataActiveState = expectResult(
              await tableClient.readMetadata(
                { tableName },
                { analyse: analyseException, version: 'active' },
              ),
              'metadataActiveState',
            );
            expect(metadataActiveState).toBeDefined();
            logTestStep(
              `metadata active length: ${getDataLength(metadataActiveState)}`,
              testsLogger,
            );

            logTestStep('read metadata (inactive)', testsLogger);
            const metadataInactiveState = expectResult(
              await tableClient.readMetadata(
                { tableName },
                { analyse: analyseException, version: 'inactive' },
              ),
              'metadataInactiveState',
            );
            expect(metadataInactiveState).toBeDefined();
            expect(metadataInactiveState).toBeDefined();
            logTestStep(
              `metadata inactive length: ${getDataLength(
                metadataInactiveState,
              )}`,
              testsLogger,
            );

            logTestSuccess(testsLogger, 'AdtClient - readTable');
          } catch (error) {
            logTestError(testsLogger, 'AdtClient - readTable', error);
            throw error;
          } finally {
            logTestEnd(testsLogger, 'AdtClient - readTable');
          }
        }
      },
      getTimeout('test'),
    );
  });

  describe('readView', () => {
    gateAll(
      gate('read_view', 'readonly_read_view'),
      gateStandardObject('view'),
    )(
      'should read existing view',
      createReadTest(
        'readView',
        'view',
        (name) => ({ ddlName: name }),
        () => client?.getDdl(),
        'read_view',
        'readonly_read_view',
      ),
      getTimeout('test'),
    );
  });

  describe('readFunctionGroup', () => {
    gateAll(
      gate('read_function_group', 'readonly_read_function_group'),
      gateStandardObject('function_group'),
    )(
      'should read existing function group',
      createReadTest(
        'readFunctionGroup',
        'function_group',
        (name) => ({ functionGroupName: name }),
        () => client?.getFunctionGroup(),
        'read_function_group',
        'readonly_read_function_group',
      ),
      getTimeout('test'),
    );
  });

  describe('readFunctionModule', () => {
    gateAll(
      gate('read_function_module', 'readonly_read_function_module'),
      gateStandardObject('function_module'),
    )(
      'should read existing function module',
      createReadTest(
        'readFunctionModule',
        'function_module',
        (name, group) => ({
          functionModuleName: name,
          functionGroupName: group,
        }),
        () => client?.getFunctionModule(),
        'read_function_module',
        'readonly_read_function_module',
      ),
      getTimeout('test'),
    );
  });

  describe('readPackage', () => {
    gateAll(
      gate('read_package', 'readonly_read_package'),
      gateStandardObject('package'),
    )(
      'should read existing package',
      createReadTest(
        'readPackage',
        'package',
        (name) => ({ packageName: name }),
        () => client?.getPackage(),
        'read_package',
        'readonly_read_package',
      ),
      getTimeout('test'),
    );
  });

  describe('readServiceDefinition', () => {
    gateAll(
      gate('read_service_definition', 'readonly_read_service_definition'),
      gateStandardObject('serviceDefinition'),
    )(
      'should read existing service definition',
      createReadTest(
        'readServiceDefinition',
        'serviceDefinition',
        (name) => ({ serviceDefinitionName: name }),
        () => client?.getServiceDefinition(),
        'read_service_definition',
        'readonly_read_service_definition',
      ),
      getTimeout('test'),
    );
  });

  describe('readTransport', () => {
    gateOn(
      ({ isCloud }) =>
        !!new TestConfigResolver({ isCloud }).getTransportRequest(),
    )(
      'should read existing transport request',
      async () => {
        // Use TestConfigResolver for consistent parameter resolution
        const resolver = new TestConfigResolver({
          isCloud,
          logger: testsLogger,
        });
        // Try to get transport request from test case or global defaults
        const transportRequest = resolver.getTransportRequest();

        if (!transportRequest) {
          throw new Error(
            'Transport request not configured in test-config.yaml (required for transport read test)',
          );
        }

        logTestStart(testsLogger, 'AdtClient - readTransport', {
          name: 'readonly_read_transport',
          params: { transport_request: transportRequest },
        });

        try {
          const requestClient = requireClient().getRequest();
          logTestStep('read active', testsLogger);
          const readActiveState = expectResult(
            await requestClient.readMetadata(
              {
                transportNumber: transportRequest,
              },
              { analyse: analyseException },
            ),
            'readActiveState',
          );
          expect(readActiveState).toBeDefined();
          logTestStep(
            `active length: ${getDataLength(readActiveState)}`,
            testsLogger,
          );

          logTestStep('read inactive', testsLogger);
          const readInactiveState = expectResult(
            await requestClient.readMetadata(
              {
                transportNumber: transportRequest,
              },
              { analyse: analyseException },
            ),
            'readInactiveState',
          );
          expect(readInactiveState).toBeDefined();
          logTestStep(
            `inactive length: ${getDataLength(readInactiveState)}`,
            testsLogger,
          );

          logTestStep('read metadata', testsLogger);
          const metadataState = expectResult(
            await requestClient.readMetadata(
              {
                transportNumber: transportRequest,
              },
              { analyse: analyseException },
            ),
            'metadataState',
          );
          expect(metadataState).toBeDefined();
          logTestStep(
            `metadata length: ${getDataLength(metadataState)}`,
            testsLogger,
          );

          logTestSuccess(testsLogger, 'AdtClient - readTransport');
        } catch (error) {
          logTestError(testsLogger, 'AdtClient - readTransport', error);
          throw error;
        } finally {
          logTestEnd(testsLogger, 'AdtClient - readTransport');
        }
      },
      getTimeout('test'),
    );
  });
});

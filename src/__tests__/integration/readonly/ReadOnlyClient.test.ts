/**
 * Integration test for AdtClient read operations
 * Tests read/readMetadata for all object types
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - ADT library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=readonly/ReadOnlyClient
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtClient } from '../../../clients/AdtClient';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import {
  logTestEnd,
  logTestError,
  logTestSkip,
  logTestStart,
  logTestStep,
  logTestSuccess,
} from '../../helpers/testProgressLogger';
import { getConfig } from '../../helpers/sessionConfig';
import { TestConfigResolver } from '../../helpers/TestConfigResolver';
import {
  createConnectionLogger,
  createTestsLogger,
} from '../../helpers/testLogger';

const { getTimeout } = require('../../helpers/test-helper');

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
  let hasConfig = false;
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

      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, connectionLogger);
      hasConfig = true;
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
    getAdtObject: () => any,
    handlerName?: string,
    testCaseName?: string,
  ) {
    return async () => {
      if (!hasConfig || !client) {
        logTestSkip(
          testsLogger,
          `AdtClient - ${testName}`,
          'No SAP configuration',
        );
        return;
      }

      // Use TestConfigResolver for consistent parameter resolution
      const resolver = new TestConfigResolver({
        isCloud,
        logger: testsLogger,
        handlerName: handlerName || `read_${objectType}`,
        testCaseName: testCaseName || `readonly_read_${objectType}`,
      });

      const standardObject = resolver.getStandardObject(objectType);

      if (!standardObject) {
        logTestStart(testsLogger, `AdtClient - ${testName}`, {
          name: `readonly_read_${objectType}`,
          params: {},
        });
        logTestSkip(
          testsLogger,
          `AdtClient - ${testName}`,
          `Standard ${objectType} not configured for ${isCloud ? 'cloud' : 'on-premise'} environment`,
        );
        return;
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
        logTestStep('read active', testsLogger);
        const readActiveState = await adtObject.read(params, 'active');
        expect(readActiveState).toBeDefined();
        expect(readActiveState?.readResult).toBeDefined();
        logTestStep(
          `active length: ${getDataLength(readActiveState?.readResult?.data)}`,
          testsLogger,
        );

        logTestStep('read inactive', testsLogger);
        const readInactiveState = await adtObject.read(params, 'inactive');
        expect(readInactiveState).toBeDefined();
        expect(readInactiveState?.readResult).toBeDefined();
        logTestStep(
          `inactive length: ${getDataLength(readInactiveState?.readResult?.data)}`,
          testsLogger,
        );

        logTestStep('read metadata (active)', testsLogger);
        const metadataActiveState = await adtObject.readMetadata(params, {
          version: 'active',
        });
        expect(metadataActiveState).toBeDefined();
        expect(
          metadataActiveState?.metadataResult ||
            metadataActiveState?.readResult,
        ).toBeDefined();
        const metadataActiveResult =
          metadataActiveState?.metadataResult ||
          metadataActiveState?.readResult;
        logTestStep(
          `metadata active length: ${getDataLength(metadataActiveResult?.data)}`,
          testsLogger,
        );

        logTestStep('read metadata (inactive)', testsLogger);
        const metadataInactiveState = await adtObject.readMetadata(params, {
          version: 'inactive',
        });
        expect(metadataInactiveState).toBeDefined();
        expect(
          metadataInactiveState?.metadataResult ||
            metadataInactiveState?.readResult,
        ).toBeDefined();
        const metadataInactiveResult =
          metadataInactiveState?.metadataResult ||
          metadataInactiveState?.readResult;
        logTestStep(
          `metadata inactive length: ${getDataLength(
            metadataInactiveResult?.data,
          )}`,
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
    it(
      'should read existing program',
      createReadTest(
        'readProgram',
        'program',
        (name) => ({ programName: name }),
        () => client!.getProgram(),
        'read_program',
        'readonly_read_program',
      ),
      getTimeout('test'),
    );
  });

  describe('readClass', () => {
    it(
      'should read existing class',
      createReadTest(
        'readClass',
        'class',
        (name) => ({ className: name }),
        () => client!.getClass(),
        'read_class',
        'readonly_read_class',
      ),
      getTimeout('test'),
    );
  });

  describe('readInterface', () => {
    it(
      'should read existing interface',
      createReadTest(
        'readInterface',
        'interface',
        (name) => ({ interfaceName: name }),
        () => client!.getInterface(),
        'read_interface',
        'readonly_read_interface',
      ),
      getTimeout('test'),
    );
  });

  describe('readDomain', () => {
    it(
      'should read existing domain',
      createReadTest(
        'readDomain',
        'domain',
        (name) => ({ domainName: name }),
        () => client!.getDomain(),
        'read_domain',
        'readonly_read_domain',
      ),
      getTimeout('test'),
    );
  });

  describe('readDataElement', () => {
    it(
      'should read existing data element',
      createReadTest(
        'readDataElement',
        'dataElement',
        (name) => ({ dataElementName: name }),
        () => client!.getDataElement(),
        'read_data_element',
        'readonly_read_data_element',
      ),
      getTimeout('test'),
    );
  });

  describe('readStructure', () => {
    it(
      'should read existing structure',
      createReadTest(
        'readStructure',
        'structure',
        (name) => ({ structureName: name }),
        () => client!.getStructure(),
        'read_structure',
        'readonly_read_structure',
      ),
      getTimeout('test'),
    );
  });

  describe('readTable', () => {
    it(
      'should read existing table',
      async () => {
        if (!hasConfig || !client) {
          logTestSkip(
            testsLogger,
            'AdtClient - readTable',
            'No SAP configuration',
          );
          return;
        }

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
            logTestStart(testsLogger, 'AdtClient - readTable', {
              name: 'readonly_read_table',
              params: {},
            });
            logTestSkip(
              testsLogger,
              'AdtClient - readTable',
              'Standard CDS view not configured for cloud environment. ' +
                'Note: On cloud systems, 99% of tables are not readable via ADT, use CDS views instead.',
            );
            return;
          }

          const viewName = standardView.name;
          logTestStart(testsLogger, 'AdtClient - readTable', {
            name: 'readonly_read_table',
            params: {
              viewName,
              note: 'On cloud: using CDS view instead of table (99% of tables are not readable via ADT)',
            },
          });

          try {
            const viewClient = client.getView();
            logTestStep('read active (cloud view)', testsLogger);
            const readActiveState = await viewClient.read(
              { viewName },
              'active',
            );
            expect(readActiveState).toBeDefined();
            expect(readActiveState?.readResult).toBeDefined();
            logTestStep(
              `active length: ${getDataLength(
                readActiveState?.readResult?.data,
              )}`,
              testsLogger,
            );

            logTestStep('read inactive (cloud view)', testsLogger);
            const readInactiveState = await viewClient.read(
              { viewName },
              'inactive',
            );
            expect(readInactiveState).toBeDefined();
            expect(readInactiveState?.readResult).toBeDefined();
            logTestStep(
              `inactive length: ${getDataLength(
                readInactiveState?.readResult?.data,
              )}`,
              testsLogger,
            );

            logTestStep(
              'read metadata (active, cloud view)',
              testsLogger,
            );
            const metadataActiveState = await viewClient.readMetadata(
              { viewName },
              { version: 'active' },
            );
            expect(metadataActiveState).toBeDefined();
            expect(
              metadataActiveState?.metadataResult ||
                metadataActiveState?.readResult,
            ).toBeDefined();
            const metadataActiveResult =
              metadataActiveState?.metadataResult ||
              metadataActiveState?.readResult;
            logTestStep(
              `metadata active length: ${getDataLength(
                metadataActiveResult?.data,
              )}`,
              testsLogger,
            );

            logTestStep(
              'read metadata (inactive, cloud view)',
              testsLogger,
            );
            const metadataInactiveState = await viewClient.readMetadata(
              { viewName },
              { version: 'inactive' },
            );
            expect(metadataInactiveState).toBeDefined();
            expect(
              metadataInactiveState?.metadataResult ||
                metadataInactiveState?.readResult,
            ).toBeDefined();
            const metadataInactiveResult =
              metadataInactiveState?.metadataResult ||
              metadataInactiveState?.readResult;
            logTestStep(
              `metadata inactive length: ${getDataLength(
                metadataInactiveResult?.data,
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
            logTestStart(testsLogger, 'AdtClient - readTable', {
              name: 'readonly_read_table',
              params: {},
            });
            logTestSkip(
              testsLogger,
              'AdtClient - readTable',
              'Standard table not configured for on-premise environment',
            );
            return;
          }

          const tableName = standardTable.name;
          logTestStart(testsLogger, 'AdtClient - readTable', {
            name: 'readonly_read_table',
            params: { tableName },
          });

          try {
            const tableClient = client.getTable();
            logTestStep('read active', testsLogger);
            const readActiveState = await tableClient.read(
              { tableName },
              'active',
            );
            expect(readActiveState).toBeDefined();
            expect(readActiveState?.readResult).toBeDefined();
            logTestStep(
              `active length: ${getDataLength(
                readActiveState?.readResult?.data,
              )}`,
              testsLogger,
            );

            logTestStep('read inactive', testsLogger);
            const readInactiveState = await tableClient.read(
              { tableName },
              'inactive',
            );
            expect(readInactiveState).toBeDefined();
            expect(readInactiveState?.readResult).toBeDefined();
            logTestStep(
              `inactive length: ${getDataLength(
                readInactiveState?.readResult?.data,
              )}`,
              testsLogger,
            );

            logTestStep('read metadata (active)', testsLogger);
            const metadataActiveState = await tableClient.readMetadata(
              { tableName },
              { version: 'active' },
            );
            expect(metadataActiveState).toBeDefined();
            expect(
              metadataActiveState?.metadataResult ||
                metadataActiveState?.readResult,
            ).toBeDefined();
            const metadataActiveResult =
              metadataActiveState?.metadataResult ||
              metadataActiveState?.readResult;
            logTestStep(
              `metadata active length: ${getDataLength(
                metadataActiveResult?.data,
              )}`,
              testsLogger,
            );

            logTestStep('read metadata (inactive)', testsLogger);
            const metadataInactiveState = await tableClient.readMetadata(
              { tableName },
              { version: 'inactive' },
            );
            expect(metadataInactiveState).toBeDefined();
            expect(
              metadataInactiveState?.metadataResult ||
                metadataInactiveState?.readResult,
            ).toBeDefined();
            const metadataInactiveResult =
              metadataInactiveState?.metadataResult ||
              metadataInactiveState?.readResult;
            logTestStep(
              `metadata inactive length: ${getDataLength(
                metadataInactiveResult?.data,
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
    it(
      'should read existing view',
      createReadTest(
        'readView',
        'view',
        (name) => ({ viewName: name }),
        () => client!.getView(),
        'read_view',
        'readonly_read_view',
      ),
      getTimeout('test'),
    );
  });

  describe('readFunctionGroup', () => {
    it(
      'should read existing function group',
      createReadTest(
        'readFunctionGroup',
        'function_group',
        (name) => ({ functionGroupName: name }),
        () => client!.getFunctionGroup(),
        'read_function_group',
        'readonly_read_function_group',
      ),
      getTimeout('test'),
    );
  });

  describe('readFunctionModule', () => {
    it(
      'should read existing function module',
      createReadTest(
        'readFunctionModule',
        'function_module',
        (name, group) => ({
          functionModuleName: name,
          functionGroupName: group,
        }),
        () => client!.getFunctionModule(),
        'read_function_module',
        'readonly_read_function_module',
      ),
      getTimeout('test'),
    );
  });

  describe('readPackage', () => {
    it(
      'should read existing package',
      createReadTest(
        'readPackage',
        'package',
        (name) => ({ packageName: name }),
        () => client!.getPackage(),
        'read_package',
        'readonly_read_package',
      ),
      getTimeout('test'),
    );
  });

  describe('readServiceDefinition', () => {
    it(
      'should read existing service definition',
      createReadTest(
        'readServiceDefinition',
        'serviceDefinition',
        (name) => ({ serviceDefinitionName: name }),
        () => client!.getServiceDefinition(),
        'read_service_definition',
        'readonly_read_service_definition',
      ),
      getTimeout('test'),
    );
  });

  describe('readTransport', () => {
    it(
      'should read existing transport request',
      async () => {
        if (!hasConfig || !client) {
          logTestSkip(
            testsLogger,
            'AdtClient - readTransport',
            'No SAP configuration',
          );
          return;
        }

        // Use TestConfigResolver for consistent parameter resolution
        const resolver = new TestConfigResolver({
          isCloud,
          logger: testsLogger,
        });
        // Try to get transport request from test case or global defaults
        const transportRequest = resolver.getTransportRequest();

        if (!transportRequest) {
          logTestStart(testsLogger, 'AdtClient - readTransport', {
            name: 'readonly_read_transport',
            params: {},
          });
          logTestSkip(
            testsLogger,
            'AdtClient - readTransport',
            'Transport request not configured in test-config.yaml (required for transport read test)',
          );
          return;
        }

        logTestStart(testsLogger, 'AdtClient - readTransport', {
          name: 'readonly_read_transport',
          params: { transport_request: transportRequest },
        });

        try {
          const requestClient = client.getRequest();
          logTestStep('read active', testsLogger);
          const readActiveState = await requestClient.read({
            transportNumber: transportRequest,
          });
          expect(readActiveState).toBeDefined();
          expect(readActiveState?.readResult).toBeDefined();
          logTestStep(
            `active length: ${getDataLength(
              readActiveState?.readResult?.data,
            )}`,
            testsLogger,
          );

          logTestStep('read inactive', testsLogger);
          const readInactiveState = await requestClient.read(
            {
              transportNumber: transportRequest,
            },
            'inactive',
          );
          expect(readInactiveState).toBeDefined();
          expect(readInactiveState?.readResult).toBeDefined();
          logTestStep(
            `inactive length: ${getDataLength(
              readInactiveState?.readResult?.data,
            )}`,
            testsLogger,
          );

          logTestStep('read metadata', testsLogger);
          const metadataState = await requestClient.readMetadata({
            transportNumber: transportRequest,
          });
          expect(metadataState).toBeDefined();
          expect(metadataState?.readResult).toBeDefined();
          logTestStep(
            `metadata length: ${getDataLength(metadataState?.readResult?.data)}`,
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

/**
 * Integration test for ReadOnlyClient
 * Tests read-only operations for all object types
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - ReadOnlyClient library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=readonly/ReadOnlyClient
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { ReadOnlyClient } from '../../../clients/ReadOnlyClient';
import { getConfig } from '../../helpers/sessionConfig';
import { createConnectionLogger, createTestsLogger } from '../../helpers/testLogger';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import { TestConfigResolver } from '../../helpers/TestConfigResolver';
import {
  logBuilderTestStart,
  logBuilderTestSkip,
  logBuilderTestSuccess,
  logBuilderTestError,
  logBuilderTestEnd
} from '../../helpers/builderTestLogger';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const {
  getTimeout
} = require('../../helpers/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('ReadOnlyClient', () => {
  let connection: IAbapConnection | null = null;
  let client: ReadOnlyClient | null = null;
  let hasConfig = false;
  let isCloud = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      if (!config) {
        testsLogger.warn?.('⚠️ Skipping tests: No .env file or SAP configuration found');
        return;
      }

      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new ReadOnlyClient(connection, connectionLogger);
      hasConfig = true;
      isCloud = await isCloudEnvironment(connection);
      
      testsLogger.info?.(`✅ ReadOnlyClient test environment setup complete (${isCloud ? 'cloud' : 'onprem'})`);
    } catch (error: any) {
      testsLogger.error?.('❌ Failed to setup test environment:', error);
      throw error;
    }
  });

  afterAll(async () => {
    if (connection) {
      // Connection cleanup is handled by @mcp-abap-adt/connection
      testsLogger.info?.('✅ ReadOnlyClient test environment cleanup complete');
    }
  });

  // Helper function to create a read test
  function createReadTest(
    testName: string,
    objectType: string,
    readFn: (name: string, group?: string) => Promise<any>,
    getReadResultFn: () => any,
    paramName: string,
    groupParamName?: string
  ) {
    return async () => {
      if (!hasConfig || !client) {
        logBuilderTestSkip(testsLogger, `ReadOnlyClient - ${testName}`, 'No SAP configuration');
        return;
      }

      // Use TestConfigResolver for consistent parameter resolution
      const resolver = new TestConfigResolver({ isCloud, logger: testsLogger });
      const standardObject = resolver.getStandardObject(objectType);
      
      if (!standardObject) {
        logBuilderTestStart(testsLogger, `ReadOnlyClient - ${testName}`, {
          name: `readonly_read_${objectType}`,
          params: {}
        });
        logBuilderTestSkip(testsLogger, `ReadOnlyClient - ${testName}`,
          `Standard ${objectType} not configured for ${isCloud ? 'cloud' : 'on-premise'} environment`);
        return;
      }

      const objectName = standardObject.name;
      const groupName = standardObject.group;
      const params: any = { [paramName]: objectName };
      if (groupParamName && groupName) {
        params[groupParamName] = groupName;
      }

      logBuilderTestStart(testsLogger, `ReadOnlyClient - ${testName}`, {
        name: `readonly_read_${objectType}`,
        params
      });

      try {
        const result = groupParamName && groupName
          ? await readFn(objectName, groupName)
          : await readFn(objectName);

        expect(result).toBeDefined();
        expect(result?.[paramName] || result?.name).toBe(objectName);
        if (groupParamName && groupName) {
          expect(result?.[groupParamName] || result?.group).toBe(groupName);
        }
        expect(getReadResultFn()).toBeDefined();
        expect(client!.getReadResult()).toBeDefined();

        logBuilderTestSuccess(testsLogger, `ReadOnlyClient - ${testName}`);
      } catch (error) {
        logBuilderTestError(testsLogger, `ReadOnlyClient - ${testName}`, error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, `ReadOnlyClient - ${testName}`);
      }
    };
  }

  describe('readProgram', () => {
    it('should read existing program', createReadTest(
      'readProgram',
      'program',
      (name) => client!.readProgram(name),
      () => client!.getProgramReadResult(),
      'programName'
    ), getTimeout('test'));
  });

  describe('readClass', () => {
    it('should read existing class', createReadTest(
      'readClass',
      'class',
      (name) => client!.readClass(name),
      () => client!.getClassReadResult(),
      'className'
    ), getTimeout('test'));
  });

  describe('readInterface', () => {
    it('should read existing interface', createReadTest(
      'readInterface',
      'interface',
      (name) => client!.readInterface(name),
      () => client!.getInterfaceReadResult(),
      'interfaceName'
    ), getTimeout('test'));
  });

  describe('readDomain', () => {
    it('should read existing domain', createReadTest(
      'readDomain',
      'domain',
      (name) => client!.readDomain(name),
      () => client!.getDomainReadResult(),
      'domainName'
    ), getTimeout('test'));
  });

  describe('readDataElement', () => {
    it('should read existing data element', createReadTest(
      'readDataElement',
      'dataElement',
      (name) => client!.readDataElement(name),
      () => client!.getDataElementReadResult(),
      'dataElementName'
    ), getTimeout('test'));
  });

  describe('readStructure', () => {
    it('should read existing structure', createReadTest(
      'readStructure',
      'structure',
      (name) => client!.readStructure(name),
      () => client!.getStructureReadResult(),
      'structureName'
    ), getTimeout('test'));
  });

  describe('readTable', () => {
    it('should read existing table', createReadTest(
      'readTable',
      'table',
      (name) => client!.readTable(name),
      () => client!.getTableReadResult(),
      'tableName'
    ), getTimeout('test'));
  });

  describe('readView', () => {
    it('should read existing view', createReadTest(
      'readView',
      'view',
      (name) => client!.readView(name),
      () => client!.getViewReadResult(),
      'viewName'
    ), getTimeout('test'));
  });

  describe('readFunctionGroup', () => {
    it('should read existing function group', createReadTest(
      'readFunctionGroup',
      'function_group',
      (name) => client!.readFunctionGroup(name),
      () => client!.getFunctionGroupReadResult(),
      'functionGroupName'
    ), getTimeout('test'));
  });

  describe('readFunctionModule', () => {
    it('should read existing function module', createReadTest(
      'readFunctionModule',
      'function_module',
      (name, group) => client!.readFunctionModule(name, group!),
      () => client!.getFunctionModuleReadResult(),
      'functionModuleName',
      'functionGroupName'
    ), getTimeout('test'));
  });

  describe('readPackage', () => {
    it('should read existing package', createReadTest(
      'readPackage',
      'package',
      (name) => client!.readPackage(name),
      () => client!.getPackageReadResult(),
      'packageName'
    ), getTimeout('test'));
  });

  describe('readServiceDefinition', () => {
    it('should read existing service definition', createReadTest(
      'readServiceDefinition',
      'serviceDefinition',
      (name) => client!.readServiceDefinition(name),
      () => client!.getServiceDefinitionReadResult(),
      'serviceDefinitionName'
    ), getTimeout('test'));
  });

  describe('readTransport', () => {
    it('should read existing transport request', async () => {
      if (!hasConfig || !client) {
        logBuilderTestSkip(testsLogger, 'ReadOnlyClient - readTransport', 'No SAP configuration');
        return;
      }

      // Use TestConfigResolver for consistent parameter resolution
      const resolver = new TestConfigResolver({ isCloud, logger: testsLogger });
      // Try to get transport request from test case or global defaults
      const transportRequest = resolver.getTransportRequest();
      
      if (!transportRequest) {
        logBuilderTestStart(testsLogger, 'ReadOnlyClient - readTransport', {
          name: 'readonly_read_transport',
          params: {}
        });
        logBuilderTestSkip(testsLogger, 'ReadOnlyClient - readTransport',
          'Transport request not configured in test-config.yaml (required for transport read test)');
        return;
      }

      logBuilderTestStart(testsLogger, 'ReadOnlyClient - readTransport', {
        name: 'readonly_read_transport',
        params: { transport_request: transportRequest }
      });

      try {
        const result = await client.readTransport(transportRequest);

        expect(result).toBeDefined();
        expect(result).toBe(client); // readTransport returns this for chaining
        const readResult = client.getReadResult();
        expect(readResult).toBeDefined();
        // Verify that the transport request was read successfully
        expect(readResult?.data).toBeDefined();

        logBuilderTestSuccess(testsLogger, 'ReadOnlyClient - readTransport');
      } catch (error) {
        logBuilderTestError(testsLogger, 'ReadOnlyClient - readTransport', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'ReadOnlyClient - readTransport');
      }
    }, getTimeout('test'));
  });
});

/**
 * Integration tests for ReadOnlyClient
 * Tests against real ABAP system using test-config.yaml
 */

import { ReadOnlyClient } from '../clients/ReadOnlyClient';
import { createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { isCloudEnvironment as checkIsCloudEnvironment } from '../core/shared/systemInfo';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load test helper
const { getEnabledTestCase } = require('../../tests/test-helper');

// Load environment variables
const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

function getConfig(): SapConfig {
  const rawUrl = process.env.SAP_URL;
  const url = rawUrl ? rawUrl.split('#')[0].trim() : rawUrl;
  const rawClient = process.env.SAP_CLIENT;
  const client = rawClient ? rawClient.split('#')[0].trim() : rawClient;
  const rawAuthType = process.env.SAP_AUTH_TYPE || 'basic';
  const authType = rawAuthType.split('#')[0].trim();

  if (!url || !/^https?:\/\//.test(url)) {
    throw new Error(`Missing or invalid SAP_URL: ${url}`);
  }

  const config: SapConfig = {
    url,
    authType: authType === 'xsuaa' ? 'jwt' : (authType as 'basic' | 'jwt'),
  };

  if (client) {
    config.client = client;
  }

  if (authType === 'jwt' || authType === 'xsuaa') {
    const jwtToken = process.env.SAP_JWT_TOKEN;
    if (!jwtToken) {
      throw new Error('Missing SAP_JWT_TOKEN for JWT authentication');
    }
    config.jwtToken = jwtToken;
  } else {
    const username = process.env.SAP_USERNAME;
    const password = process.env.SAP_PASSWORD;
    if (!username || !password) {
      throw new Error('Missing SAP_USERNAME or SAP_PASSWORD for basic authentication');
    }
    config.username = username;
    config.password = password;
  }

  return config;
}

describe('ReadOnlyClient Integration Tests', () => {
  let client: ReadOnlyClient;
  let connection: any;
  let hasConfig = false;
  let isCloud = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      });
      client = new ReadOnlyClient(connection);
      hasConfig = true;

      // Detect if this is BTP ABAP Cloud Environment by checking systeminformation endpoint
      // On-premise systems don't have this endpoint, cloud systems do
      isCloud = await checkIsCloudEnvironment(connection);

      if (isCloud) {
        console.log('ℹ️  Detected BTP ABAP Cloud Environment - programs not available');
      } else {
        console.log('ℹ️  Detected on-premise/S4HANA system - all object types available');
      }
    } catch (error) {
      console.warn('⚠️  Integration tests skipped: No .env file or SAP configuration found');
      console.warn('   Create .env file in project root with SAP_URL, SAP_AUTH_TYPE, etc.');
      hasConfig = false;
    }
  });  afterAll(async () => {
    if (connection) {
      connection.reset();
    }
  });

  describe('getProgram', () => {
    it('should retrieve standard program source code', async () => {
      if (!hasConfig) {
        console.log('Skipping: No SAP configuration');
        return;
      }

      if (isCloud) {
        console.log('Skipping: Programs not available in BTP ABAP Cloud Environment');
        return;
      }

      const testCase = getEnabledTestCase('get_program', 'standard_program');
      if (!testCase) {
        console.warn('Test case not found or disabled, skipping');
        return;
      }

      const response = await client.getProgram(testCase.params.program_name);
      expect(response.status).toBe(200);
      expect(typeof response.data).toBe('string');
      expect(response.data.length).toBeGreaterThan(0);
    });

    it('should retrieve test program source code', async () => {
      if (!hasConfig) return;
      if (isCloud) {
        console.log('Skipping: Programs not available in BTP ABAP Cloud Environment');
        return;
      }
      const testCase = getEnabledTestCase('get_program', 'test_program');
      if (!testCase) return;
      const response = await client.getProgram(testCase.params.program_name);
      expect(response.status).toBe(200);
      expect(typeof response.data).toBe('string');
    });
  });

  describe('getClass', () => {
    it('should retrieve standard class source code', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('get_class', 'standard_class');
      if (!testCase) return;
      const response = await client.getClass(testCase.params.class_name);
      expect(response.status).toBe(200);
      expect(typeof response.data).toBe('string');
    });

    it('should retrieve test class source code', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('get_class', 'test_class');
      if (!testCase) return;
      const response = await client.getClass(testCase.params.class_name);
      expect(response.status).toBe(200);
      expect(typeof response.data).toBe('string');
    });
  });

  describe('getTable', () => {
    it('should retrieve standard table structure', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('get_table', 'standard_table');
      if (!testCase) return;
      const response = await client.getTable(testCase.params.table_name);
      expect(response.status).toBe(200);
      expect(typeof response.data).toBe('string');
    });

    it('should retrieve MARA table structure', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('get_table', 'mara_table');
      if (!testCase) return;
      const response = await client.getTable(testCase.params.table_name);
      expect(response.status).toBe(200);
      expect(typeof response.data).toBe('string');
    });
  });

  describe('getStructure', () => {
    it('should retrieve standard structure definition', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('get_structure', 'standard_structure');
      if (!testCase) return;
      const response = await client.getStructure(testCase.params.structure_name);
      expect(response.status).toBe(200);
      expect(typeof response.data).toBe('string');
    });

    it('should retrieve MARA structure definition', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('get_structure', 'mara_structure');
      if (!testCase) return;
      const response = await client.getStructure(testCase.params.structure_name);
      expect(response.status).toBe(200);
      expect(typeof response.data).toBe('string');
    });
  });

  describe('getDomain', () => {
    it('should retrieve standard domain definition', async () => {
      if (!hasConfig) return;

      const testCase = getEnabledTestCase('get_domain', 'standard_domain');
      if (!testCase) {
        console.log('Skipping: get_domain test case not configured');
        return;
      }

      const response = await client.getDomain(testCase.params.domain_name);
      expect(response.status).toBe(200);
      expect(typeof response.data).toBe('string');
    });

    it('should retrieve test domain definition', async () => {
      if (!hasConfig) return;

      const testCase = getEnabledTestCase('get_domain', 'test_domain');
      if (!testCase) {
        console.log('Skipping: test_domain test case not configured');
        return;
      }

      const response = await client.getDomain(testCase.params.domain_name);
      expect(response.status).toBe(200);
      expect(typeof response.data).toBe('string');
    });
  });

  describe('getDataElement', () => {
    it('should retrieve standard data element definition', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('get_data_element', 'standard_data_element');
      if (!testCase) return;
      const response = await client.getDataElement(testCase.params.data_element_name);
      expect(response.status).toBe(200);
      expect(typeof response.data).toBe('string');
    });

    it('should retrieve test data element definition', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('get_data_element', 'test_data_element');
      if (!testCase) return;
      const response = await client.getDataElement(testCase.params.data_element_name);
      expect(response.status).toBe(200);
      expect(typeof response.data).toBe('string');
    });
  });

  describe('getInterface', () => {
    it('should retrieve standard interface source code', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('get_interface', 'standard_interface');
      if (!testCase) return;
      const response = await client.getInterface(testCase.params.interface_name);
      expect(response.status).toBe(200);
      expect(typeof response.data).toBe('string');
    });

    it('should retrieve test interface source code', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('get_interface', 'test_interface');
      if (!testCase) return;
      const response = await client.getInterface(testCase.params.interface_name);
      expect(response.status).toBe(200);
      expect(typeof response.data).toBe('string');
    });
  });

  describe('getFunctionGroup', () => {
    it('should retrieve standard function group', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('get_function_group', 'standard_function_group');
      if (!testCase) return;
      const response = await client.getFunctionGroup(testCase.params.function_group);
      expect(response.status).toBe(200);
      expect(typeof response.data).toBe('string');
    });

    it('should retrieve SRFC function group', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('get_function_group', 'srf_function_group');
      if (!testCase) return;
      const response = await client.getFunctionGroup(testCase.params.function_group);
      expect(response.status).toBe(200);
      expect(typeof response.data).toBe('string');
    });

    it('should retrieve test function group', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('get_function_group', 'test_function_group');
      if (!testCase) return;
      const response = await client.getFunctionGroup(testCase.params.function_group);
      expect(response.status).toBe(200);
      expect(typeof response.data).toBe('string');
    });
  });

  describe('getFunction', () => {
    it('should retrieve standard function module', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('get_function', 'standard_function');
      if (!testCase) return;
      const response = await client.getFunction(
        testCase.params.function_name,
        testCase.params.function_group
      );
      expect(response.status).toBe(200);
      expect(typeof response.data).toBe('string');
    });

    it('should retrieve test function module', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('get_function', 'test_function');
      if (!testCase) return;
      const response = await client.getFunction(
        testCase.params.function_name,
        testCase.params.function_group
      );
      expect(response.status).toBe(200);
      expect(typeof response.data).toBe('string');
    });
  });

  describe('getPackage', () => {
    it('should retrieve standard package information', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('get_package', 'standard_package');
      if (!testCase) return;
      const response = await client.getPackage(testCase.params.package_name);
      expect(response.status).toBe(200);
      expect(typeof response.data).toBe('string');
    });

    it('should retrieve test package information', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('get_package', 'test_package');
      if (!testCase) return;
      const response = await client.getPackage(testCase.params.package_name);
      expect(response.status).toBe(200);
      expect(typeof response.data).toBe('string');
    });
  });

  describe('getView', () => {
    it('should retrieve standard view definition', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('get_view', 'standard_view');
      if (!testCase || !testCase.params.view_name) {
        console.log('Skipping: View test case not configured');
        return;
      }
      const response = await client.getView(testCase.params.view_name);
      // View might not exist, so accept 200 or 404
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(typeof response.data).toBe('string');
      }
    });

    it('should retrieve test view definition', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('get_view', 'test_view');
      if (!testCase || !testCase.params.view_name) {
        console.log('Skipping: View test case not configured');
        return;
      }
      const response = await client.getView(testCase.params.view_name);
      // View might not exist, so accept 200 or 404
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(typeof response.data).toBe('string');
      }
    });
  });

  describe('fetchNodeStructure', () => {
    it('should fetch node structure for program includes', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('fetch_node_structure', 'program_includes');
      if (!testCase) return;
      const response = await client.fetchNodeStructure(
        testCase.params.parent_name,
        testCase.params.parent_tech_name,
        testCase.params.parent_type,
        testCase.params.node_key,
        testCase.params.with_short_descriptions ?? true
      );
      expect(response.status).toBe(200);
      expect(typeof response.data).toBe('string');
    });

    it('should fetch node structure for function group objects', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('fetch_node_structure', 'function_group_objects');
      if (!testCase) return;
      const response = await client.fetchNodeStructure(
        testCase.params.parent_name,
        testCase.params.parent_tech_name,
        testCase.params.parent_type,
        testCase.params.node_key,
        testCase.params.with_short_descriptions ?? true
      );
      expect(response.status).toBe(200);
      expect(typeof response.data).toBe('string');
    });
  });

  describe('getSystemInformation', () => {
    it('should get system information (cloud only)', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('get_system_information', 'system_info');
      if (!testCase) return;
      const result = await client.getSystemInformation();
      // On cloud systems, should return systemID and userName
      // On on-premise, returns null
      if (result) {
        expect(result).toHaveProperty('systemID');
        expect(result).toHaveProperty('userName');
      }
      // Both null and object are valid responses
    });
  });
});


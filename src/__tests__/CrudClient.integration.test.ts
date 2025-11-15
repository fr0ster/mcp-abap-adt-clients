/**
 * Integration tests for CrudClient
 * Tests against real ABAP system using test-config.yaml
 */

import { CrudClient } from '../clients/CrudClient';
import { createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
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

describe('CrudClient Integration Tests', () => {
  let client: CrudClient;
  let connection: any;
  let hasConfig = false;

  beforeAll(() => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      });
      client = new CrudClient(connection);
      hasConfig = true;
    } catch (error) {
      console.warn('⚠️  Integration tests skipped: No .env file or SAP configuration found');
      console.warn('   Create .env file in project root with SAP_URL, SAP_AUTH_TYPE, etc.');
      hasConfig = false;
    }
  });

  afterAll(async () => {
    if (connection) {
      connection.reset();
    }
  });

  // ============================================================================
  // TRANSPORT OPERATIONS
  // ============================================================================

  describe('createTransport', () => {
    it('should create workbench transport request', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('create_transport', 'workbench_transport');
      if (!testCase) {
        console.log('Skipping: create_transport test case not configured');
        return;
      }

      const response = await client.createTransport(testCase.params);
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('transport_request');
    });
  });

  // ============================================================================
  // PACKAGE OPERATIONS
  // ============================================================================

  describe('createPackage', () => {
    it('should create test package', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('create_package', 'test_package');
      if (!testCase) {
        console.log('Skipping: create_package test case not configured');
        return;
      }

      const response = await client.createPackage(testCase.params);
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('package_name');
    });
  });

  // ============================================================================
  // DOMAIN OPERATIONS
  // ============================================================================

  describe('createDomain', () => {
    it('should create test domain', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('create_domain', 'test_domain');
      if (!testCase) {
        console.log('Skipping: create_domain test case not configured');
        return;
      }

      const response = await client.createDomain(testCase.params);
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
      expect(response.data).toHaveProperty('success', true);
    });
  });

  describe('updateDomain', () => {
    it('should update test domain', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('update_domain', 'test_domain');
      if (!testCase) {
        console.log('Skipping: update_domain test case not configured');
        return;
      }

      const response = await client.updateDomain(testCase.params);
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
      expect(response.data).toHaveProperty('success', true);
    });
  });

  // ============================================================================
  // DATA ELEMENT OPERATIONS
  // ============================================================================

  describe('createDataElement', () => {
    it('should create test data element', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('create_data_element', 'test_data_element');
      if (!testCase) {
        console.log('Skipping: create_data_element test case not configured');
        return;
      }

      const response = await client.createDataElement(testCase.params);
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
      expect(response.data).toHaveProperty('success', true);
    });
  });

  describe('updateDataElement', () => {
    it('should update test data element', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('update_data_element', 'test_data_element');
      if (!testCase) {
        console.log('Skipping: update_data_element test case not configured');
        return;
      }

      const response = await client.updateDataElement(testCase.params);
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
      expect(response.data).toHaveProperty('success', true);
    });
  });

  // ============================================================================
  // CLASS OPERATIONS
  // ============================================================================

  describe('createClass', () => {
    it('should create test class', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('create_class', 'test_class');
      if (!testCase) {
        console.log('Skipping: create_class test case not configured');
        return;
      }

      const response = await client.createClass(testCase.params);
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
      expect(response.data).toHaveProperty('success', true);
    });
  });

  // updateClassSource removed - use low-level functions: lockClass -> updateClass -> unlockClass -> activateClass

  // ============================================================================
  // PROGRAM OPERATIONS
  // ============================================================================

  describe('createProgram', () => {
    it('should create test program', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('create_program', 'test_program');
      if (!testCase) {
        console.log('Skipping: create_program test case not configured');
        return;
      }

      const response = await client.createProgram(testCase.params);
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
      expect(response.data).toHaveProperty('success', true);
    });
  });

  describe('updateProgramSource', () => {
    it('should update test program source', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('update_program_source', 'test_program');
      if (!testCase) {
        console.log('Skipping: update_program_source test case not configured');
        return;
      }

      const response = await client.updateProgramSource(testCase.params);
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
      expect(response.data).toHaveProperty('success', true);
    });
  });

  // ============================================================================
  // INTERFACE OPERATIONS
  // ============================================================================

  describe('createInterface', () => {
    it('should create test interface', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('create_interface', 'test_interface');
      if (!testCase) {
        console.log('Skipping: create_interface test case not configured');
        return;
      }

      const response = await client.createInterface(testCase.params);
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
      expect(response.data).toHaveProperty('success', true);
    });
  });

  describe('updateInterfaceSource', () => {
    it('should update test interface source', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('update_interface_source', 'test_interface');
      if (!testCase) {
        console.log('Skipping: update_interface_source test case not configured');
        return;
      }

      const response = await client.updateInterfaceSource(testCase.params);
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
      expect(response.data).toHaveProperty('success', true);
    });
  });

  // ============================================================================
  // TABLE OPERATIONS
  // ============================================================================

  describe('createTable', () => {
    it('should create test table', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('create_table', 'test_table');
      if (!testCase) {
        console.log('Skipping: create_table test case not configured');
        return;
      }

      const response = await client.createTable(testCase.params);
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
      expect(response.data).toHaveProperty('success', true);
    });
  });

  // ============================================================================
  // STRUCTURE OPERATIONS
  // ============================================================================

  describe('createStructure', () => {
    it('should create test structure', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('create_structure', 'test_structure');
      if (!testCase) {
        console.log('Skipping: create_structure test case not configured');
        return;
      }

      const response = await client.createStructure(testCase.params);
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
      expect(response.data).toHaveProperty('success', true);
    });
  });

  // ============================================================================
  // VIEW OPERATIONS
  // ============================================================================

  describe('createView', () => {
    it('should create test view', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('create_view', 'test_view');
      if (!testCase) {
        console.log('Skipping: create_view test case not configured');
        return;
      }

      const response = await client.createView(testCase.params);
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
      expect(response.data).toHaveProperty('success', true);
    });
  });

  describe('updateViewSource', () => {
    it('should update test view source', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('update_view_source', 'test_view');
      if (!testCase) {
        console.log('Skipping: update_view_source test case not configured');
        return;
      }

      const response = await client.updateViewSource(testCase.params);
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
      expect(response.data).toHaveProperty('success', true);
    });
  });

  // ============================================================================
  // FUNCTION GROUP OPERATIONS
  // ============================================================================

  describe('createFunctionGroup', () => {
    it('should create test function group', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('create_function_group', 'test_function_group');
      if (!testCase) {
        console.log('Skipping: create_function_group test case not configured');
        return;
      }

      const response = await client.createFunctionGroup(testCase.params);
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
      expect(response.data).toHaveProperty('success', true);
    });
  });

  // ============================================================================
  // FUNCTION MODULE OPERATIONS
  // ============================================================================

  describe('createFunctionModule', () => {
    it('should create test function module', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('create_function_module', 'test_function_module');
      if (!testCase) {
        console.log('Skipping: create_function_module test case not configured');
        return;
      }

      const response = await client.createFunctionModule(testCase.params);
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
      expect(response.data).toHaveProperty('success', true);
    });
  });

  describe('updateFunctionModuleSource', () => {
    it('should update test function module source', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('update_function_module_source', 'test_function_module');
      if (!testCase) {
        console.log('Skipping: update_function_module_source test case not configured');
        return;
      }

      const response = await client.updateFunctionModuleSource(testCase.params);
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
      expect(response.data).toHaveProperty('success', true);
    });
  });

  // ============================================================================
  // DELETE OPERATIONS
  // ============================================================================

  describe('deleteObject', () => {
    it('should delete test domain', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('delete_domain', 'test_domain');
      if (!testCase) {
        console.log('Skipping: delete_domain test case not configured');
        return;
      }

      const response = await client.deleteObject(testCase.params);
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
    });
  });
});



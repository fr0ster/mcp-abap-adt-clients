/**
 * Integration tests for Check operations
 * Tests check functions for all object types using test-config.yaml
 */

import { CrudClient } from '../clients/CrudClient';
import { createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import * as programCheck from '../core/program/check';
import * as classCheck from '../core/class/check';
import * as interfaceCheck from '../core/interface/check';
import * as domainCheck from '../core/domain/check';
import * as dataElementCheck from '../core/dataElement/check';
import * as structureCheck from '../core/structure/check';
import * as viewCheck from '../core/view/check';
import * as functionGroupCheck from '../core/functionGroup/check';
import * as functionModuleCheck from '../core/functionModule/check';
import * as tableCheck from '../core/table/check';
import * as packageCheck from '../core/package/check';

// Load test helper (environment variables are loaded automatically)
const { getEnabledTestCase } = require('../../tests/test-helper');

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

describe('Check Operations Integration Tests', () => {
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
  // PROGRAM CHECK
  // ============================================================================

  describe('checkProgram', () => {
    it('should check test program syntax', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('check_program');
      if (!testCase) {
        return; // Skip silently if test case not configured
      }

      const { generateSessionId } = await import('../utils/sessionUtils');
      const sessionId = generateSessionId();
      const response = await programCheck.checkProgram(
        connection,
        testCase.params.program_name,
        testCase.params.version || 'active',
        sessionId
      );
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
    });
  });

  // ============================================================================
  // CLASS CHECK
  // ============================================================================

  describe('checkClass', () => {
    it('should check test class syntax', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('check_class');
      if (!testCase) {
        return; // Skip silently if test case not configured
      }

      const { generateSessionId } = await import('../utils/sessionUtils');
      const sessionId = generateSessionId();
      const response = await classCheck.checkClass(
        connection,
        testCase.params.class_name,
        testCase.params.version || 'active',
        undefined, // sourceCode - not provided, checks existing class
        sessionId
      );
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
    });
  });

  // ============================================================================
  // INTERFACE CHECK
  // ============================================================================

  describe('checkInterface', () => {
    it('should check test interface syntax', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('check_interface');
      if (!testCase) {
        return; // Skip silently if test case not configured
      }

      const { generateSessionId } = await import('../utils/sessionUtils');
      const sessionId = generateSessionId();
      const response = await interfaceCheck.checkInterface(
        connection,
        testCase.params.interface_name,
        testCase.params.version || 'active',
        sessionId
      );
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
    });
  });

  // ============================================================================
  // DOMAIN CHECK
  // ============================================================================

  describe('checkDomainSyntax', () => {
    it('should check test domain syntax', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('check_domain');
      if (!testCase) {
        return; // Skip silently if test case not configured
      }

      const { generateSessionId } = await import('../utils/sessionUtils');
      const sessionId = generateSessionId();
      const response = await domainCheck.checkDomainSyntax(
        connection,
        testCase.params.domain_name,
        testCase.params.version || 'inactive',
        sessionId
      );
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
    });
  });

  // ============================================================================
  // DATA ELEMENT CHECK
  // ============================================================================

  describe('checkDataElement', () => {
    it('should check test data element syntax', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('check_data_element');
      if (!testCase) {
        return; // Skip silently if test case not configured
      }

      const { generateSessionId } = await import('../utils/sessionUtils');
      const sessionId = generateSessionId();
      const response = await dataElementCheck.checkDataElement(
        connection,
        testCase.params.data_element_name,
        testCase.params.version || 'active',
        sessionId
      );
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
    });
  });

  // ============================================================================
  // STRUCTURE CHECK
  // ============================================================================

  describe('checkStructure', () => {
    it('should check test structure syntax', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('check_structure');
      if (!testCase) {
        return; // Skip silently if test case not configured
      }

      const { generateSessionId } = await import('../utils/sessionUtils');
      const sessionId = generateSessionId();
      const response = await structureCheck.checkStructure(
        connection,
        testCase.params.structure_name,
        testCase.params.version || 'active',
        sessionId
      );
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
    });
  });

  // ============================================================================
  // VIEW CHECK
  // ============================================================================

  describe('checkView', () => {
    it('should check test view syntax', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('check_view');
      if (!testCase) {
        return; // Skip silently if test case not configured
      }

      const { generateSessionId } = await import('../utils/sessionUtils');
      const sessionId = generateSessionId();
      const response = await viewCheck.checkView(
        connection,
        testCase.params.view_name,
        testCase.params.version || 'active',
        sessionId
      );
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
    });
  });

  // ============================================================================
  // FUNCTION GROUP CHECK
  // ============================================================================

  describe('checkFunctionGroup', () => {
    it('should check test function group syntax', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('check_function_group');
      if (!testCase) {
        return; // Skip silently if test case not configured
      }

      const { generateSessionId } = await import('../utils/sessionUtils');
      const sessionId = generateSessionId();
      const response = await functionGroupCheck.checkFunctionGroup(
        connection,
        testCase.params.function_group_name,
        testCase.params.version || 'active',
        undefined, // sourceCode - not provided, checks existing function group
        sessionId
      );
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
    });
  });

  // ============================================================================
  // FUNCTION MODULE CHECK
  // ============================================================================

  describe('checkFunctionModule', () => {
    it('should check test function module syntax', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('check_function_module');
      if (!testCase) {
        return; // Skip silently if test case not configured
      }

      const { generateSessionId } = await import('../utils/sessionUtils');
      const sessionId = generateSessionId();
      const response = await functionModuleCheck.checkFunctionModule(
        connection,
        testCase.params.function_group_name,
        testCase.params.function_module_name,
        testCase.params.version || 'active',
        sessionId
      );
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
    });
  });

  // ============================================================================
  // TABLE CHECK
  // ============================================================================

  describe('runCheckRun (table)', () => {
    it('should run table status check', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('check_table');
      if (!testCase) {
        return; // Skip silently if test case not configured
      }

      const { generateSessionId } = await import('../utils/sessionUtils');
      const sessionId = generateSessionId();
      const response = await tableCheck.runCheckRun(
        connection,
        'tableStatusCheck',
        testCase.params.table_name,
        sessionId
      );
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
    });

    it('should run abap check run for table', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('check_table');
      if (!testCase) {
        return; // Skip silently if test case not configured
      }

      const { generateSessionId } = await import('../utils/sessionUtils');
      const sessionId = generateSessionId();
      const response = await tableCheck.runCheckRun(
        connection,
        'abapCheckRun',
        testCase.params.table_name,
        sessionId
      );
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
    });
  });

  // ============================================================================
  // PACKAGE CHECK
  // ============================================================================

  describe('checkPackage', () => {
    it('should check test package', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('check_package');
      if (!testCase) {
        return; // Skip silently if test case not configured
      }

      await packageCheck.checkPackage(connection, testCase.params.package_name);
      // checkPackage doesn't return response, just throws on error
      expect(true).toBe(true);
    });
  });
});


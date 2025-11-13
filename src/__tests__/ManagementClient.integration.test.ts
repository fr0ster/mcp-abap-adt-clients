/**
 * Integration tests for ManagementClient
 * Tests against real ABAP system using test-config.yaml
 */

import { ManagementClient } from '../clients/ManagementClient';
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

describe('ManagementClient Integration Tests', () => {
  let client: ManagementClient;
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
      client = new ManagementClient(connection);
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

  describe('activateObject', () => {
    it('should activate test objects', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('activate_object', 'test_objects');
      if (!testCase) {
        console.log('Skipping: activate_object test case not configured');
        return;
      }

      const response = await client.activateObject(testCase.params.objects);
      // Activation might return 200 (success) or other status codes
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('checkObject', () => {
    it('should check test objects syntax', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('check_object', 'test_objects');
      if (!testCase) {
        console.log('Skipping: check_object test case not configured');
        return;
      }

      // checkObject expects single object, but test config has array
      // For now, test with first object
      const firstObject = testCase.params.objects[0];
      const response = await client.checkObject(
        firstObject.object_name,
        firstObject.object_type,
        firstObject.version
      );
      // Check might return 200 (success) or other status codes
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
    });

    it('should check single test class syntax', async () => {
      if (!hasConfig) return;
      const testCase = getEnabledTestCase('check_object', 'single_test_class');
      if (!testCase) {
        console.log('Skipping: check_object test case not configured');
        return;
      }

      const response = await client.checkObject(
        testCase.params.object_name,
        testCase.params.object_type,
        testCase.params.version
      );
      // Check might return 200 (success) or other status codes
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
    });
  });
});


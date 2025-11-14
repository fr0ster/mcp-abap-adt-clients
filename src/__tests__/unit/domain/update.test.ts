/**
 * Unit test for Domain update
 * Tests updateDomain function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/domain/update.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { updateDomain } from '../../../core/domain/update';
import { getDomain } from '../../../core/domain/read';
import { createDomain } from '../../../core/domain/create';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const { getEnabledTestCase } = require('../../../../tests/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: console.warn,
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};

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

describe('Domain - Update', () => {
  let connection: AbapConnection;
  let hasConfig = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      hasConfig = true;
    } catch (error) {
      logger.warn('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterAll(async () => {
    if (connection) {
      connection.reset();
    }
  });

  // Helper function to ensure domain exists before test (idempotency)
  async function ensureDomainExists(testCase: any) {
    try {
      await getDomain(connection, testCase.params.domain_name);
      logger.debug(`Domain ${testCase.params.domain_name} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Domain ${testCase.params.domain_name} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_domain', 'test_domain');
        if (createTestCase) {
          try {
            await createDomain(connection, {
              domain_name: testCase.params.domain_name,
              description: createTestCase.params.description || `Test domain for ${testCase.params.domain_name}`,
              package_name: createTestCase.params.package_name,
              transport_request: createTestCase.params.transport_request,
              datatype: createTestCase.params.datatype || 'CHAR',
              length: createTestCase.params.length || 10,
              decimals: createTestCase.params.decimals,
              lowercase: createTestCase.params.lowercase,
              sign_exists: createTestCase.params.sign_exists,
            });
            logger.debug(`Domain ${testCase.params.domain_name} created successfully`);
          } catch (createError: any) {
            throw createError;
          }
        } else {
          throw new Error(`Cannot create domain ${testCase.params.domain_name}: create_domain test case not found`);
        }
      } else {
        throw error;
      }
    }
  }

  it('should update domain', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('update_domain', 'test_domain');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    // Ensure domain exists before test (idempotency)
    await ensureDomainExists(testCase);

    await updateDomain(connection, {
      domain_name: testCase.params.domain_name,
      description: testCase.params.description,
      package_name: testCase.params.package_name,
      transport_request: testCase.params.transport_request,
      datatype: testCase.params.datatype,
      length: testCase.params.length,
      decimals: testCase.params.decimals,
      lowercase: testCase.params.lowercase,
      sign_exists: testCase.params.sign_exists,
    });

    // Verify update by reading
    const result = await getDomain(connection, testCase.params.domain_name);
    expect(result.status).toBe(200);
    if (testCase.params.description) {
      expect(result.data).toContain(testCase.params.description);
    }
  }, 60000);
});


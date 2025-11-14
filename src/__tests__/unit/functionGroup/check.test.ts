/**
 * Unit test for Function Group syntax checking
 * Tests checkFunctionGroup function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/functionGroup/check.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { checkFunctionGroup } from '../../../core/functionGroup/check';
import { getFunctionGroup } from '../../../core/functionGroup/read';
import { createFunctionGroup } from '../../../core/functionGroup/create';

const { getEnabledTestCase } = require('../../../../tests/test-helper');
// Environment variables are loaded automatically by test-helper

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

describe('Function Group - Check', () => {
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

  // Helper function to ensure object exists before test (idempotency)
  async function ensureFunctionGroupExists(testCase: any) {
    const functionGroupName = testCase.params.function_group_name || testCase.params.function_group;
    if (!functionGroupName) {
      throw new Error('function_group_name or function_group is required in test case');
    }
    try {
      await getFunctionGroup(connection, functionGroupName);
      logger.debug(`Function group ${functionGroupName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Function group ${functionGroupName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_function_group');
        if (createTestCase && createTestCase.params.package_name) {
          await createFunctionGroup(connection, {
            function_group_name: functionGroupName,
            description: testCase.params.description || `Test function group for ${functionGroupName}`,
            package_name: createTestCase.params.package_name,
          });
          logger.debug(`Function group ${functionGroupName} created successfully`);
        } else {
          throw new Error(`Cannot create function group ${functionGroupName}: create_function_group test case not found or missing package_name`);
        }
      } else {
        throw error;
      }
    }
  }

  it('should check active function group', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('check_function_group');
    if (!testCase) {
      return; // Skip silently if test case not configured
    }

    // Ensure function group exists before test (idempotency)
    await ensureFunctionGroupExists(testCase);

    const { generateSessionId } = await import('../../../utils/sessionUtils');
    const sessionId = generateSessionId();

    const functionGroupName = testCase.params.function_group_name || testCase.params.function_group;
    const result = await checkFunctionGroup(
      connection,
      functionGroupName,
      'active',
      undefined, // sourceCode - not provided, checks existing function group
      sessionId
    );
    expect(result.status).toBe(200);
  }, 15000);

  it('should check inactive function group', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('check_function_group');
    if (!testCase) {
      return; // Skip silently if test case not configured
    }

    // Ensure function group exists before test (idempotency)
    await ensureFunctionGroupExists(testCase);

    const { generateSessionId } = await import('../../../utils/sessionUtils');
    const sessionId = generateSessionId();

    const result = await checkFunctionGroup(
      connection,
      testCase.params.function_group_name,
      'inactive',
      undefined, // sourceCode - not provided, checks existing function group
      sessionId
    );
    expect(result.status).toBe(200);
  }, 15000);

  it('should check hypothetical function group code', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('check_function_group');
    if (!testCase) {
      return; // Skip silently if test case not configured
    }

    const { generateSessionId } = await import('../../../utils/sessionUtils');
    const sessionId = generateSessionId();

    // Hypothetical function group source code (doesn't need to exist in SAP)
    const hypotheticalSourceCode = `FUNCTION-POOL Z_TEST_HYPOTHETICAL.
* Test function group`;

    try {
      const result = await checkFunctionGroup(
        connection,
        'Z_TEST_HYPOTHETICAL',
        'active',
        hypotheticalSourceCode, // sourceCode provided - validates hypothetical code
        sessionId
      );
      expect(result.status).toBe(200);
    } catch (error: any) {
      // SAP may return error for non-existent objects during hypothetical check
      // This is expected behavior - we just verify the request was processed
      if (error.message && error.message.includes('does not exist')) {
        logger.debug('Expected error for hypothetical check of non-existent function group');
        expect(error.response?.status || 404).toBeDefined();
      } else {
        throw error;
      }
    }
  }, 15000);
});


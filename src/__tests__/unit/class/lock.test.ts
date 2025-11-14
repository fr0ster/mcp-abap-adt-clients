/**
 * Unit test for Class lock/unlock operations
 * Tests lockClass and unlockClass functions
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/class/lock.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { lockClass } from '../../../core/class/lock';
import { unlockClass } from '../../../core/class/unlock';
import { getClass } from '../../../core/class/read';
import { createClass } from '../../../core/class/create';

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

describe('Class - Lock/Unlock', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let lockHandle: string | null = null;

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
  async function ensureClassExists(testCase: any) {
    try {
      await getClass(connection, testCase.params.class_name);
      logger.debug(`Class ${testCase.params.class_name} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Class ${testCase.params.class_name} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_class');
        if (createTestCase) {
          await createClass(connection, {
            class_name: testCase.params.class_name,
            description: `Test class for ${testCase.params.class_name}`,
            package_name: createTestCase.params.package_name,
            source_code: createTestCase.params.source_code || undefined,
          });
          logger.debug(`Class ${testCase.params.class_name} created successfully`);
        } else {
          throw new Error(`Cannot create class ${testCase.params.class_name}: create_class test case not found`);
        }
      } else {
        throw error;
      }
    }
  }

  it('should lock and unlock class', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    // Use create_class to ensure we test with user-created Z-class, not SAP system class
    const testCase = getEnabledTestCase('create_class');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    // Ensure class exists before test (idempotency)
    await ensureClassExists(testCase);

    const sessionId = 'test-session-id';

    // Lock class (should work for user-created Z-classes)
    lockHandle = await lockClass(
      connection,
      testCase.params.class_name,
      sessionId
    );
    expect(lockHandle).toBeDefined();
    expect(lockHandle).not.toBe('');

    // Unlock class
    await unlockClass(
      connection,
      testCase.params.class_name,
      lockHandle,
      sessionId
    );
  }, 20000);
});

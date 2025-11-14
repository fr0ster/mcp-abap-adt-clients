/**
 * Unit test for Class creation
 * Tests createClass function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/class/create.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { createClass } from '../../../core/class/create';
import { getClass } from '../../../core/class/read';
import { deleteObject } from '../../../core/delete';

const { getEnabledTestCase, getAllEnabledTestCases } = require('../../../../tests/test-helper');
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

describe('Class - Create', () => {
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

  // Helper function to ensure object doesn't exist before create test
  // Returns true if class was deleted or doesn't exist, false if deletion failed
  async function ensureClassDoesNotExist(className: string): Promise<boolean> {
    try {
      await getClass(connection, className);
      // Class exists, try to delete it
      logger.debug(`Class ${className} exists, attempting to delete before test...`);
      try {
        await deleteObject(connection, {
          object_name: className,
          object_type: 'CLAS/OC',
        });
        logger.debug(`Class ${className} deleted successfully`);
        // Wait a bit for SAP to process deletion
        await new Promise(resolve => setTimeout(resolve, 1000));
        return true;
      } catch (deleteError: any) {
        // If deletion fails (e.g., object is locked), return false
        logger.debug(`Could not delete class ${className} before test: ${deleteError.message}`);
        return false;
      }
    } catch (error: any) {
      // Class doesn't exist (404) - that's fine, proceed with test
      if (error.response?.status === 404) {
        logger.debug(`Class ${className} does not exist, proceeding with test`);
        return true;
      } else {
        // Other errors - assume class doesn't exist
        logger.debug(`Warning checking class existence: ${error.message}`);
        return true;
      }
    }
  }

  it('should create basic class', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('create_class');
    if (!testCase) {
      return; // Skip silently if test case not configured
    }

    // Ensure class doesn't exist before test (idempotency)
    const canProceed = await ensureClassDoesNotExist(testCase.params.class_name);
    if (!canProceed) {
      // Class exists and couldn't be deleted - skip test
      return;
    }

    // Verify class doesn't exist before creating
    try {
      await getClass(connection, testCase.params.class_name);
      // Class still exists - skip test
      return;
    } catch (error: any) {
      // Class doesn't exist (404) - proceed with creation
      if (error.response?.status !== 404) {
        throw error;
      }
    }

    await createClass(connection, {
      class_name: testCase.params.class_name,
      description: testCase.params.description,
      package_name: testCase.params.package_name,
      source_code: testCase.params.source_code,
    });

    // Verify creation by reading
    const result = await getClass(connection, testCase.params.class_name);
    expect(result.status).toBe(200);
    expect(result.data).toContain(testCase.params.class_name);
  }, 30000);

  it('should create class with superclass', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    // Get second enabled test case if available, otherwise skip
    const allTestCases = getAllEnabledTestCases('create_class');
    if (allTestCases.length < 2) {
      logger.warn('⚠️ Skipping test: Second test case not available');
      return;
    }
    const testCase = allTestCases[1];

    // Ensure class doesn't exist before test (idempotency)
    const canProceed = await ensureClassDoesNotExist(testCase.params.class_name);
    if (!canProceed) {
      // Class exists and couldn't be deleted - skip test
      return;
    }

    // Verify class doesn't exist before creating
    try {
      await getClass(connection, testCase.params.class_name);
      // Class still exists - skip test
      return;
    } catch (error: any) {
      // Class doesn't exist (404) - proceed with creation
      if (error.response?.status !== 404) {
        throw error;
      }
    }

    await createClass(connection, {
      class_name: testCase.params.class_name,
      description: testCase.params.description,
      package_name: testCase.params.package_name,
      source_code: testCase.params.source_code,
      superclass: testCase.params.super_class_name,
    });

    // Verify creation by reading
    const result = await getClass(connection, testCase.params.class_name);
    expect(result.status).toBe(200);
    expect(result.data).toContain(testCase.params.class_name);
  }, 30000);
});

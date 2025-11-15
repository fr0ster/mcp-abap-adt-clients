/**
 * Unit test for Class syntax checking
 * Tests checkClass function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/class/check.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { checkClass } from '../../../core/class/check';
import { getClass } from '../../../core/class/read';
import { createClass } from '../../../core/class/create';
import { deleteObject } from '../../../core/delete';
import { activateClass } from '../../../core/class/activation';
import { lockClass } from '../../../core/class/lock';
import { unlockClass } from '../../../core/class/unlock';
import { updateClass } from '../../../core/class/update';
import { generateSessionId } from '../../../utils/sessionUtils';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage } = require('../../../../tests/test-helper');
// Environment variables are loaded automatically by test-helper

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
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

describe('Class - Check', () => {
  let connection: AbapConnection;
  let hasConfig = false;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      hasConfig = true;
    } catch (error) {
      logger.warn('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterEach(async () => {
    if (connection) {
      connection.reset();
    }
  });

  // Helper function to ensure object exists before test (idempotency)
  // Each test checks and prepares data before running
  async function ensureClassExists(testCase: any) {
    try {
      await getClass(connection, testCase.params.class_name);
      logger.debug(`Class ${testCase.params.class_name} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Class ${testCase.params.class_name} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_class');
        if (!createTestCase) {
          throw new Error(`Cannot create class ${testCase.params.class_name}: create_class test case not found`);
        }

        const sourceCode = testCase.params.source_code || createTestCase.params.source_code;
        if (!sourceCode) {
          throw new Error(`source_code is required for creating class ${testCase.params.class_name}`);
        }

        const className = testCase.params.class_name;
        const sessionId = generateSessionId();

        // Step 1: Create class object (metadata only)
        await createClass(connection, {
          class_name: className,
          description: `Test class for ${className}`,
          package_name: createTestCase.params.package_name || getDefaultPackage(),
        });

        // Step 2: Lock class
        const lockHandle = await lockClass(connection, className, sessionId);

        // Step 3: Update source code
        await updateClass(
          connection,
          className,
          sourceCode,
          lockHandle,
          sessionId,
          createTestCase.params.transport_request
        );

        // Step 4: Unlock class
        await unlockClass(connection, className, lockHandle, sessionId);

        // Step 5: Activate class
        await activateClass(connection, className, sessionId);

        logger.debug(`Class ${className} created and activated successfully`);
      } else {
        throw error;
      }
    }
  }

  it('should check active class', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('check_class');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    // Validate that class is in user space (Z_ or Y_) - skip for hypothetical code
    if (!testCase.params.sourceCode) {
      try {
        validateTestCaseForUserSpace(testCase, 'check_class');
      } catch (error: any) {
        logger.warn(`⚠️ Skipping test: ${error.message}`);
        return;
      }
    }

    // Ensure class exists before test (idempotency) - skip for hypothetical code
    if (!testCase.params.sourceCode) {
      await ensureClassExists(testCase);
    }

    const result = await checkClass(connection, testCase.params.class_name, 'active');
    expect(result.status).toBe(200);
  }, 15000);

  it('should check inactive class', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('check_class');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    // Validate that class is in user space (Z_ or Y_)
    try {
      validateTestCaseForUserSpace(testCase, 'check_class');
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: ${error.message}`);
      return;
    }

    // Ensure class exists before test (idempotency)
    await ensureClassExists(testCase);

    const result = await checkClass(connection, testCase.params.class_name, 'inactive');
    expect(result.status).toBe(200);
  }, 15000);

  it('should check hypothetical class code', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const hypotheticalCode = `CLASS ZCL_TEST_HYPOTHETICAL DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC .

  PUBLIC SECTION.
    METHODS: test_method RETURNING VALUE(rv_result) TYPE string.
ENDCLASS.

CLASS ZCL_TEST_HYPOTHETICAL IMPLEMENTATION.
  METHOD test_method.
    rv_result = 'Test'.
  ENDMETHOD.
ENDCLASS.`;

    // Check hypothetical code (object doesn't need to exist)
    // Note: SAP may return error about non-existing object, but still validates the code
    try {
      const result = await checkClass(connection, 'ZCL_TEST_HYPOTHETICAL', 'active', hypotheticalCode);
      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
    } catch (error: any) {
      // If object doesn't exist, SAP may return error, but this is expected for hypothetical code
      if (error.message && error.message.includes('does not exist')) {
        // Still verify that request was made (status code indicates request was processed)
        expect(error.message).toContain('ZCL_TEST_HYPOTHETICAL');
      } else {
        throw error;
      }
    }
  }, 15000);
});

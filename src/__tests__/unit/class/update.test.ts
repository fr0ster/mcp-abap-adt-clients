/**
 * Unit test for Class update
 * Tests updateClass function (low-level)
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/class/update.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { updateClass } from '../../../core/class/update';
import { getClass } from '../../../core/class/read';
import { createClass } from '../../../core/class/create';
import { lockClass } from '../../../core/class/lock';
import { unlockClass } from '../../../core/class/unlock';
import { activateClass } from '../../../core/class/activation';
import { generateSessionId } from '../../../utils/sessionUtils';

const { getEnabledTestCase } = require('../../../../tests/test-helper');
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

describe('Class - Update', () => {
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

        const sourceCode = createTestCase.params.source_code;
        if (!sourceCode) {
          throw new Error(`source_code is required for creating class ${testCase.params.class_name}`);
        }

        const className = testCase.params.class_name;
        const sessionId = generateSessionId();

        // Step 1: Create class object (metadata only)
        await createClass(connection, {
          class_name: className,
          description: testCase.params.description || `Test class for ${className}`,
          package_name: createTestCase.params.package_name,
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

  it('should update class source code', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('update_class');
    if (!testCase) {
      return; // Skip silently if test case not configured
    }

    // Ensure class exists before test (idempotency)
    await ensureClassExists(testCase);

    const updatedSourceCode = `CLASS ${testCase.params.class_name} DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC .

  PUBLIC SECTION.
    METHODS: get_updated_text RETURNING VALUE(rv_text) TYPE string.
ENDCLASS.

CLASS ${testCase.params.class_name} IMPLEMENTATION.
  METHOD get_updated_text.
    rv_text = 'Updated Text'.
  ENDMETHOD.
ENDCLASS.`;

    const className = testCase.params.class_name;
    const sessionId = generateSessionId();

    // Step 1: Lock class
    const lockHandle = await lockClass(connection, className, sessionId);

    // Step 2: Update source code
    await updateClass(
      connection,
      className,
      updatedSourceCode,
      lockHandle,
      sessionId,
      testCase.params.transport_request
    );

    // Step 3: Unlock class
    await unlockClass(connection, className, lockHandle, sessionId);

    // Step 4: Activate class
    await activateClass(connection, className, sessionId);

    // Verify update by reading inactive version
    const result = await getClass(connection, testCase.params.class_name, 'inactive');
    expect(result.status).toBe(200);
    expect(result.data).toContain('Updated Text');
  }, 30000);
});

/**
 * Unit test for Interface lock/unlock operations
 * Tests lockInterface and unlockInterface functions
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/interface/lock.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { lockInterface } from '../../../core/interface/lock';
import { unlockInterface } from '../../../core/interface/unlock';
import { getInterfaceMetadata } from '../../../core/interface/read';
import { createInterface } from '../../../core/interface/create';
import { activateInterface } from '../../../core/interface/activation';
import { updateInterfaceSource } from '../../../core/interface/update';
import { generateSessionId } from '../../../utils/sessionUtils';
import { getConfig } from '../../helpers/sessionConfig';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};

describe('Interface - Lock/Unlock', () => {
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
    lockHandle = null;
  });

  async function ensureInterfaceExists(testCase: any) {
    const interfaceName = testCase.params.interface_name;

    try {
      await getInterfaceMetadata(connection, interfaceName);
      logger.debug(`Interface ${interfaceName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Interface ${interfaceName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_interface');
        if (!createTestCase) {
          throw new Error(`Cannot create interface ${interfaceName}: create_interface test case not found`);
        }

        const sourceCode = createTestCase.params.source_code || `INTERFACE ${interfaceName}
  PUBLIC.

  METHODS: get_value
    RETURNING VALUE(rv_result) TYPE string.

ENDINTERFACE.`;

        const sessionId = generateSessionId();

        // Step 1: Create interface object (metadata only)
        await createInterface(connection, {
          interface_name: interfaceName,
          description: `Test interface for ${interfaceName}`,
          package_name: createTestCase.params.package_name || getDefaultPackage(),
          transport_request: createTestCase.params.transport_request || getDefaultTransport(),
          source_code: sourceCode
        });

        // Step 2: Lock interface
        const lockResult = await lockInterface(connection, interfaceName, sessionId);
        lockHandle = lockResult.lockHandle;

        // Step 3: Update source code
        await updateInterfaceSource(connection, {
          interface_name: interfaceName,
          source_code: sourceCode,
          activate: false
        });

        // Step 4: Unlock interface
        await unlockInterface(connection, interfaceName, lockHandle, sessionId);
        lockHandle = null;

        // Step 5: Activate interface
        await activateInterface(connection, interfaceName, sessionId);

        logger.debug(`Interface ${interfaceName} created and activated successfully`);
      } else {
        throw error;
      }
    }
  }

  it('should lock and unlock interface', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('create_interface');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    try {
      validateTestCaseForUserSpace(testCase, 'create_interface');
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: ${error.message}`);
      return;
    }

    await ensureInterfaceExists(testCase);

    const sessionId = generateSessionId();

    // Lock interface
    const lockResult = await lockInterface(
      connection,
      testCase.params.interface_name,
      sessionId
    );
    lockHandle = lockResult.lockHandle;
    expect(lockHandle).toBeDefined();
    expect(lockHandle).not.toBe('');

    // Unlock interface
    await unlockInterface(
      connection,
      testCase.params.interface_name,
      lockHandle,
      sessionId
    );
    lockHandle = null;
  }, 30000);
});


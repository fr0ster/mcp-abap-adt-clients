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
import { setupTestEnvironment, cleanupTestEnvironment, markAuthFailed, hasAuthFailed, getConfig } from '../../helpers/sessionConfig';
import { registerTestLock, unregisterTestLock } from '../../helpers/lockHelper';
import { createTestLogger } from '../../helpers/testLogger';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const logger = createTestLogger('Interface - Lock/Unlock');

const TEST_SUITE_NAME = 'Interface - Lock/Unlock';

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let lockHandle: string | null = null;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;
  let testCase: any = null;
  let interfaceName: string | null = null;

  beforeEach(async () => {
    lockHandle = null;
    testCase = null;
    interfaceName = null;

    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Lock/Unlock test', 'Authentication failed in previous test');
      return;
    }

    lockHandle = null;
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);

      const env = await setupTestEnvironment(connection, 'interface_lock', __filename);
      sessionId = env.sessionId;
      testConfig = env.testConfig;
      lockTracking = env.lockTracking;

      if (lockTracking?.enabled) {
        logger.debug(`✓ Lock tracking enabled: ${lockTracking.locksDir}`);
      }

      await (connection as any).connect();
      hasConfig = true;

      // Get and validate test case
      const tc = getEnabledTestCase('lock_interface', 'test_interface_lock');
      if (!tc) {
        logger.skip('Lock/Unlock test', 'Test case not enabled in test-config.yaml');
        testCase = null;
        interfaceName = null;
        return;
      }

      testCase = tc;
      interfaceName = tc.params.interface_name;
    } catch (error: any) {
      logger.error('❌ Authentication/Connection failed - marking all tests to skip');
      logger.error(`   Error: ${error.message}`);
      markAuthFailed(TEST_SUITE_NAME);
      hasConfig = false;
      testCase = null;
      interfaceName = null;
    }
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
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
        const createTestCase = getEnabledTestCase('create_interface', 'test_interface');
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
    if (!testCase || !interfaceName) {
      return; // Already logged in beforeEach
    }

    await ensureInterfaceExists(testCase);

    const testSessionId = sessionId || generateSessionId();

    // Lock interface
    const lockResult = await lockInterface(
      connection,
      interfaceName,
      testSessionId
    );
    lockHandle = lockResult.lockHandle;
    expect(lockHandle).toBeDefined();
    expect(lockHandle).not.toBe('');

    // Register lock in persistent storage
    if (lockTracking?.enabled) {
      registerTestLock(
        'interface',
        interfaceName,
        testSessionId,
        lockHandle,
        undefined,
        __filename
      );
      logger.debug(`✓ Lock registered in ${lockTracking.locksDir}`);
    }

    // Unlock interface
    try {
      await unlockInterface(
        connection,
        interfaceName,
        lockHandle,
        testSessionId
      );
      lockHandle = null;

      // Unregister lock from persistent storage
      if (lockTracking?.enabled) {
        unregisterTestLock('interface', testCase.params.interface_name);
        logger.debug(`✓ Lock unregistered from ${lockTracking.locksDir}`);
      }
    } catch (error) {
      logger.error(`Failed to unlock interface: ${error}`);
      throw error;
    }
  }, getTimeout('test'));
});


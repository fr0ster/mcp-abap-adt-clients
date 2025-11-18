/**
 * Integration test for Interface unlock
 * Tests unlockInterface function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/interface/unlock.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { unlockInterface } from '../../../core/interface/unlock';
import { lockInterface } from '../../../core/interface/lock';
import { getInterfaceMetadata } from '../../../core/interface/read';
import { createInterface } from '../../../core/interface/create';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Interface - Unlock';
const logger = createTestLogger('INTF-UNLOCK');

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;

  // Suite-level test case data
  let testCase: any = null;
  let interfaceName: string | null = null;

  beforeAll(async () => {
    const config = getConfig();
    connection = createAbapConnection(config, logger);
    await (connection as any).connect();
  });

  afterAll(async () => {
    if (connection) {
      connection.reset();
    }
  });

  beforeEach(async () => {
    // Reset suite variables
    testCase = null;
    interfaceName = null;

    // Check for auth failures first
    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Test', 'Authentication failed in previous test');
      return;
    }

    // Setup test environment
    const env = await setupTestEnvironment(connection, 'interface_unlock', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    // Get test case
    const tc = getEnabledTestCase('unlock_interface');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    testCase = tc;
    interfaceName = tc.params.interface_name;
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

  /**
   * Ensure interface exists before test
   */
  async function ensureInterfaceExists(testCase: any): Promise<void> {
    const intfName = testCase.params.interface_name;

    try {
      await getInterfaceMetadata(connection, intfName);
      logger.debug(`Interface ${intfName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Interface ${intfName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_interface', 'test_interface');
        if (!createTestCase) {
          throw new Error(`Cannot create interface ${intfName}: create_interface test case not found`);
        }

        await createInterface(connection, {
          interface_name: intfName,
          description: createTestCase.params.description || `Test interface for ${intfName}`,
          package_name: createTestCase.params.package_name || getDefaultPackage(),
          transport_request: createTestCase.params.transport_request || getDefaultTransport(),
          source_code: createTestCase.params.source_code
        });
        logger.debug(`Interface ${intfName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  it('should unlock interface', async () => {
    // Skip if no test case configured
    if (!testCase || !interfaceName) {
      logger.skip('Unlock Test', testCase ? 'Interface name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing unlock for interface: ${interfaceName}`);

    try {
      // Ensure interface exists
      await ensureInterfaceExists(testCase);

      // Lock interface first
      const lockResult = await lockInterface(connection, interfaceName, sessionId || '');
      const lockHandle = lockResult.lockHandle;
      expect(lockHandle).toBeDefined();
      logger.debug(`✓ Acquired lock handle: ${lockHandle}`);

      // Unlock interface
      const result = await unlockInterface(connection, interfaceName, lockHandle, sessionId || '');
      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
      logger.info(`✓ Interface ${interfaceName} unlocked successfully`);

    } catch (error: any) {
      logger.error(`✗ Failed to unlock interface: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});

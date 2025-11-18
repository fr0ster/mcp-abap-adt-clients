/**
 * Integration test for Interface syntax check
 * Tests checkInterface function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/interface/check.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { checkInterface } from '../../../core/interface/check';
import { getInterfaceMetadata } from '../../../core/interface/read';
import { createInterface } from '../../../core/interface/create';
import { generateSessionId } from '../../../utils/sessionUtils';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Interface - Check';
const logger = createTestLogger('INTERFACE-CHECK');

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;
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
    testCase = null;
    interfaceName = null;

    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Test', 'Authentication failed in previous test');
      return;
    }

    const env = await setupTestEnvironment(connection, 'interface_check', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('check_interface');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    try {
      validateTestCaseForUserSpace(tc, 'check_interface');
    } catch (error: any) {
      logger.skip('Test', error.message);
      return;
    }

    testCase = tc;
    interfaceName = tc.params.interface_name;
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

  async function ensureInterfaceExists(testCase: any): Promise<void> {
    const iName = testCase.params.interface_name;

    try {
      await getInterfaceMetadata(connection, iName);
      logger.debug(`Interface ${iName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Interface ${iName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_interface', 'test_interface');
        if (!createTestCase) {
          throw new Error(`Cannot create interface ${iName}: create_interface test case not found`);
        }

        await createInterface(connection, {
          interface_name: iName,
          description: createTestCase.params.description || `Test interface for ${iName}`,
          package_name: createTestCase.params.package_name || getDefaultPackage(),
          transport_request: createTestCase.params.transport_request || getDefaultTransport(),
          source_code: createTestCase.params.source_code
        });
        logger.debug(`Interface ${iName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  it('should check interface syntax (active version)', async () => {
    if (!testCase || !interfaceName) {
      logger.skip('Check Test', testCase ? 'Interface name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing syntax check for interface (active): ${interfaceName}`);

    try {
      await ensureInterfaceExists(testCase);

      const checkSessionId = generateSessionId();
      const result = await checkInterface(connection, interfaceName, 'active', checkSessionId);
      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
      logger.info(`✓ Interface ${interfaceName} syntax check (active) completed`);

    } catch (error: any) {
      logger.error(`✗ Failed to check interface syntax: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));

  it('should check interface syntax (inactive version)', async () => {
    if (!testCase || !interfaceName) {
      logger.skip('Check Test', testCase ? 'Interface name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing syntax check for interface (inactive): ${interfaceName}`);

    try {
      await ensureInterfaceExists(testCase);

      const checkSessionId = generateSessionId();
      const result = await checkInterface(connection, interfaceName, 'inactive', checkSessionId);
      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
      logger.info(`✓ Interface ${interfaceName} syntax check (inactive) completed`);

    } catch (error: any) {
      logger.error(`✗ Failed to check interface syntax: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});

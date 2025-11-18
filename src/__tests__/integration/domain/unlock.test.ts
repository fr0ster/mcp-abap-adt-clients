/**
 * Integration test for Domain unlock
 * Tests unlockDomain function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/domain/unlock.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { lockDomain } from '../../../core/domain/lock';
import { unlockDomain } from '../../../core/domain/unlock';
import { getDomain } from '../../../core/domain/read';
import { createDomain } from '../../../core/domain/create';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Domain - Unlock';
const logger = createTestLogger('DOMA-UNLOCK');

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;

  // Suite-level test case data
  let testCase: any = null;
  let domainName: string | null = null;

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
    domainName = null;

    // Check for auth failures first
    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Test', 'Authentication failed in previous test');
      return;
    }

    // Setup test environment
    const env = await setupTestEnvironment(connection, 'domain_unlock', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    // Get test case
    const tc = getEnabledTestCase('unlock_domain', 'test_domain');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    testCase = tc;
    domainName = tc.params.domain_name;
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

  /**
   * Ensure domain exists before test
   */
  async function ensureDomainExists(testCase: any): Promise<void> {
    const dname = testCase.params.domain_name;

    try {
      await getDomain(connection, dname);
      logger.debug(`Domain ${dname} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Domain ${dname} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_domain', 'test_domain');
        if (!createTestCase) {
          throw new Error(`Cannot create domain ${dname}: create_domain test case not found`);
        }

        await createDomain(connection, {
          domain_name: dname,
          description: createTestCase.params.description || `Test domain for ${dname}`,
          package_name: createTestCase.params.package_name || getDefaultPackage(),
          transport_request: createTestCase.params.transport_request || getDefaultTransport(),
          datatype: createTestCase.params.datatype || 'CHAR',
          length: createTestCase.params.length || 10,
          decimals: createTestCase.params.decimals,
          lowercase: createTestCase.params.lowercase,
          sign_exists: createTestCase.params.sign_exists,
        });
        logger.debug(`Domain ${dname} created successfully`);
      } else {
        throw error;
      }
    }
  }

  it('should unlock domain', async () => {
    // Skip if no test case configured
    if (!testCase || !domainName) {
      logger.skip('Unlock Test', testCase ? 'Domain name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing unlock for domain: ${domainName}`);

    try {
      // Ensure domain exists
      await ensureDomainExists(testCase);

      // Lock domain first
      const lockHandle = await lockDomain(connection, domainName, sessionId || '');
      expect(lockHandle).toBeDefined();
      logger.debug(`✓ Acquired lock handle: ${lockHandle}`);

      // Unlock domain
      const response = await unlockDomain(connection, domainName, lockHandle, sessionId || '');
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
      logger.info(`✓ Domain ${domainName} unlocked successfully`);

    } catch (error: any) {
      logger.error(`✗ Failed to unlock domain: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});

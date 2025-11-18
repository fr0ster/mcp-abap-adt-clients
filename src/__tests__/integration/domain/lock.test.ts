/**
 * Unit test for Domain locking
 * Tests acquireLockHandle and acquireLockHandleForUpdate functions
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/domain/lock.test
 *
 * IDEMPOTENCY PRINCIPLE:
 * Tests are designed to be idempotent - they can be run multiple times without manual cleanup.
 * - CREATE tests: Before creating an object, check if it exists and DELETE it if found.
 *   This ensures the test always starts from a clean state (object doesn't exist).
 * - Other tests (READ, UPDATE, DELETE, CHECK, ACTIVATE, LOCK, UNLOCK): Before testing,
 *   check if the object exists and CREATE it if missing. This ensures the test has
 *   the required object available.
 *
 * All tests use only user-defined objects (Z_ or Y_ prefix) for modification operations.
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { lockDomain } from '../../../core/domain/lock';
import { unlockDomain } from '../../../core/domain/unlock';
import { getDomain } from '../../../core/domain/read';
import { createDomain } from '../../../core/domain/create';
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

const logger = createTestLogger('Domain - Lock/Unlock');

const TEST_SUITE_NAME = 'Domain - Lock';

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let lockHandle: string | null = null;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;
  let testCase: any = null;
  let domainName: string | null = null;

  beforeEach(async () => {
    lockHandle = null;
    testCase = null;
    domainName = null;

    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Lock/Unlock test', 'Authentication failed in previous test');
      return;
    }

    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);

      // Setup session and lock tracking based on test-config.yaml
      const env = await setupTestEnvironment(connection, 'domain_lock', __filename);
      sessionId = env.sessionId;
      testConfig = env.testConfig;
      lockTracking = env.lockTracking;

      if (sessionId) {
        logger.debug(`✓ Session persistence enabled: ${sessionId}`);
      }

      if (lockTracking?.enabled) {
        logger.debug(`✓ Lock tracking enabled: ${lockTracking.locksDir}`);
      }

      // Connect to SAP system (triggers auth & auto-refresh)
      await (connection as any).connect();

      hasConfig = true;

      // Get and validate test case
      const tc = getEnabledTestCase('lock_domain', 'test_domain_lock');
      if (!tc) {
        logger.skip('Lock/Unlock test', 'Test case not enabled in test-config.yaml');
        testCase = null;
        domainName = null;
        return;
      }

      testCase = tc;
      domainName = tc.params.domain_name;
    } catch (error: any) {
      logger.error('❌ Authentication/Connection failed - marking all tests to skip');
      logger.error(`   Error: ${error.message}`);
      markAuthFailed(TEST_SUITE_NAME);
      hasConfig = false;
      testCase = null;
      domainName = null;
    }
  });

  afterAll(async () => {
    if (connection) {
      await cleanupTestEnvironment(connection, sessionId, testConfig);
      connection.reset();
    }
  });

  // Helper function to ensure domain exists before test (idempotency)
  async function ensureDomainExists(testCase: any) {
    const domainName = testCase.params.domain_name;

    try {
      await getDomain(connection, domainName);
      logger.debug(`Domain ${domainName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Domain ${domainName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_domain', 'test_domain');
        if (createTestCase) {
          try {
            await createDomain(connection, {
              domain_name: domainName,
              description: createTestCase.params.description || `Test domain for ${domainName}`,
              package_name: createTestCase.params.package_name || getDefaultPackage(),
              transport_request: createTestCase.params.transport_request || getDefaultTransport(),
              datatype: createTestCase.params.datatype || 'CHAR',
              length: createTestCase.params.length || 10,
              decimals: createTestCase.params.decimals,
              lowercase: createTestCase.params.lowercase,
              sign_exists: createTestCase.params.sign_exists,
            });
            logger.debug(`Domain ${domainName} created successfully`);
          } catch (createError: any) {
            throw createError;
          }
        } else {
          throw new Error(`Cannot create domain ${domainName}: create_domain test case not found`);
        }
      } else {
        throw error;
      }
    }
  }

  it('should lock domain and get lock handle', async () => {
    if (!testCase || !domainName) {
      return; // Already logged in beforeEach
    }

    // Ensure domain exists before test (idempotency)
    await ensureDomainExists(testCase);

    const testSessionId = sessionId || generateSessionId();
    const lockHandle = await lockDomain(
      connection,
      domainName,
      testSessionId
    );

    expect(lockHandle).toBeDefined();
    expect(typeof lockHandle).toBe('string');
    expect(lockHandle.length).toBeGreaterThan(0);

    // Register lock in persistent storage
    if (lockTracking?.enabled) {
      registerTestLock(
        'domain',
        domainName,
        testSessionId,
        lockHandle,
        undefined,
        __filename
      );
      logger.debug(`✓ Lock registered in ${lockTracking.locksDir}`);
    }

    // Unlock after test
    try {
      await unlockDomain(connection, testCase.params.domain_name, lockHandle, testSessionId);

      // Unregister lock from persistent storage
      if (lockTracking?.enabled) {
        unregisterTestLock('domain', domainName);
        logger.debug(`✓ Lock unregistered from ${lockTracking.locksDir}`);
      }
    } catch (error) {
      logger.error(`Failed to unlock domain: ${error}`);
      throw error;
    }
  }, getTimeout('test'));
});

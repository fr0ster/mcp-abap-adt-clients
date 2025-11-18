/**
 * Integration test for Domain update
 * Tests updateDomain function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/domain/update.test
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

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { updateDomain } from '../../../core/domain/update';
import { getDomain } from '../../../core/domain/read';
import { createDomain } from '../../../core/domain/create';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Domain - Update';
const logger = createTestLogger('DOM-UPDATE');

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
    const env = await setupTestEnvironment(connection, 'domain_update', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    // Get test case
    const tc = getEnabledTestCase('update_domain', 'test_domain');
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
    const dName = testCase.params.domain_name;

    try {
      await getDomain(connection, dName);
      logger.debug(`Domain ${dName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Domain ${dName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_domain', 'test_domain');
        if (!createTestCase) {
          throw new Error(`Cannot create domain ${dName}: create_domain test case not found`);
        }

        await createDomain(connection, {
          domain_name: dName,
          description: createTestCase.params.description || `Test domain for ${dName}`,
          package_name: createTestCase.params.package_name || getDefaultPackage(),
          transport_request: createTestCase.params.transport_request || getDefaultTransport(),
          datatype: createTestCase.params.datatype || 'CHAR',
          length: createTestCase.params.length || 10,
          decimals: createTestCase.params.decimals,
          lowercase: createTestCase.params.lowercase,
          sign_exists: createTestCase.params.sign_exists,
        });
        logger.debug(`Domain ${dName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  it('should update domain', async () => {
    // Skip if no test case configured
    if (!testCase || !domainName) {
      logger.skip('Update Test', testCase ? 'Domain name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing update for domain: ${domainName}`);

    try {
      // Ensure domain exists
      await ensureDomainExists(testCase);

      // Update domain
      await updateDomain(connection, {
        domain_name: domainName,
        description: testCase.params.description,
        package_name: testCase.params.package_name || getDefaultPackage(),
        transport_request: testCase.params.transport_request || getDefaultTransport(),
        datatype: testCase.params.datatype,
        length: testCase.params.length,
        decimals: testCase.params.decimals,
        lowercase: testCase.params.lowercase,
        sign_exists: testCase.params.sign_exists,
      });
      logger.debug(`✓ Domain ${domainName} updated`);

      // Verify update by reading
      const result = await getDomain(connection, domainName);
      expect(result.status).toBe(200);
      if (testCase.params.description) {
        expect(result.data).toContain(testCase.params.description);
      }
      logger.info(`✓ Domain ${domainName} updated successfully`);

    } catch (error: any) {
      logger.error(`✗ Failed to update domain: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});

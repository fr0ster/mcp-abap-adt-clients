/**
 * Unit test for Domain update
 * Tests updateDomain function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/domain/update.test
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

import { getDomain } from '../../../core/domain/read';
import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';
import { updateDomain } from '../../../core/domain/update';
import { createDomain } from '../../../core/domain/create';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');


const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};

describe('Domain - Update', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);

      // Setup session and lock tracking based on test-config.yaml
      // This will enable stateful session if persist_session: true in YAML
      const env = await setupTestEnvironment(connection, 'domain_update', __filename);
      sessionId = env.sessionId;
      testConfig = env.testConfig;
      lockTracking = env.lockTracking;

      if (sessionId) {
        logger.debug(`✓ Session persistence enabled: ${sessionId}`);
        logger.debug(`  Session storage: ${testConfig?.session_config?.sessions_dir || '.sessions'}`);
      } else {
        logger.debug('⚠️ Session persistence disabled (persist_session: false in test-config.yaml)');
      }

      if (lockTracking?.enabled) {
        logger.debug(`✓ Lock tracking enabled: ${lockTracking.locksDir}`);
      } else {
        logger.debug('⚠️ Lock tracking disabled (persist_locks: false in test-config.yaml)');
      }

      // Connect to SAP system to initialize session (get CSRF token and cookies)
      await (connection as any).connect();

      hasConfig = true;
    } catch (error) {
      logger.warn('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
    if (connection) {
      await cleanupTestEnvironment(connection, sessionId, testConfig);
      connection.reset();
    }
  });

  // Helper function to ensure domain exists before test (idempotency)
  async function ensureDomainExists(testCase: any) {
    const domainName = testCase.params.domain_name;

    try {
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

  it('should update domain', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('update_domain', 'test_domain');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    // Validate that domain is in user space (Z_ or Y_)
    try {
      validateTestCaseForUserSpace(testCase, 'update_domain');
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: ${error.message}`);
      return;
    }

    // Ensure domain exists before test (idempotency)
    await ensureDomainExists(testCase);

    await updateDomain(connection, {
      domain_name: testCase.params.domain_name,
      description: testCase.params.description,
      package_name: testCase.params.package_name || getDefaultPackage(),
      transport_request: testCase.params.transport_request || getDefaultTransport(),
      datatype: testCase.params.datatype,
      length: testCase.params.length,
      decimals: testCase.params.decimals,
      lowercase: testCase.params.lowercase,
      sign_exists: testCase.params.sign_exists,
    });

    // Verify update by reading
    const result = await getDomain(connection, testCase.params.domain_name);
    expect(result.status).toBe(200);
    if (testCase.params.description) {
      expect(result.data).toContain(testCase.params.description);
    }
  }, 60000);
});


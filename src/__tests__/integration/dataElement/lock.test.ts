/**
 * Unit test for Data Element locking
 * Tests acquireLockHandleForUpdate function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/dataElement/lock.test
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
import { lockDataElement } from '../../../core/dataElement/lock';
import { unlockDataElement } from '../../../core/dataElement/unlock';
import { getDataElement } from '../../../core/dataElement/read';
import { createDataElement } from '../../../core/dataElement/create';
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

const logger = createTestLogger('DataElement - Lock/Unlock');

const TEST_SUITE_NAME = 'Data Element - Lock';

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let lockHandle: string | null = null;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;
  let testCase: any = null;
  let dataElementName: string | null = null;

  beforeEach(async () => {
    lockHandle = null;
    testCase = null;
    dataElementName = null;

    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Lock/Unlock test', 'Authentication failed in previous test');
      return;
    }

    lockHandle = null;
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);

      const env = await setupTestEnvironment(connection, 'dataElement_lock', __filename);
      sessionId = env.sessionId;
      testConfig = env.testConfig;
      lockTracking = env.lockTracking;

      if (lockTracking?.enabled) {
        logger.debug(`✓ Lock tracking enabled: ${lockTracking.locksDir}`);
      }

      // Connect to SAP system (triggers auth & auto-refresh)
      await (connection as any).connect();

      hasConfig = true;

      // Get and validate test case
      const tc = getEnabledTestCase('lock_dataElement', 'test_dataElement_lock');
      if (!tc) {
        logger.skip('Lock/Unlock test', 'Test case not enabled in test-config.yaml');
        testCase = null;
        dataElementName = null;
        return;
      }

      testCase = tc;
      dataElementName = tc.params.data_element_name;
    } catch (error: any) {
      logger.error('❌ Authentication/Connection failed - marking all tests to skip');
      logger.error(`   Error: ${error.message}`);
      markAuthFailed(TEST_SUITE_NAME);
      hasConfig = false;
      testCase = null;
      dataElementName = null;
    }
  });

  afterEach(async () => {
    if (connection && lockHandle) {
      try {
        const sessionIdForUnlock = generateSessionId();
        await unlockDataElement(connection, 'Z_TEST_DTEL_01', lockHandle, sessionIdForUnlock);
      } catch (error) {
        // Ignore unlock errors in cleanup
      }
    }
    if (connection) {
      await cleanupTestEnvironment(connection, sessionId, testConfig);
      connection.reset();
    }
    lockHandle = null;
  });

  // Helper function to ensure domain exists (data elements require a domain)
  async function ensureDomainExists(domainName: string): Promise<void> {
    try {
      await getDomain(connection, domainName);
      logger.debug(`Domain ${domainName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Domain ${domainName} does not exist, creating...`);
        const createDomainTestCase = getEnabledTestCase('create_domain', 'test_domain');
        if (createDomainTestCase) {
          await createDomain(connection, {
            domain_name: domainName,
            description: `Test domain for ${domainName}`,
            package_name: createDomainTestCase.params.package_name || getDefaultPackage(),
            transport_request: createDomainTestCase.params.transport_request || getDefaultTransport(),
            datatype: createDomainTestCase.params.datatype || 'CHAR',
            length: createDomainTestCase.params.length || 10,
            decimals: createDomainTestCase.params.decimals,
            lowercase: createDomainTestCase.params.lowercase,
            sign_exists: createDomainTestCase.params.sign_exists,
          });
          logger.debug(`Domain ${domainName} created successfully`);
        } else {
          throw new Error(`Cannot create domain ${domainName}: create_domain test case not found`);
        }
      } else {
        throw error;
      }
    }
  }

  // Helper function to ensure data element exists before test (idempotency)
  async function ensureDataElementExists(testCase: any) {
    const dataElementName = testCase.params.data_element_name;

    try {
      await getDataElement(connection, dataElementName);
      logger.debug(`Data element ${dataElementName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Data element ${dataElementName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_data_element', 'test_data_element');
        if (createTestCase) {
          try {
            // Ensure domain exists first
            await ensureDomainExists(createTestCase.params.domain_name);

            await createDataElement(connection, {
              data_element_name: dataElementName,
              description: createTestCase.params.description || `Test data element for ${dataElementName}`,
              package_name: createTestCase.params.package_name || getDefaultPackage(),
              transport_request: createTestCase.params.transport_request || getDefaultTransport(),
              domain_name: createTestCase.params.domain_name,
              short_label: createTestCase.params.short_label,
              medium_label: createTestCase.params.medium_label,
              long_label: createTestCase.params.long_label,
              heading_label: createTestCase.params.heading_label,
            });
            logger.debug(`Data element ${dataElementName} created successfully`);
          } catch (createError: any) {
            throw createError;
          }
        } else {
          throw new Error(`Cannot create data element ${dataElementName}: create_data_element test case not found`);
        }
      } else {
        throw error;
      }
    }
  }

  it('should lock data element and get lock handle', async () => {
    if (!testCase || !dataElementName) {
      return; // Already logged in beforeEach
    }

    // Ensure data element exists before test (idempotency)
    await ensureDataElementExists(testCase);

    const testSessionId = sessionId || generateSessionId();
    lockHandle = await lockDataElement(
      connection,
      dataElementName,
      testSessionId
    );

    expect(lockHandle).toBeDefined();
    expect(lockHandle).not.toBe('');

    // Register lock in persistent storage
    if (lockTracking?.enabled) {
      registerTestLock(
        'dataElement',
        dataElementName,
        testSessionId,
        lockHandle,
        undefined,
        __filename
      );
      logger.debug(`✓ Lock registered in ${lockTracking.locksDir}`);
    }

    // Unlock after test
    try {
      await unlockDataElement(
        connection,
        dataElementName,
        lockHandle,
        testSessionId
      );
      lockHandle = null;

      // Unregister lock from persistent storage
      if (lockTracking?.enabled) {
        unregisterTestLock('dataElement', dataElementName);
        logger.debug(`✓ Lock unregistered from ${lockTracking.locksDir}`);
      }
    } catch (error) {
      logger.error(`Failed to unlock data element: ${error}`);
      throw error;
    }
  }, getTimeout('test'));
});


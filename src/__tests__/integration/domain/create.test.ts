/**
 * Integration test for Domain creation
 * Tests createDomain function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/domain/create.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { createDomain } from '../../../core/domain/create';
import { getDomain } from '../../../core/domain/read';
import { deleteObject } from '../../../core/delete';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Domain - Create';
const logger = createTestLogger('DOM-CREATE');

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;
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
    testCase = null;
    domainName = null;

    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Test', 'Authentication failed in previous test');
      return;
    }

    const env = await setupTestEnvironment(connection, 'domain_create', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('create_domain', 'test_domain');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    try {
      validateTestCaseForUserSpace(tc, 'create_domain');
    } catch (error: any) {
      logger.skip('Test', error.message);
      return;
    }

    testCase = tc;
    domainName = tc.params.domain_name;

    // Delete if exists (idempotency)
    if (domainName) {
      await deleteIfExists(domainName);
    }
  });

  afterEach(async () => {
    // Cleanup created domain
    if (domainName) {
      await deleteIgnoringErrors(domainName);
    }
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

  async function deleteIfExists(name: string): Promise<void> {
    try {
      await getDomain(connection, name);
      logger.debug(`Domain ${name} exists, deleting...`);
      const deleteResult = await deleteObject(connection, {
        object_name: name,
        object_type: 'DOMA/DD'
      });

      // Check if deletion was successful
      if (deleteResult.status < 200 || deleteResult.status >= 300) {
        logger.skip('Test', `Failed to delete existing domain ${name} (status: ${deleteResult.status}). Cannot proceed with test.`);
        testCase = null; // Skip test
        return;
      }

      const delay = 2000;
      await new Promise(resolve => setTimeout(resolve, delay));
      logger.debug(`Domain ${name} deleted (status: ${deleteResult.status})`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Domain ${name} does not exist (OK)`);
      } else {
        logger.skip('Test', `Failed to check/delete domain ${name}: ${error.message}`);
        testCase = null; // Skip test
      }
    }
  }

  async function deleteIgnoringErrors(name: string): Promise<void> {
    try {
      await deleteObject(connection, {
        object_name: name,
        object_type: 'DOMA/DD'
      });
      logger.debug(`Cleanup: deleted domain ${name}`);
    } catch (error: any) {
      logger.debug(`Cleanup: could not delete domain ${name} (${error.message})`);
    }
  }

  it('should create basic domain', async () => {
    // Set test timeout from config
    jest.setTimeout(60000);

    if (!testCase || !domainName) {
      logger.skip('Create Test', testCase ? 'Domain name not set' : 'Test case not configured');
      return;
    }

    logger.debug(`Testing create for domain: ${domainName}`);

    try {
      const result = await createDomain(connection, {
        domain_name: testCase.params.domain_name,
        description: testCase.params.description,
        package_name: testCase.params.package_name || getDefaultPackage(),
        transport_request: testCase.params.transport_request || getDefaultTransport(),
        datatype: testCase.params.datatype || 'CHAR',
        length: testCase.params.length || 10,
        decimals: testCase.params.decimals || 0,
        lowercase: testCase.params.lowercase || false,
        sign_exists: testCase.params.sign_exists || false
      });

      expect([200, 201]).toContain(result.status);
      logger.debug(`✓ Domain ${domainName} created successfully (status: ${result.status})`);

      // Wait for SAP to register the object
      const delay = 1000;
      await new Promise(resolve => setTimeout(resolve, delay));

      // Verify domain exists
      const getResult = await getDomain(connection, domainName);
      expect(getResult.status).toBe(200);
      logger.debug(`✓ Domain ${domainName} verified to exist`);

    } catch (error: any) {
      logger.error(`✗ Failed to create domain: ${error.message}`);
      throw error;
    }
  });
});

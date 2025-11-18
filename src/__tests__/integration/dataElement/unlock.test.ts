/**
 * Integration test for Data Element unlock
 * Tests unlockDataElement function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/dataElement/unlock.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { lockDataElement } from '../../../core/dataElement/lock';
import { unlockDataElement } from '../../../core/dataElement/unlock';
import { getDataElement } from '../../../core/dataElement/read';
import { createDataElement } from '../../../core/dataElement/create';
import { getDomain } from '../../../core/domain/read';
import { createDomain } from '../../../core/domain/create';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'DataElement - Unlock';
const logger = createTestLogger('DTEL-UNLOCK');

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;

  // Suite-level test case data
  let testCase: any = null;
  let dataElementName: string | null = null;

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
    dataElementName = null;

    // Check for auth failures first
    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Test', 'Authentication failed in previous test');
      return;
    }

    // Setup test environment
    const env = await setupTestEnvironment(connection, 'dataElement_unlock', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    // Get test case
    const tc = getEnabledTestCase('unlock_data_element', 'test_data_element');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    testCase = tc;
    dataElementName = tc.params.data_element_name;
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

  /**
   * Ensure domain exists (data elements require a domain)
   */
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

  /**
   * Ensure data element exists before test
   */
  async function ensureDataElementExists(testCase: any): Promise<void> {
    const dtelName = testCase.params.data_element_name;

    try {
      await getDataElement(connection, dtelName);
      logger.debug(`Data element ${dtelName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Data element ${dtelName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_data_element', 'test_data_element');
        if (!createTestCase) {
          throw new Error(`Cannot create data element ${dtelName}: create_data_element test case not found`);
        }

        // Ensure domain exists first
        await ensureDomainExists(createTestCase.params.domain_name);

        await createDataElement(connection, {
          data_element_name: dtelName,
          description: createTestCase.params.description || `Test data element for ${dtelName}`,
          package_name: createTestCase.params.package_name || getDefaultPackage(),
          transport_request: createTestCase.params.transport_request || getDefaultTransport(),
          domain_name: createTestCase.params.domain_name,
          short_label: createTestCase.params.short_label,
          medium_label: createTestCase.params.medium_label,
          long_label: createTestCase.params.long_label,
          heading_label: createTestCase.params.heading_label,
        });
        logger.debug(`Data element ${dtelName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  it('should unlock data element', async () => {
    // Skip if no test case configured
    if (!testCase || !dataElementName) {
      logger.skip('Unlock Test', testCase ? 'Data element name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing unlock for data element: ${dataElementName}`);

    try {
      // Ensure data element exists
      await ensureDataElementExists(testCase);

      // Lock data element first
      const lockHandle = await lockDataElement(connection, dataElementName, sessionId || '');
      expect(lockHandle).toBeDefined();
      expect(lockHandle).not.toBe('');
      logger.debug(`✓ Acquired lock handle: ${lockHandle}`);

      // Unlock data element
      await unlockDataElement(connection, dataElementName, lockHandle, sessionId || '');
      logger.info(`✓ Data element ${dataElementName} unlocked successfully`);

    } catch (error: any) {
      logger.error(`✗ Failed to unlock data element: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});

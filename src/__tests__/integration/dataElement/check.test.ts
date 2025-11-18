/**
 * Integration test for Data Element syntax check
 * Tests checkDataElement function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/dataElement/check.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { checkDataElement } from '../../../core/dataElement/check';
import { getDataElement } from '../../../core/dataElement/read';
import { createDataElement } from '../../../core/dataElement/create';
import { getDomain } from '../../../core/domain/read';
import { createDomain } from '../../../core/domain/create';
import { generateSessionId } from '../../../utils/sessionUtils';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Data Element - Check';
const logger = createTestLogger('DTEL-CHECK');

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;
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
    testCase = null;
    dataElementName = null;

    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Test', 'Authentication failed in previous test');
      return;
    }

    const env = await setupTestEnvironment(connection, 'dataElement_check', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('check_data_element');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    try {
      validateTestCaseForUserSpace(tc, 'check_data_element');
    } catch (error: any) {
      logger.skip('Test', error.message);
      return;
    }

    testCase = tc;
    dataElementName = tc.params.data_element_name;
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

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

  async function ensureDataElementExists(testCase: any): Promise<void> {
    const deName = testCase.params.data_element_name;

    try {
      await getDataElement(connection, deName);
      logger.debug(`Data element ${deName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Data element ${deName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_data_element', 'test_data_element');
        if (!createTestCase) {
          throw new Error(`Cannot create data element ${deName}: create_data_element test case not found`);
        }

        const domainName = testCase.params.domain_name || createTestCase.params.domain_name;
        if (domainName) {
          await ensureDomainExists(domainName);
        }

        await createDataElement(connection, {
          data_element_name: deName,
          description: createTestCase.params.description || `Test data element for ${deName}`,
          package_name: createTestCase.params.package_name || getDefaultPackage(),
          transport_request: createTestCase.params.transport_request || getDefaultTransport(),
          domain_name: domainName
        });
        logger.debug(`Data element ${deName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  it('should check data element syntax', async () => {
    if (!testCase || !dataElementName) {
      logger.skip('Check Test', testCase ? 'Data element name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing syntax check for data element: ${dataElementName}`);

    try {
      await ensureDataElementExists(testCase);

      const checkSessionId = generateSessionId();
      const result = await checkDataElement(connection, dataElementName, checkSessionId);
      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
      logger.info(`✓ Data element ${dataElementName} syntax check completed`);

    } catch (error: any) {
      logger.error(`✗ Failed to check data element syntax: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});

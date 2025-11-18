/**
 * Integration test for Data Element read
 * Tests getDataElement function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/dataElement/read.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { getDataElement } from '../../../core/dataElement/read';
import { createDataElement } from '../../../core/dataElement/create';
import { getDomain } from '../../../core/domain/read';
import { createDomain } from '../../../core/domain/create';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Data Element - Read';
const logger = createTestLogger('DTEL-READ');

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;

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
    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Test', 'Authentication failed in previous test');
      return;
    }

    const env = await setupTestEnvironment(connection, 'dataElement_read', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;
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
        if (!createDomainTestCase) {
          throw new Error(`Cannot create domain ${domainName}: create_domain test case not found`);
        }

        await createDomain(connection, {
          domain_name: domainName,
          description: `Test domain for ${domainName}`,
          package_name: createDomainTestCase.params.package_name || getDefaultPackage(),
          transport_request: createDomainTestCase.params.transport_request || getDefaultTransport(),
          datatype: createDomainTestCase.params.datatype || 'CHAR',
          length: createDomainTestCase.params.length || 10,
          decimals: createDomainTestCase.params.decimals,
          lowercase: createDomainTestCase.params.lowercase,
          sign_exists: createDomainTestCase.params.sign_exists
        });
        logger.debug(`Domain ${domainName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  async function ensureDataElementExists(dataElementName: string, domainName: string): Promise<void> {
    try {
      await getDataElement(connection, dataElementName);
      logger.debug(`Data element ${dataElementName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Data element ${dataElementName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_data_element', 'test_data_element');
        if (!createTestCase) {
          throw new Error(`Cannot create data element ${dataElementName}: create_data_element test case not found`);
        }

        try {
          await ensureDomainExists(domainName || createTestCase.params.domain_name);

          await createDataElement(connection, {
            data_element_name: dataElementName,
            description: createTestCase.params.description || `Test data element for ${dataElementName}`,
            package_name: createTestCase.params.package_name || getDefaultPackage(),
            transport_request: createTestCase.params.transport_request || getDefaultTransport(),
            domain_name: domainName || createTestCase.params.domain_name,
            short_label: createTestCase.params.short_label,
            medium_label: createTestCase.params.medium_label,
            long_label: createTestCase.params.long_label,
            heading_label: createTestCase.params.heading_label
          });
          logger.debug(`Data element ${dataElementName} created successfully`);
        } catch (createError: any) {
          throw createError;
        }
      } else {
        throw error;
      }
    }
  }

  it('should read standard data element', async () => {
    const testCase = getEnabledTestCase('get_data_element', 'standard_data_element');
    if (!testCase) {
      logger.skip('Read Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    const dataElementName = testCase.params.data_element_name;
    logger.info(`Testing read for standard data element: ${dataElementName}`);

    try {
      const result = await getDataElement(connection, dataElementName);
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
      expect(result.data).toContain('dtel:dataElement');
      logger.info(`✓ Standard data element ${dataElementName} read successfully`);

    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.skip('Read Test', `Standard data element ${dataElementName} does not exist in test system`);
        return;
      }
      logger.error(`✗ Failed to read standard data element: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));

  it('should read test data element', async () => {
    const testCase = getEnabledTestCase('get_data_element', 'test_data_element');
    if (!testCase) {
      logger.skip('Read Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    const createTestCase = getEnabledTestCase('create_data_element', 'test_data_element');
    const dataElementName = testCase.params.data_element_name || createTestCase?.params?.data_element_name || 'Z_TEST_DTEL_01';
    const domainName = createTestCase?.params?.domain_name || 'Z_TEST_DOMAIN_01';

    logger.info(`Testing read for test data element: ${dataElementName}`);

    try {
      await ensureDataElementExists(dataElementName, domainName);

      const result = await getDataElement(connection, dataElementName);
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
      expect(result.data).toContain('dtel:dataElement');
      logger.info(`✓ Test data element ${dataElementName} read successfully`);

    } catch (error: any) {
      if (error.message?.includes('Standard SAP data element') || error.response?.status === 401) {
        logger.skip('Read Test', `Cannot ensure data element exists - ${error.message}`);
        return;
      }
      logger.error(`✗ Failed to read test data element: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});

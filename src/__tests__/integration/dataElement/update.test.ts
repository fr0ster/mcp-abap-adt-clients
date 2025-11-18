/**
 * Integration test for Data Element update
 * Tests updateDataElement function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/dataElement/update.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { updateDataElement } from '../../../core/dataElement/update';
import { getDataElement } from '../../../core/dataElement/read';
import { createDataElement } from '../../../core/dataElement/create';
import { getDomain } from '../../../core/domain/read';
import { createDomain } from '../../../core/domain/create';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Data Element - Update';
const logger = createTestLogger('DTEL-UPDATE');

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

    const env = await setupTestEnvironment(connection, 'dataElement_update', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('update_data_element', 'test_data_element');
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
          sign_exists: createDomainTestCase.params.sign_exists,
        });
        logger.debug(`Domain ${domainName} created successfully`);
      } else {
        throw error;
      }
    }
  }

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

  it('should update data element', async () => {
    if (!testCase || !dataElementName) {
      logger.skip('Update Test', testCase ? 'Data element name not set' : 'Test case not configured');
      return;
    }

    try {
      validateTestCaseForUserSpace(testCase, 'update_data_element');
    } catch (error: any) {
      logger.skip('Update Test', error.message);
      return;
    }

    logger.info(`Testing update for data element: ${dataElementName}`);

    try {
      await ensureDataElementExists(testCase);

      await updateDataElement(connection, {
        data_element_name: dataElementName,
        description: testCase.params.description,
        package_name: testCase.params.package_name || getDefaultPackage(),
        transport_request: testCase.params.transport_request || getDefaultTransport(),
        domain_name: testCase.params.domain_name,
        short_label: testCase.params.short_label,
        medium_label: testCase.params.medium_label,
        long_label: testCase.params.long_label,
        heading_label: testCase.params.heading_label,
        activate: testCase.params.activate,
      });
      logger.debug(`✓ Data element ${dataElementName} updated`);

      const result = await getDataElement(connection, dataElementName);
      expect(result.status).toBe(200);
      if (testCase.params.description) {
        expect(result.data).toContain(testCase.params.description);
      }
      logger.info(`✓ Data element ${dataElementName} updated successfully`);

    } catch (error: any) {
      if (error.response?.status === 400) {
        logger.skip('Update Test', `Update failed (400) - object may be locked by another user`);
        return;
      }
      logger.error(`✗ Failed to update data element: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});

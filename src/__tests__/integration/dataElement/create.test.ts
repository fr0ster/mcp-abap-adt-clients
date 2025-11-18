/**
 * Integration test for DataElement creation
 * Tests createDataElement function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/dataElement/create.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { createDataElement } from '../../../core/dataElement/create';
import { getDataElement } from '../../../core/dataElement/read';
import { createDomain } from '../../../core/domain/create';
import { getDomain } from '../../../core/domain/read';
import { deleteObject } from '../../../core/delete';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'DataElement - Create';
const logger = createTestLogger('DTEL-CREATE');

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;
  let testCase: any = null;
  let dataElementName: string | null = null;
  let dependencyDomainName: string | null = null;

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

    const env = await setupTestEnvironment(connection, 'dataElement_create', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('create_dataElement', 'test_data_element');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    try {
      validateTestCaseForUserSpace(tc, 'create_dataElement');
    } catch (error: any) {
      logger.skip('Test', error.message);
      return;
    }

    testCase = tc;
    dataElementName = tc.params.data_element_name;
    dependencyDomainName = tc.params.domain_name;

    // Ensure dependency domain exists
    if (dependencyDomainName) {
      await ensureDependencyDomainExists(dependencyDomainName);
    }

    // Delete dataElement if exists (idempotency)
    if (dataElementName) {
      await deleteIfExists(dataElementName);
    }
  });

  afterEach(async () => {
    // Cleanup created dataElement first (dependency)
    if (dataElementName) {
      await deleteIgnoringErrors(dataElementName);
    }

    // Then cleanup dependency domain
    if (dependencyDomainName) {
      await deleteDependencyDomainIgnoringErrors(dependencyDomainName);
    }

    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

  async function ensureDependencyDomainExists(domainName: string): Promise<void> {
    try {
      await getDomain(connection, domainName);
      logger.debug(`Dependency domain ${domainName} already exists (OK)`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Creating dependency domain ${domainName}...`);
        await createDomain(connection, {
          domain_name: domainName,
          description: 'Dependency domain for DataElement CREATE test',
          package_name: getDefaultPackage(),
          transport_request: getDefaultTransport(),
          datatype: 'CHAR',
          length: 20
        });
        const delay = 2000;
        await new Promise(resolve => setTimeout(resolve, delay));
        logger.debug(`Dependency domain ${domainName} created`);
      } else {
        throw error;
      }
    }
  }

  async function deleteIfExists(name: string): Promise<void> {
    try {
      await getDataElement(connection, name);
      logger.debug(`DataElement ${name} exists, deleting...`);
      await deleteObject(connection, {
        object_name: name,
        object_type: 'DTEL/DE'
      });
      const delay = 2000;
      await new Promise(resolve => setTimeout(resolve, delay));
      logger.debug(`DataElement ${name} deleted`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`DataElement ${name} does not exist (OK)`);
      } else {
        throw error;
      }
    }
  }

  async function deleteIgnoringErrors(name: string): Promise<void> {
    try {
      await deleteObject(connection, {
        object_name: name,
        object_type: 'DTEL/DE'
      });
      logger.debug(`Cleanup: deleted dataElement ${name}`);
    } catch (error: any) {
      logger.debug(`Cleanup: could not delete dataElement ${name} (${error.message})`);
    }
  }

  async function deleteDependencyDomainIgnoringErrors(domainName: string): Promise<void> {
    try {
      await deleteObject(connection, {
        object_name: domainName,
        object_type: 'DOMA/DD'
      });
      logger.debug(`Cleanup: deleted dependency domain ${domainName}`);
    } catch (error: any) {
      logger.debug(`Cleanup: could not delete dependency domain ${domainName} (${error.message})`);
    }
  }

  it('should create basic dataElement', async () => {
    if (!testCase || !dataElementName) {
      logger.skip('Create Test', testCase ? 'DataElement name not set' : 'Test case not configured');
      return;
    }

    logger.debug(`Testing create for dataElement: ${dataElementName}`);

    try {
      const result = await createDataElement(connection, {
        data_element_name: testCase.params.data_element_name,
        description: testCase.params.description,
        package_name: testCase.params.package_name || getDefaultPackage(),
        transport_request: testCase.params.transport_request || getDefaultTransport(),
        domain_name: testCase.params.domain_name || 'STRING'
      });

      expect([200, 201]).toContain(result.status);
      logger.debug(`✓ DataElement ${dataElementName} created successfully (status: ${result.status})`);

      // Wait for SAP to register the object
      const delay = 1000;
      await new Promise(resolve => setTimeout(resolve, delay));

      // Verify dataElement exists
      const getResult = await getDataElement(connection, dataElementName);
      expect(getResult.status).toBe(200);
      logger.debug(`✓ DataElement ${dataElementName} verified to exist`);

    } catch (error: any) {
      logger.error(`✗ Failed to create dataElement: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});

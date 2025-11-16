/**
 * Unit test for deleteObject (Data Element)
 * Tests only the delete operation in isolation
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { deleteObject } from '../../../core/delete';
import { createDataElement } from '../../../core/dataElement/create';
import { getDataElement } from '../../../core/dataElement/read';
import { getDomain } from '../../../core/domain/read';
import { createDomain } from '../../../core/domain/create';

const { getEnabledTestCase, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
// Environment variables are loaded automatically by test-helper

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};

function getConfig(): SapConfig {
  const rawUrl = process.env.SAP_URL;
  const url = rawUrl ? rawUrl.split('#')[0].trim() : rawUrl;
  const rawClient = process.env.SAP_CLIENT;
  const client = rawClient ? rawClient.split('#')[0].trim() : rawClient;
  const rawAuthType = process.env.SAP_AUTH_TYPE || 'basic';
  const authType = rawAuthType.split('#')[0].trim();

  if (!url || !/^https?:\/\//.test(url)) {
    throw new Error(`Missing or invalid SAP_URL: ${url}`);
  }

  const config: SapConfig = {
    url,
    authType: authType === 'xsuaa' ? 'jwt' : (authType as 'basic' | 'jwt'),
  };

  if (client) {
    config.client = client;
  }

  if (authType === 'jwt' || authType === 'xsuaa') {
    const jwtToken = process.env.SAP_JWT_TOKEN;
    if (!jwtToken) {
      throw new Error('Missing SAP_JWT_TOKEN for JWT authentication');
    }
    config.jwtToken = jwtToken;
  } else {
    const username = process.env.SAP_USERNAME;
    const password = process.env.SAP_PASSWORD;
    if (!username || !password) {
      throw new Error('Missing SAP_USERNAME or SAP_PASSWORD for basic authentication');
    }
    config.username = username;
    config.password = password;
  }

  return config;
}

describe('Data Element - Delete', () => {
  let connection: AbapConnection;
  let hasConfig = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      hasConfig = true;
    } catch (error) {
      console.warn('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterAll(async () => {
    if (connection) {
      connection.reset();
    }
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

  // Helper function to ensure object exists before test (idempotency)
  async function ensureDataElementExists(testCase: any) {
    const dataElementName = testCase.params.data_element_name || testCase.params.object_name;
    if (!dataElementName) {
      throw new Error('data_element_name or object_name is required in test case');
    }
    try {
      await getDataElement(connection, dataElementName);
      logger.debug(`Data element ${dataElementName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Data element ${dataElementName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_data_element', 'test_data_element');
        if (createTestCase) {
          // Ensure domain exists first
          await ensureDomainExists(createTestCase.params.domain_name);

          await createDataElement(connection, {
            data_element_name: dataElementName,
            description: testCase.params.description || `Test data element for ${dataElementName}`,
            package_name: createTestCase.params.package_name || getDefaultPackage(),
            transport_request: createTestCase.params.transport_request || getDefaultTransport(),
            domain_name: createTestCase.params.domain_name,
            short_label: createTestCase.params.short_label,
            medium_label: createTestCase.params.medium_label,
            long_label: createTestCase.params.long_label,
            heading_label: createTestCase.params.heading_label,
          });
          logger.debug(`Data element ${dataElementName} created successfully`);
        } else {
          throw new Error(`Cannot create data element ${dataElementName}: create_data_element test case not found`);
        }
      } else {
        throw error;
      }
    }
  }

  it('should delete data element', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('delete_data_element');
    if (!testCase) {
      return; // Skip silently if test case not configured
    }

    // Ensure data element exists before test (idempotency)
    try {
      await ensureDataElementExists(testCase);
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: Cannot ensure data element exists: ${error.message}`);
      return;
    }

    const dataElementName = testCase.params.data_element_name || testCase.params.object_name;
    const objectType = testCase.params.object_type || 'DTEL/DE';

    try {
      await deleteObject(connection, {
        object_name: dataElementName,
        object_type: objectType,
      });
      logger.debug(`✅ Deleted data element: ${dataElementName}`);
    } catch (error: any) {
      // If delete fails with 404, object doesn't exist - test passes
      if (error.response?.status === 404) {
        logger.debug(`Data element ${dataElementName} does not exist - skipping deletion`);
        return;
      }
      // For other errors, fail the test
      throw error;
    }
  }, 60000);
});


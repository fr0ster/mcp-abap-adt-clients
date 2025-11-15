/**
 * Unit test for Data Element creation
 * Tests createDataElement function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/dataElement/create.test
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
import { createDataElement } from '../../../core/dataElement/create';
import { getDataElement } from '../../../core/dataElement/read';
import { deleteObject } from '../../../core/delete';
import { getDomain } from '../../../core/domain/read';
import { createDomain } from '../../../core/domain/create';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: console.warn,
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

describe('Data Element - Create', () => {
  let connection: AbapConnection;
  let hasConfig = false;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      hasConfig = true;
    } catch (error) {
      logger.warn('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterEach(async () => {
    if (connection) {
      connection.reset();
    }
  });

  // Helper function to ensure data element does not exist before creation test (idempotency)
  async function ensureDataElementDoesNotExist(testCase: any): Promise<boolean> {
    if (!connection || !hasConfig) {
      logger.warn('⚠️ Connection not initialized, skipping ensureDataElementDoesNotExist');
      return false;
    }
    try {
      await getDataElement(connection, testCase.params.data_element_name);
      // Object exists, try to delete it
      logger.debug(`Data element ${testCase.params.data_element_name} exists, attempting to delete...`);
      try {
        await deleteObject(connection, {
          object_name: testCase.params.data_element_name,
          object_type: 'DTEL/DE',
        });
        logger.debug(`Data element ${testCase.params.data_element_name} deleted successfully`);
        // Wait a bit for SAP to process deletion
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Verify it's truly gone
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await getDataElement(connection, testCase.params.data_element_name);
            if (attempt < 2) {
              logger.debug(`Data element ${testCase.params.data_element_name} still exists, waiting... (attempt ${attempt + 1}/3)`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
              logger.warn(`Data element ${testCase.params.data_element_name} still exists after deletion attempt`);
              return true;
            }
          } catch (verifyError: any) {
            if (verifyError.response?.status === 404) {
              logger.debug(`Data element ${testCase.params.data_element_name} confirmed deleted`);
              return true;
            }
            throw verifyError;
          }
        }
        return true;
      } catch (deleteError: any) {
        logger.warn(`Failed to delete data element ${testCase.params.data_element_name}: ${deleteError.message}`);
        return false;
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Data element ${testCase.params.data_element_name} does not exist`);
        return true;
      }
      if (error.response?.status === 401) {
        logger.debug(`Data element ${testCase.params.data_element_name} check failed with 401 (no cookies yet) - assuming doesn't exist`);
        return true;
      }
      throw error;
    }
  }

  // Helper function to ensure domain exists (data elements require a domain)
  async function ensureDomainExists(domainName: string): Promise<void> {
    try {
      await getDomain(connection, domainName);
      logger.debug(`Domain ${domainName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Domain doesn't exist, create it
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

  it('should create basic data element', async () => {
    if (!hasConfig || !connection) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('create_data_element', 'test_data_element');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    // Validate that data element is in user space (Z_ or Y_)
    try {
      validateTestCaseForUserSpace(testCase, 'create_data_element');
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: ${error.message}`);
      return;
    }

    // Ensure data element does not exist before creation (idempotency)
    const canProceed = await ensureDataElementDoesNotExist(testCase);
    if (!canProceed) {
      logger.warn(`⚠️ Skipping test: Cannot ensure data element ${testCase.params.data_element_name} does not exist`);
      return;
    }

    // Ensure domain exists (data elements require a domain)
    const domainName = testCase.params.domain_name;
    if (domainName) {
      await ensureDomainExists(domainName);
    }

    await createDataElement(connection, {
      data_element_name: testCase.params.data_element_name,
      description: testCase.params.description,
      package_name: testCase.params.package_name || getDefaultPackage(),
      transport_request: testCase.params.transport_request || getDefaultTransport(),
      domain_name: testCase.params.domain_name,
      data_type: testCase.params.data_type,
      length: testCase.params.length,
      decimals: testCase.params.decimals,
      short_label: testCase.params.short_label,
      medium_label: testCase.params.medium_label,
      long_label: testCase.params.long_label,
      heading_label: testCase.params.heading_label,
    });

    // Verify creation by reading
    const result = await getDataElement(connection, testCase.params.data_element_name);
    expect(result.status).toBe(200);
    expect(result.data).toContain(testCase.params.data_element_name.toUpperCase());
  }, 60000);
});


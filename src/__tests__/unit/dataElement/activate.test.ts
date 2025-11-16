/**
 * Unit test for Data Element activation
 * Tests activateDataElement function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/dataElement/activate.test
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
import { activateDataElement } from '../../../core/dataElement/activation';
import { getDataElement } from '../../../core/dataElement/read';
import { createDataElement } from '../../../core/dataElement/create';
import { getDomain } from '../../../core/domain/read';
import { createDomain } from '../../../core/domain/create';
import { generateSessionId } from '../../../utils/sessionUtils';
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

describe('Data Element - Activate', () => {
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

  it('should activate data element', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('activate_data_element', 'test_data_element');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    // Validate that data element is in user space (Z_ or Y_)
    try {
      validateTestCaseForUserSpace(testCase, 'activate_data_element');
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: ${error.message}`);
      return;
    }

    // Ensure data element exists before test (idempotency)
    await ensureDataElementExists(testCase);

    const sessionId = generateSessionId();
    const response = await activateDataElement(
      connection,
      testCase.params.data_element_name,
      sessionId
    );

    expect(response.status).toBe(200);
    logger.debug(`✅ Activated data element: ${testCase.params.data_element_name}`);
  }, 30000);
});


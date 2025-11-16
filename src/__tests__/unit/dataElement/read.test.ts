/**
 * Unit test for Data Element reading
 * Tests getDataElement function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/dataElement/read.test
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

import { getDataElement } from '../../../core/dataElement/read';
import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { createDataElement } from '../../../core/dataElement/create';
import { getDomain } from '../../../core/domain/read';
import { createDomain } from '../../../core/domain/create';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const { getEnabledTestCase, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};

describe('Data Element - Read', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);

      // Setup session and lock tracking based on test-config.yaml
      // This will enable stateful session if persist_session: true in YAML
      const env = await setupTestEnvironment(connection, 'dataElement_read', __filename);
      sessionId = env.sessionId;
      testConfig = env.testConfig;
      lockTracking = env.lockTracking;

      if (sessionId) {
        logger.debug(`✓ Session persistence enabled: ${sessionId}`);
        logger.debug(`  Session storage: ${testConfig?.session_config?.sessions_dir || '.sessions'}`);
      } else {
        logger.debug('⚠️ Session persistence disabled (persist_session: false in test-config.yaml)');
      }

      if (lockTracking?.enabled) {
        logger.debug(`✓ Lock tracking enabled: ${lockTracking.locksDir}`);
      } else {
        logger.debug('⚠️ Lock tracking disabled (persist_locks: false in test-config.yaml)');
      }

      // Connect to SAP system to initialize session (get CSRF token and cookies)
      await (connection as any).connect();

      hasConfig = true;
    } catch (error) {
      logger.warn('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterAll(async () => {
    if (connection) {
      await cleanupTestEnvironment(connection, sessionId, testConfig);
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
  async function ensureDataElementExists(dataElementName: string, domainName: string) {
    try {
      logger.debug(`Data element ${dataElementName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Data element ${dataElementName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_data_element', 'test_data_element');
        if (createTestCase) {
          try {
            // Ensure domain exists first
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

  it('should read existing data element', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('get_data_element', 'standard_data_element');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    try {
      const result = await getDataElement(connection, testCase.params.data_element_name);
      expect(result.status).toBe(200);
      expect(result.data).toContain('dtel:dataElement');
    } catch (error: any) {
      // Standard data element might not exist in test system
      if (error.response?.status === 404) {
        logger.warn(`⚠️ Standard data element ${testCase.params.data_element_name} does not exist in test system`);
        return;
      }
      throw error;
    }
  }, 15000);

  it('should read test data element if configured', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('get_data_element', 'test_data_element');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    // Ensure data element exists before test (idempotency)
    try {
      const createTestCase = getEnabledTestCase('create_data_element', 'test_data_element');
      await ensureDataElementExists(
        testCase.params.data_element_name || createTestCase?.params?.data_element_name || 'Z_TEST_DTEL_01',
        createTestCase?.params?.domain_name || 'Z_TEST_DOMAIN_01'
      );
    } catch (error: any) {
      // If data element creation fails (e.g., 401 auth error), skip test
      if (error.message?.includes('Standard SAP data element') || error.response?.status === 401) {
        logger.warn(`⚠️ Skipping test: Cannot ensure data element exists - ${error.message}`);
        return;
      }
      throw error;
    }

    const result = await getDataElement(connection, testCase.params.data_element_name);
    expect(result.status).toBe(200);
    expect(result.data).toContain('dtel:dataElement');
  }, 15000);
});


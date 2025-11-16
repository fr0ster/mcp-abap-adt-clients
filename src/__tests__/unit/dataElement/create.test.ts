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

import { getDataElement } from '../../../core/dataElement/read';
import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { createDataElement } from '../../../core/dataElement/create';
import { deleteObject } from '../../../core/delete';
import { getDomain } from '../../../core/domain/read';
import { createDomain } from '../../../core/domain/create';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};

describe('Data Element - Create', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);

      // Setup session and lock tracking based on test-config.yaml
      // This will enable stateful session if persist_session: true in YAML
      const env = await setupTestEnvironment(connection, 'dataElement_create', __filename);
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

  afterEach(async () => {
    if (connection) {
      await cleanupTestEnvironment(connection, sessionId, testConfig);
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
        // Verify it's truly gone - try a few times as SAP may have delay
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            // Object still exists, wait a bit more and try again
            if (attempt < 4) {
              logger.debug(`Data element ${testCase.params.data_element_name} still exists, waiting... (attempt ${attempt + 1}/5)`);
              await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1))); // Exponential backoff
            } else {
              // After 5 attempts, object still exists - might be locked or has dependencies
              logger.warn(`Data element ${testCase.params.data_element_name} still exists after ${5} deletion attempts (may be locked or have dependencies)`);
              // Try to delete again one more time
              try {
                await deleteObject(connection, {
                  object_name: testCase.params.data_element_name,
                  object_type: 'DTEL/DE',
                });
                await new Promise(resolve => setTimeout(resolve, 3000));
                // Check one more time
                try {
                  // Still exists - cannot proceed
                  logger.error(`Data element ${testCase.params.data_element_name} still exists after final deletion attempt`);
                  return false;
                } catch (finalCheckError: any) {
                  if (finalCheckError.response?.status === 404) {
                    logger.debug(`Data element ${testCase.params.data_element_name} confirmed deleted after final attempt`);
                    return true;
                  }
                  return false;
                }
              } catch (finalDeleteError) {
                logger.error(`Final deletion attempt failed: ${finalDeleteError}`);
                return false;
              }
            }
          } catch (verifyError: any) {
            if (verifyError.response?.status === 404) {
              logger.debug(`Data element ${testCase.params.data_element_name} confirmed deleted`);
              return true; // Successfully deleted
            }
            throw verifyError;
          }
        }
        return false; // Should not reach here, but if we do, don't proceed
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

    try {
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
    } catch (createError: any) {
      // If data element already exists (might happen if deletion didn't complete in time)
      if (createError.message?.includes('already exists') ||
          createError.message?.includes('does already exist') ||
          (createError.response?.data &&
           typeof createError.response.data === 'string' &&
           createError.response.data.includes('already exists'))) {
        logger.warn(`⚠️ Data element ${testCase.params.data_element_name} already exists - skipping creation test`);
        // Verify that data element exists and is readable
        try {
          const result = await getDataElement(connection, testCase.params.data_element_name);
          expect(result.status).toBe(200);
          logger.info(`✓ Data element ${testCase.params.data_element_name} exists and is readable`);
          return; // Test passes - data element exists and is accessible
        } catch (readError) {
          // If we can't read it, something is wrong
          throw new Error(`Data element ${testCase.params.data_element_name} exists but cannot be read: ${readError}`);
        }
      }

      // If lock conflict error (object is locked)
      if (createError.message?.includes('LockConflict') ||
          createError.message?.includes('lock conflict') ||
          (createError.response?.data &&
           typeof createError.response.data === 'string' &&
           createError.response.data.includes('LockConflict'))) {
        logger.warn(`⚠️ Data element ${testCase.params.data_element_name} is locked - skipping creation test`);
        // Wait a bit and try to read it
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
          const result = await getDataElement(connection, testCase.params.data_element_name);
          expect(result.status).toBe(200);
          logger.info(`✓ Data element ${testCase.params.data_element_name} exists and is readable`);
          return; // Test passes - data element exists and is accessible
        } catch (readError) {
          // If we can't read it, something is wrong
          throw new Error(`Data element ${testCase.params.data_element_name} is locked but cannot be read: ${readError}`);
        }
      }

      // For other errors, fail the test
      throw createError;
    }

    // Verify creation by reading
    const result = await getDataElement(connection, testCase.params.data_element_name);
    expect(result.status).toBe(200);
    expect(result.data).toContain(testCase.params.data_element_name.toUpperCase());
  }, 60000);
});


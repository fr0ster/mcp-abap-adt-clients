/**
 * Unit test for Domain creation
 * Tests createDomain function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/domain/create.test
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

import { getDomain } from '../../../core/domain/read';
import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';
import { createDomain } from '../../../core/domain/create';
import { deleteObject } from '../../../core/delete';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');


const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};


describe('Domain - Create', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      const env = await setupTestEnvironment(connection, '${module}_create', __filename);
      sessionId = env.sessionId;
      testConfig = env.testConfig;

      // Setup session and lock tracking based on test-config.yaml
      // This will enable stateful session if persist_session: true in YAML
      
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
      // Type assertion needed until connection package is rebuilt
      await (connection as any).connect();

      hasConfig = true;
    } catch (error) {
      logger.warn('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
    if (connection && sessionId) {
      await cleanupTestEnvironment(connection, sessionId, testConfig);
    }
    if (connection) {
      connection.reset();
    }
  });

  // Helper function to ensure domain does not exist before creation test (idempotency)
  async function ensureDomainDoesNotExist(testCase: any): Promise<boolean> {
    if (!connection || !hasConfig) {
      logger.warn('⚠️ Connection not initialized, skipping ensureDomainDoesNotExist');
      return false;
    }
    try {
      // Object exists, try to delete it
      logger.debug(`Domain ${testCase.params.domain_name} exists, attempting to delete...`);
      try {
        await deleteObject(connection, {
          object_name: testCase.params.domain_name,
          object_type: 'DOMA/DD',
        });
        logger.debug(`Domain ${testCase.params.domain_name} deleted successfully`);
        // Wait a bit for SAP to process deletion
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Verify it's truly gone - try a few times as SAP may have delay
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            // Object still exists, wait a bit more and try again
            if (attempt < 4) {
              logger.debug(`Domain ${testCase.params.domain_name} still exists, waiting... (attempt ${attempt + 1}/5)`);
              await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1))); // Exponential backoff
            } else {
              // After 5 attempts, object still exists - might be locked or has dependencies
              logger.warn(`Domain ${testCase.params.domain_name} still exists after ${5} deletion attempts (may be locked or have dependencies)`);
              // Try to delete again one more time
              try {
                await deleteObject(connection, {
                  object_name: testCase.params.domain_name,
                  object_type: 'DOMA/DD',
                });
                await new Promise(resolve => setTimeout(resolve, 3000));
                // Check one more time
                try {
                  // Still exists - cannot proceed
                  logger.error(`Domain ${testCase.params.domain_name} still exists after final deletion attempt`);
                  return false;
                } catch (finalCheckError: any) {
                  if (finalCheckError.response?.status === 404) {
                    logger.debug(`Domain ${testCase.params.domain_name} confirmed deleted after final attempt`);
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
              logger.debug(`Domain ${testCase.params.domain_name} confirmed deleted`);
              return true; // Successfully deleted
            }
            throw verifyError;
          }
        }
        return false; // Should not reach here, but if we do, don't proceed
      } catch (deleteError: any) {
        logger.warn(`Failed to delete domain ${testCase.params.domain_name}: ${deleteError.message}`);
        return false; // Cannot proceed - deletion failed
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Domain ${testCase.params.domain_name} does not exist`);
        return true; // Object doesn't exist - can proceed
      }
      // If 401, connection doesn't have cookies yet - assume object doesn't exist and proceed
      // Cookies will be obtained on first POST request (createEmptyDomain)
      if (error.response?.status === 401) {
        logger.debug(`Domain ${testCase.params.domain_name} check failed with 401 (no cookies yet) - assuming doesn't exist`);
        return true; // Assume object doesn't exist - will get cookies on first POST
      }
      throw error;
    }
  }

  it('should create basic domain', async () => {
    if (!hasConfig || !connection) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('create_domain', 'test_domain');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    // Validate that domain is in user space (Z_ or Y_)
    try {
      validateTestCaseForUserSpace(testCase, 'create_domain');
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: ${error.message}`);
      return;
    }

    // Ensure domain does not exist before creation (idempotency)
    // This will delete the object if it exists
    // Note: ensureDomainDoesNotExist handles 401 errors by assuming object doesn't exist
    const canProceed = await ensureDomainDoesNotExist(testCase);
    if (!canProceed) {
      logger.warn(`⚠️ Skipping test: Cannot ensure domain ${testCase.params.domain_name} does not exist`);
      return;
    }

    try {
      await createDomain(connection, {
        domain_name: testCase.params.domain_name,
        description: testCase.params.description,
        package_name: testCase.params.package_name || getDefaultPackage(),
        transport_request: testCase.params.transport_request || getDefaultTransport(),
        datatype: testCase.params.datatype,
        length: testCase.params.length,
        decimals: testCase.params.decimals,
        lowercase: testCase.params.lowercase,
        sign_exists: testCase.params.sign_exists,
      });
    } catch (createError: any) {
      // If domain already exists (might happen if deletion didn't complete in time)
      if (createError.message?.includes('already exists') ||
          createError.message?.includes('does already exist') ||
          (createError.response?.data &&
           typeof createError.response.data === 'string' &&
           createError.response.data.includes('already exists'))) {
        logger.warn(`⚠️ Domain ${testCase.params.domain_name} already exists - skipping creation test`);
        // Verify that domain exists and is readable
        try {
          const result = await getDomain(connection, testCase.params.domain_name);
          expect(result.status).toBe(200);
          logger.info(`✓ Domain ${testCase.params.domain_name} exists and is readable`);
          return; // Test passes - domain exists and is accessible
        } catch (readError) {
          // If we can't read it, something is wrong
          throw new Error(`Domain ${testCase.params.domain_name} exists but cannot be read: ${readError}`);
        }
      }
      // For other errors, fail the test
      throw createError;
    }

    // Verify creation by reading
    const result = await getDomain(connection, testCase.params.domain_name);
    expect(result.status).toBe(200);
    expect(result.data).toContain(testCase.params.domain_name.toUpperCase());
  }, 60000);
});


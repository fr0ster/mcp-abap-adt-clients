/**
 * Unit test for Domain syntax check
 * Tests checkDomainSyntax function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/domain/check.test
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
import { checkDomainSyntax } from '../../../core/domain/check';
import { getDomain } from '../../../core/domain/read';
import { createDomain } from '../../../core/domain/create';
import { generateSessionId } from '../../../utils/sessionUtils';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';
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

describe('Domain - Check', () => {
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
      const env = await setupTestEnvironment(connection, 'domain_check', __filename);
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

  // Helper function to ensure domain exists before test (idempotency)
  async function ensureDomainExists(testCase: any) {
    if (!connection || !hasConfig) {
      logger.warn('⚠️ Connection not initialized, skipping ensureDomainExists');
      throw new Error('Connection not initialized');
    }

    const domainName = testCase.params.domain_name;

    try {
      await getDomain(connection, domainName);
      logger.debug(`Domain ${domainName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Domain ${domainName} does not exist, creating...`);
        // Try to get create_domain test case, fallback to check_domain if not found
        let createTestCase = getEnabledTestCase('create_domain', 'test_domain');
        if (!createTestCase) {
          // Fallback: use check_domain test case with default package from global config
          const checkTestCase = getEnabledTestCase('check_domain', 'test_domain');
          if (checkTestCase) {
            createTestCase = {
              params: {
                domain_name: domainName,
                package_name: checkTestCase.params.package_name || getDefaultPackage(),
                transport_request: checkTestCase.params.transport_request || getDefaultTransport(),
                description: `Test domain for ${domainName}`,
                datatype: 'CHAR',
                length: 10,
              }
            };
          }
        }

        // Use default package if not specified
        if (createTestCase) {
          createTestCase.params.package_name = createTestCase.params.package_name || getDefaultPackage();
          createTestCase.params.transport_request = createTestCase.params.transport_request || getDefaultTransport();
        }

        if (createTestCase && createTestCase.params.package_name) {
          try {
            await createDomain(connection, {
              domain_name: domainName,
              description: createTestCase.params.description || `Test domain for ${domainName}`,
              package_name: createTestCase.params.package_name,
              transport_request: createTestCase.params.transport_request,
              datatype: createTestCase.params.datatype || 'CHAR',
              length: createTestCase.params.length || 10,
              decimals: createTestCase.params.decimals,
              lowercase: createTestCase.params.lowercase,
              sign_exists: createTestCase.params.sign_exists,
            });
            logger.debug(`Domain ${domainName} created successfully`);
          } catch (createError: any) {
            throw createError;
          }
        } else {
          throw new Error(`Cannot create domain ${domainName}: create_domain test case not found and package_name is missing`);
        }
      } else {
        throw error;
      }
    }
  }

  it('should check domain syntax', async () => {
    if (!hasConfig || !connection) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('check_domain', 'test_domain');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    // Validate that domain is in user space (Z_ or Y_)
    try {
      validateTestCaseForUserSpace(testCase, 'check_domain');
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: ${error.message}`);
      return;
    }

    // Ensure domain exists before test (idempotency)
    try {
      await ensureDomainExists(testCase);
    } catch (error: any) {
      // If domain creation fails (e.g., 401 auth error), skip test
      if (error.message?.includes('Connection not initialized') || error.response?.status === 401) {
        logger.warn(`⚠️ Skipping test: Cannot ensure domain exists - ${error.message}`);
        return;
      }
      throw error;
    }

    const sessionId = generateSessionId();
    const response = await checkDomainSyntax(
      connection,
      testCase.params.domain_name,
      testCase.params.version || 'inactive',
      sessionId
    );

    // Domain check returns AxiosResponse, verify status code
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(500);

    // Verify response has data
    expect(response.data).toBeDefined();
  }, 30000);
});


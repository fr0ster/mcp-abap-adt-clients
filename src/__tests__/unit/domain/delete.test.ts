/**
 * Unit test for Domain deletion
 * Tests deleteDomain function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/domain/delete.test
 */

import { getDomain } from '../../../core/domain/read';
import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { deleteDomain } from '../../../core/domain/delete';
import { createDomain } from '../../../core/domain/create';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';

const { getEnabledTestCase, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');


const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger: ILogger = {
  debug: debugEnabled ? (message: string, meta?: any) => console.log(message, meta) : () => {},
  info: debugEnabled ? (message: string, meta?: any) => console.log(message, meta) : () => {},
  warn: debugEnabled ? (message: string, meta?: any) => console.warn(message, meta) : () => {},
  error: debugEnabled ? (message: string, meta?: any) => console.error(message, meta) : () => {},
  csrfToken: debugEnabled ? (action: string, token?: string) => console.log(`CSRF ${action}:`, token) : () => {},
};

describe('Domain - Delete', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      const env = await setupTestEnvironment(connection, '${module}_delete', __filename);
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
      await (connection as any).connect();

      hasConfig = true;
    } catch (error) {
      logger.warn('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
    if (connection) {
      await cleanupTestEnvironment(connection, sessionId, testConfig);
      connection.reset();
    }
  });

  // Helper function to ensure object exists before test (idempotency)
  async function ensureDomainExists(testCase: any) {
    const domainName = testCase.params.domain_name || testCase.params.object_name;
    if (!domainName) {
      throw new Error('domain_name or object_name is required in test case');
    }
    try {
      logger.debug(`Domain ${domainName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Domain ${domainName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_domain', 'test_domain');
        if (createTestCase) {
          await createDomain(connection, {
            domain_name: domainName,
            description: testCase.params.description || `Test domain for ${domainName}`,
            package_name: createTestCase.params.package_name || getDefaultPackage(),
            transport_request: createTestCase.params.transport_request || getDefaultTransport(),
            datatype: createTestCase.params.datatype || 'CHAR',
            length: createTestCase.params.length || 10,
            decimals: createTestCase.params.decimals,
            lowercase: createTestCase.params.lowercase,
            sign_exists: createTestCase.params.sign_exists,
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

  it('should delete domain', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('delete_domain');
    if (!testCase) {
      return; // Skip silently if test case not configured
    }

    // Ensure domain exists before test (idempotency)
    await ensureDomainExists(testCase);

    const domainName = testCase.params.domain_name || testCase.params.object_name;

    await deleteDomain(connection, {
      domain_name: domainName,
      transport_request: testCase.params.transport_request || getDefaultTransport(),
    });
    logger.debug(`✅ Deleted domain: ${domainName}`);
  }, 10000);
});


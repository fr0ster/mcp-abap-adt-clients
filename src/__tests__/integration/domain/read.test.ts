/**
 * Integration test for Domain read
 * Tests getDomain function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/domain/read.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { getDomain } from '../../../core/domain/read';
import { createDomain } from '../../../core/domain/create';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Domain - Read';
const logger = createTestLogger('DOMAIN-READ');

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;
  let testCase: any = null;
  let domainName: string | null = null;

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
    domainName = null;

    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Test', 'Authentication failed in previous test');
      return;
    }

    const env = await setupTestEnvironment(connection, 'domain_read', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('get_domain', 'test_domain');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    testCase = tc;
    domainName = tc.params.domain_name;
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
        const createTestCase = getEnabledTestCase('create_domain', 'test_domain');
        if (!createTestCase) {
          throw new Error(`Cannot create domain ${domainName}: create_domain test case not found`);
        }

        await createDomain(connection, {
          domain_name: domainName,
          description: createTestCase.params.description || `Test domain for ${domainName}`,
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
        throw error;
      }
    }
  }

  it('should read domain', async () => {
    if (!testCase || !domainName) {
      logger.skip('Read Test', testCase ? 'Domain name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing read for domain: ${domainName}`);

    try {
      await ensureDomainExists(domainName);

      const result = await getDomain(connection, domainName);
      expect(result.status).toBe(200);
      expect(result.data).toContain('doma:domain');
      logger.info(`✓ Domain ${domainName} read successfully`);

    } catch (error: any) {
      if (error.message?.includes('Standard SAP domain') || error.response?.status === 401) {
        logger.skip('Read Test', `Cannot ensure domain exists - ${error.message}`);
        return;
      }
      logger.error(`✗ Failed to read domain: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});

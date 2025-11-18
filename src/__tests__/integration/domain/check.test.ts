/**
 * Integration test for Domain syntax check
 * Tests checkDomainSyntax function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/domain/check.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { checkDomainSyntax } from '../../../core/domain/check';
import { getDomain } from '../../../core/domain/read';
import { createDomain } from '../../../core/domain/create';
import { generateSessionId } from '../../../utils/sessionUtils';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Domain - Check';
const logger = createTestLogger('DOMAIN-CHECK');

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

    const env = await setupTestEnvironment(connection, 'domain_check', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('check_domain', 'test_domain');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    try {
      validateTestCaseForUserSpace(tc, 'check_domain');
    } catch (error: any) {
      logger.skip('Test', error.message);
      return;
    }

    testCase = tc;
    domainName = tc.params.domain_name;
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

  async function ensureDomainExists(testCase: any): Promise<void> {
    const dName = testCase.params.domain_name;

    try {
      await getDomain(connection, dName);
      logger.debug(`Domain ${dName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Domain ${dName} does not exist, creating...`);
        let createTestCase = getEnabledTestCase('create_domain', 'test_domain');
        if (!createTestCase) {
          const checkTestCase = getEnabledTestCase('check_domain', 'test_domain');
          if (checkTestCase) {
            createTestCase = {
              params: {
                domain_name: dName,
                package_name: checkTestCase.params.package_name || getDefaultPackage(),
                transport_request: checkTestCase.params.transport_request || getDefaultTransport(),
                description: `Test domain for ${dName}`,
                datatype: 'CHAR',
                length: 10
              }
            };
          }
        }

        if (!createTestCase) {
          throw new Error(`Cannot create domain ${dName}: create_domain test case not found`);
        }

        await createDomain(connection, {
          domain_name: dName,
          description: createTestCase.params.description || `Test domain for ${dName}`,
          package_name: createTestCase.params.package_name || getDefaultPackage(),
          transport_request: createTestCase.params.transport_request || getDefaultTransport(),
          datatype: createTestCase.params.datatype || 'CHAR',
          length: createTestCase.params.length || 10,
          decimals: createTestCase.params.decimals,
          lowercase: createTestCase.params.lowercase,
          sign_exists: createTestCase.params.sign_exists
        });
        logger.debug(`Domain ${dName} created successfully`);
      } else if (error.message?.includes('Standard SAP domain')) {
        logger.skip('Test', 'Cannot modify standard SAP domain');
        throw error;
      } else if (error.response?.status === 401) {
        logger.skip('Test', 'Authentication error');
        throw error;
      } else {
        throw error;
      }
    }
  }

  it('should check domain syntax', async () => {
    if (!testCase || !domainName) {
      logger.skip('Check Test', testCase ? 'Domain name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing syntax check for domain: ${domainName}`);

    try {
      await ensureDomainExists(testCase);

      const checkSessionId = generateSessionId();
      const result = await checkDomainSyntax(
        connection,
        domainName,
        testCase.params.version || 'inactive',
        checkSessionId
      );
      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
      logger.info(`✓ Domain ${domainName} syntax check completed`);

    } catch (error: any) {
      if (error.message?.includes('Standard SAP domain') || error.response?.status === 401) {
        logger.skip('Check Test', error.message);
        return;
      }
      logger.error(`✗ Failed to check domain syntax: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});

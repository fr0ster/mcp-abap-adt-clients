/**
 * Unit test for Package creation
 * Tests createPackage function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/package/create.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';
import { createPackage } from '../../../core/package/create';
import { getPackage } from '../../../core/package/read';
import { getConfig } from '../../helpers/sessionConfig';

const { getEnabledTestCase, validateTestCaseForUserSpace } = require('../../../../tests/test-helper');

if (fs.existsSync(envPath)) {
}

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};

describe('Package - Create', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let sessionId: string | null = null;
  let testConfig: any = null;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      const env = await setupTestEnvironment(connection, '${module}_create', __filename);
      sessionId = env.sessionId;
      testConfig = env.testConfig;
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
      connection.reset();
    }
  });

  async function ensurePackageDoesNotExist(testCase: any): Promise<boolean> {
    if (!connection || !hasConfig) {
      return false;
    }
    try {
      await getPackage(connection, testCase.params.package_name);
      logger.debug(`Package ${testCase.params.package_name} exists, skipping creation test`);
      return false; // Package exists, cannot test creation
    } catch (error: any) {
      if (error.response?.status === 404 || error.response?.status === 401) {
        logger.debug(`Package ${testCase.params.package_name} does not exist`);
        return true;
      }
      throw error;
    }
  }

  it('should create basic package', async () => {
    if (!hasConfig || !connection) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('create_package');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    try {
      validateTestCaseForUserSpace(testCase, 'create_package');
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: ${error.message}`);
      return;
    }

    const canProceed = await ensurePackageDoesNotExist(testCase);
    if (!canProceed) {
      logger.warn(`⚠️ Skipping test: Package ${testCase.params.package_name} already exists`);
      return;
    }

    await createPackage(connection, {
      package_name: testCase.params.package_name,
      description: testCase.params.description || `Test package for ${testCase.params.package_name}`,
      package_type: testCase.params.package_type || 'development',
      super_package: testCase.params.super_package
    });

    const result = await getPackage(connection, testCase.params.package_name);
    expect(result.status).toBe(200);
  }, 60000);
});


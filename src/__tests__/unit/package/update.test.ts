/**
 * Unit test for Package update
 * Tests updatePackage function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/package/update.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';
import { updatePackage } from '../../../core/package/update';
import { getPackage } from '../../../core/package/read';
import { createPackage } from '../../../core/package/create';
import { lockPackage } from '../../../core/package/lock';
import { unlockPackage } from '../../../core/package/unlock';
import { generateSessionId } from '../../../utils/sessionUtils';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');


const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};

describe('Package - Update', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let sessionId: string | null = null;
  let testConfig: any = null;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      const env = await setupTestEnvironment(connection, '${module}_update', __filename);
      sessionId = env.sessionId;
      testConfig = env.testConfig;
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

  async function ensurePackageExists(testCase: any) {
    const packageName = testCase.params.package_name;

    try {
      await getPackage(connection, packageName);
      logger.debug(`Package ${packageName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Package ${packageName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_package');
        if (createTestCase) {
          try {
            await createPackage(connection, {
              package_name: packageName,
              super_package: createTestCase.params.super_package || getDefaultPackage(),
              description: createTestCase.params.description || `Test package for ${packageName}`,
              package_type: createTestCase.params.package_type || 'development',
              transport_request: createTestCase.params.transport_request || getDefaultTransport()
            });
            logger.debug(`Package ${packageName} created successfully`);
          } catch (createError: any) {
            throw createError;
          }
        } else {
          throw new Error(`Cannot create package ${packageName}: create_package test case not found`);
        }
      } else {
        throw error;
      }
    }
  }

  it('should update package', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('update_package');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    try {
      validateTestCaseForUserSpace(testCase, 'update_package');
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: ${error.message}`);
      return;
    }

    await ensurePackageExists(testCase);

    const sessionId = generateSessionId();
    const lockHandle = await lockPackage(connection, testCase.params.package_name, sessionId);

    try {
      await updatePackage(connection, {
        package_name: testCase.params.package_name,
        super_package: testCase.params.super_package || getDefaultPackage(),
        description: testCase.params.description,
        package_type: testCase.params.package_type || 'development',
        transport_request: testCase.params.transport_request || getDefaultTransport()
      }, lockHandle, sessionId);

      // Verify update by reading
      const result = await getPackage(connection, testCase.params.package_name);
      expect(result.status).toBe(200);
    } finally {
      // Unlock after test
      try {
        await unlockPackage(connection, testCase.params.package_name, lockHandle, sessionId);
      } catch (error) {
        // Ignore unlock errors
      }
    }
  }, 60000);
});


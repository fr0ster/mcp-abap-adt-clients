/**
 * Unit test for Package unlocking
 * Tests unlockPackage function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/package/unlock.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { lockPackage } from '../../../core/package/lock';
import { unlockPackage } from '../../../core/package/unlock';
import { getPackage } from '../../../core/package/read';
import { createPackage } from '../../../core/package/create';
import { generateSessionId } from '../../../utils/sessionUtils';
import { getConfig } from '../../helpers/sessionConfig';
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
  warn: console.warn,
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};

describe('Package - Unlock', () => {
  let connection: AbapConnection;
  let hasConfig = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      hasConfig = true;
    } catch (error) {
      logger.warn('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterAll(async () => {
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

  it('should unlock package', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('unlock_package');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    try {
      validateTestCaseForUserSpace(testCase, 'unlock_package');
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: ${error.message}`);
      return;
    }

    await ensurePackageExists(testCase);

    const sessionId = generateSessionId();

    // First lock the package to get a lock handle
    const lockHandle = await lockPackage(
      connection,
      testCase.params.package_name,
      sessionId
    );

    expect(lockHandle).toBeDefined();

    // Now unlock it
    const response = await unlockPackage(
      connection,
      testCase.params.package_name,
      lockHandle,
      sessionId
    );

    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(500);
  }, 30000);
});


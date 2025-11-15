/**
 * Unit test for FunctionGroup activation
 * Tests activateFunctionGroup function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/functionGroup/activate.test
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { activateFunctionGroup } from '../../../core/functionGroup/activation';
import { getFunctionGroup } from '../../../core/functionGroup/read';
import { createFunctionGroup } from '../../../core/functionGroup/create';
import { getConfig } from '../../helpers/sessionConfig';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage } = require('../../../../tests/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger: ILogger = {
  debug: debugEnabled ? (message: string, meta?: any) => console.log(message, meta) : () => {},
  info: debugEnabled ? (message: string, meta?: any) => console.log(message, meta) : () => {},
  warn: (message: string, meta?: any) => console.warn(message, meta),
  error: debugEnabled ? (message: string, meta?: any) => console.error(message, meta) : () => {},
  csrfToken: debugEnabled ? (action: string, token?: string) => console.log(`CSRF ${action}:`, token) : () => {},
};

describe('FunctionGroup - Activate', () => {
  let connection: AbapConnection;
  let hasConfig = false;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      hasConfig = true;
    } catch (error) {
      logger.warn('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterEach(async () => {
    if (connection) {
      connection.reset();
    }
  });

  // Helper function to ensure object exists before test (idempotency)
  async function ensureFunctionGroupExists(testCase: any) {
    const functionGroupName = testCase.params.function_group_name;
    const isUserFunctionGroup = functionGroupName && (functionGroupName.toUpperCase().startsWith('Z') || functionGroupName.toUpperCase().startsWith('Y'));

    try {
      await getFunctionGroup(connection, functionGroupName);
      logger.debug(`Function group ${functionGroupName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        if (!isUserFunctionGroup) {
          logger.warn(`⚠️ Skipping test: Function group ${functionGroupName} is a standard SAP function group and cannot be created`);
          throw new Error(`Standard SAP function group ${functionGroupName} does not exist and cannot be created`);
        }

        logger.debug(`Function group ${functionGroupName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_function_group');
        if (createTestCase) {
          try {
            await createFunctionGroup(connection, {
              function_group_name: functionGroupName,
              description: createTestCase.params.description || `Test function group for ${functionGroupName}`,
              package_name: createTestCase.params.package_name || getDefaultPackage(),
              transport_request: createTestCase.params.transport_request,
            });
            logger.debug(`Function group ${functionGroupName} created successfully`);
          } catch (createError: any) {
            throw createError;
          }
        } else {
          throw new Error(`Cannot create function group ${functionGroupName}: create_function_group test case not found`);
        }
      } else {
        throw error;
      }
    }
  }

  it('should activate function group', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('activate_function_group');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    try {
      validateTestCaseForUserSpace(testCase, 'activate_function_group');
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: ${error.message}`);
      return;
    }

    await ensureFunctionGroupExists(testCase);

    const response = await activateFunctionGroup(
      connection,
      testCase.params.function_group_name
    );
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(500);
  }, 30000);
});


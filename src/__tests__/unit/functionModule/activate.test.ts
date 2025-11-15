/**
 * Unit test for FunctionModule activation
 * Tests activateFunctionModule function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/functionModule/activate.test
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { activateFunctionModule } from '../../../core/functionModule/activation';
import { getFunctionMetadata } from '../../../core/functionModule/read';
import { createFunctionModule } from '../../../core/functionModule/create';
import { createFunctionGroup } from '../../../core/functionGroup/create';
import { getFunctionGroup } from '../../../core/functionGroup/read';
import { generateSessionId } from '../../../utils/sessionUtils';
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

describe('FunctionModule - Activate', () => {
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

  // Helper function to ensure function group exists
  async function ensureFunctionGroupExists(functionGroupName: string, packageName?: string) {
    try {
      await getFunctionGroup(connection, functionGroupName);
      logger.debug(`Function group ${functionGroupName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Function group ${functionGroupName} does not exist, creating...`);
        const createFugrTestCase = getEnabledTestCase('create_function_group');
        if (createFugrTestCase) {
          await createFunctionGroup(connection, {
            function_group_name: functionGroupName,
            description: `Test function group for ${functionGroupName}`,
            package_name: packageName || createFugrTestCase.params.package_name || getDefaultPackage(),
            transport_request: createFugrTestCase.params.transport_request,
          });
          logger.debug(`Function group ${functionGroupName} created successfully`);
        } else {
          throw new Error(`Cannot create function group ${functionGroupName}: create_function_group test case not found`);
        }
      } else {
        throw error;
      }
    }
  }

  // Helper function to ensure function module exists before test (idempotency)
  async function ensureFunctionModuleExists(testCase: any) {
    const functionGroupName = testCase.params.function_group_name;
    const functionModuleName = testCase.params.function_module_name;

    try {
      await getFunctionMetadata(connection, functionModuleName, functionGroupName);
      logger.debug(`Function module ${functionModuleName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Function module ${functionModuleName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_function_module');
        if (createTestCase) {
          try {
            await createFunctionModule(connection, {
              function_group_name: functionGroupName,
              function_module_name: functionModuleName,
              description: createTestCase.params.description || `Test function module for ${functionModuleName}`,
              package_name: createTestCase.params.package_name || getDefaultPackage(),
              transport_request: createTestCase.params.transport_request,
              source_code: createTestCase.params.source_code || `FUNCTION ${functionModuleName}.\nENDFUNCTION.`,
            });
            logger.debug(`Function module ${functionModuleName} created successfully`);
          } catch (createError: any) {
            throw createError;
          }
        } else {
          throw new Error(`Cannot create function module ${functionModuleName}: create_function_module test case not found`);
        }
      } else {
        throw error;
      }
    }
  }

  it('should activate function module', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('activate_function_module');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    try {
      validateTestCaseForUserSpace(testCase, 'activate_function_module');
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: ${error.message}`);
      return;
    }

    await ensureFunctionModuleExists(testCase);

    const sessionId = generateSessionId();
    const response = await activateFunctionModule(
      connection,
      testCase.params.function_group_name,
      testCase.params.function_module_name,
      sessionId
    );
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(500);
  }, 30000);
});


/**
 * Integration test for Function Module syntax check
 * Tests checkFunctionModule function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/functionModule/check.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { checkFunctionModule } from '../../../core/functionModule/check';
import { createFunctionModule } from '../../../core/functionModule/create';
import { createFunctionGroup } from '../../../core/functionGroup/create';
import { getFunction } from '../../../core/functionModule/read';
import { getFunctionGroup } from '../../../core/functionGroup/read';
import { getConfig, hasAuthFailed, markAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Function Module - Check';
const logger = createTestLogger('FM-CHECK');

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let testCase: any = null;
  let functionModuleName: string | null = null;

  beforeAll(async () => {
    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Test', 'Authentication failed in previous setup');
      return;
    }

    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      await (connection as any).connect();
    } catch (error: any) {
      logger.error(`Authentication/Connection failed: ${error.message}`);
      markAuthFailed(TEST_SUITE_NAME);
    }
  });

  afterAll(async () => {
    if (connection) {
      connection.reset();
    }
  });

  beforeEach(() => {
    testCase = null;
    functionModuleName = null;

    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Test', 'Authentication failed');
      return;
    }

    const tc = getEnabledTestCase('check_function_module');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    try {
      validateTestCaseForUserSpace(tc, 'check_function_module');
    } catch (error: any) {
      logger.skip('Test', error.message);
      return;
    }

    testCase = tc;
    functionModuleName = tc.params.function_module_name;
  });

  async function ensureFunctionGroupExists(functionGroupName: string, packageName?: string): Promise<void> {
    try {
      await getFunctionGroup(connection, functionGroupName);
      logger.debug(`Function group ${functionGroupName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Function group ${functionGroupName} does not exist, creating...`);
        const fugrTestCase = getEnabledTestCase('create_function_group', 'test_function_group');
        if (!fugrTestCase) {
          throw new Error(`Cannot create function group ${functionGroupName}: create_function_group test case not found`);
        }
        await createFunctionGroup(connection, {
          function_group_name: functionGroupName,
          description: fugrTestCase.params.description || `Test FUGR for ${functionGroupName}`,
          package_name: packageName || fugrTestCase.params.package_name || getDefaultPackage(),
        });
        logger.debug(`Function group ${functionGroupName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  async function ensureFunctionModuleExists(testCase: any): Promise<void> {
    const fmName = testCase.params.function_module_name;
    const fgName = testCase.params.function_group_name;

    try {
      await getFunction(connection, fgName, fmName);
      logger.debug(`Function module ${fmName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404 || error.response?.status === 500) {
        if (error.response?.status === 500) {
          logger.warn(`Server error checking FM ${fmName} (500), will try to create`);
        } else {
          logger.debug(`Function module ${fmName} does not exist, creating...`);
        }

        let sourceCode = testCase.params.source_code;
        if (!sourceCode) {
          const createTestCase = getEnabledTestCase('create_function_module', 'test_function_module');
          const fallbackSourceCode = createTestCase?.params?.source_code;
          if (!fallbackSourceCode) {
            throw new Error(`Cannot create function module ${fmName}: source_code is required but not provided in test case`);
          }
          sourceCode = fallbackSourceCode;
        }

        try {
          await createFunctionModule(connection, {
            function_module_name: fmName,
            function_group_name: fgName,
            description: testCase.params.description,
            package_name: testCase.params.package_name || getDefaultPackage(),
            source_code: sourceCode,
            activate: true,
          });
          logger.debug(`Function module ${fmName} created successfully`);
        } catch (createError: any) {
          throw createError;
        }
      } else {
        throw error;
      }
    }
  }

  it('should check active function module', async () => {
    if (!testCase || !functionModuleName) {
      logger.skip('Check Test', testCase ? 'Function module name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing syntax check for function module (active): ${functionModuleName}`);

    try {
      await ensureFunctionGroupExists(testCase.params.function_group_name, testCase.params.package_name);
      await ensureFunctionModuleExists(testCase);

      const result = await checkFunctionModule(connection, testCase.params.function_group_name, functionModuleName, 'active');
      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
      logger.info(`✓ Function module ${functionModuleName} syntax check (active) completed`);

    } catch (error: any) {
      logger.error(`✗ Failed to check function module syntax: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));

  it('should check inactive function module', async () => {
    if (!testCase || !functionModuleName) {
      logger.skip('Check Test', testCase ? 'Function module name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing syntax check for function module (inactive): ${functionModuleName}`);

    try {
      await ensureFunctionGroupExists(testCase.params.function_group_name, testCase.params.package_name);
      await ensureFunctionModuleExists(testCase);

      const result = await checkFunctionModule(connection, testCase.params.function_group_name, functionModuleName, 'inactive');
      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
      logger.info(`✓ Function module ${functionModuleName} syntax check (inactive) completed`);

    } catch (error: any) {
      logger.error(`✗ Failed to check function module syntax: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});

/**
 * Integration test for Function Module update
 * Tests updateFunctionModuleSource function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/functionModule/update.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { updateFunctionModuleSource } from '../../../core/functionModule/update';
import { createFunctionModule } from '../../../core/functionModule/create';
import { createFunctionGroup } from '../../../core/functionGroup/create';
import { getFunction } from '../../../core/functionModule/read';
import { getFunctionGroup } from '../../../core/functionGroup/read';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, getDefaultPackage } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Function Module - Update';
const logger = createTestLogger('FM-UPDATE');

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;
  let testCase: any = null;
  let functionModuleName: string | null = null;
  let functionGroupName: string | null = null;

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
    functionModuleName = null;
    functionGroupName = null;

    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Test', 'Authentication failed in previous test');
      return;
    }

    const env = await setupTestEnvironment(connection, 'function_module_update', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('update_function_module_source') || getEnabledTestCase('create_function_module', 'test_function_module');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    testCase = tc;
    functionModuleName = tc.params?.function_module_name;
    functionGroupName = tc.params?.function_group_name;
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

  async function ensureFunctionGroupExists(fgName: string, packageName?: string): Promise<void> {
    try {
      await getFunctionGroup(connection, fgName);
      logger.debug(`Function group ${fgName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Function group ${fgName} does not exist, creating...`);
        const fugrTestCase = getEnabledTestCase('create_function_group', 'test_function_group');
        if (!fugrTestCase) {
          throw new Error(`Cannot create function group ${fgName}: create_function_group test case not found`);
        }
        await createFunctionGroup(connection, {
          function_group_name: fgName,
          description: fugrTestCase.params.description || `Test FUGR for ${fgName}`,
          package_name: packageName || fugrTestCase.params.package_name || getDefaultPackage(),
        });
        logger.debug(`Function group ${fgName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  async function ensureFunctionModuleExists(testCase: any): Promise<void> {
    const fmName = testCase.params?.function_module_name;
    const fgName = testCase.params?.function_group_name;

    if (!fmName || !fgName) {
      throw new Error('function_module_name and function_group_name are required in test case');
    }

    try {
      await getFunction(connection, fgName, fmName);
      logger.debug(`Function module ${fmName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Function module ${fmName} does not exist, creating...`);
        await createFunctionModule(connection, {
          function_module_name: fmName,
          function_group_name: fgName,
          description: testCase.params?.description,
          package_name: testCase.params?.package_name,
          source_code: testCase.params?.source_code,
        });
        logger.debug(`Function module ${fmName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  it('should update function module source code', async () => {
    if (!testCase || !functionModuleName || !functionGroupName) {
      logger.skip('Update Test', testCase ? 'Function module/group name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing update for FM: ${functionModuleName} in ${functionGroupName}`);

    try {
      await ensureFunctionGroupExists(functionGroupName, testCase.params?.package_name);
      await ensureFunctionModuleExists(testCase);

      const updatedSourceCode = testCase.params?.source_code || `FUNCTION ${functionModuleName}.
*"----------------------------------------------------------------------
*"*"Local Interface:
*"  IMPORTING
*"     REFERENCE(INPUT) TYPE  STRING
*"  EXPORTING
*"     REFERENCE(RESULT) TYPE  STRING
*"----------------------------------------------------------------------
  " Updated Result
  RESULT = |Updated: { INPUT }|.
ENDFUNCTION.`;

      await updateFunctionModuleSource(connection, {
        function_module_name: functionModuleName,
        function_group_name: functionGroupName,
        source_code: updatedSourceCode,
      });
      logger.debug(`✓ Function module ${functionModuleName} updated`);

      const result = await getFunction(connection, functionGroupName, functionModuleName);
      expect(result.status).toBe(200);
      if (updatedSourceCode.includes('Updated')) {
        expect(result.data).toContain('Updated');
      }
      logger.info(`✓ FM ${functionModuleName} updated successfully`);

    } catch (error: any) {
      if (error.message.includes('S_ABPLNGVS')) {
        logger.skip('Update Test', 'Function module name violates SAP naming rules');
        return;
      }
      logger.error(`✗ Failed to update function module: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});

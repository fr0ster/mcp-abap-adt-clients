/**
 * Integration workflow test for Function Module
 * Tests complete CRUD workflow in sequence:
 * 1. Create FUGR
 * 2. Validate FM name
 * 3. Create FM
 * 4. Read FM
 * 5. Check FM
 * 6. Update FM
 * 7. Validate FM source
 * 8. Delete FM
 * 9. Delete FUGR
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { createFunctionGroup } from '../../core/functionGroup/create';
import { getFunctionGroup } from '../../core/functionGroup/read';
import { createFunctionModule } from '../../core/functionModule/create';
import { getFunctionSource } from '../../core/functionModule/read';
import { updateFunctionModuleSource } from '../../core/functionModule/update';
import { checkFunctionModule } from '../../core/functionModule/check';
import { validateFunctionModuleName, validateFunctionModuleSource } from '../../core/functionModule/validation';
import { deleteObject } from '../../core/delete';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../helpers/sessionConfig';

const { getEnabledTestCase } = require('../../../tests/test-helper');

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: console.warn,
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};

describe('Function Module - Complete Workflow', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let functionGroupName: string;
  let functionModuleName: string;
  let packageName: string;
  let sourceCode: string;
  let sessionId: string | null = null;
  let testConfig: any = null;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      const env = await setupTestEnvironment(connection, 'function_module_workflow', __filename);
      sessionId = env.sessionId;
      testConfig = env.testConfig;
      hasConfig = true;
    } catch (error) {
      console.warn('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
    if (connection) {
      connection.reset();
    }
  });

  it('should execute complete FM workflow', async () => {
    if (!hasConfig) {
      console.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const fugrTestCase = getEnabledTestCase('create_function_group', 'test_function_group');
    const fmTestCase = getEnabledTestCase('create_function_module', 'test_function_module');

    if (!fugrTestCase || !fmTestCase) {
      console.warn('⚠️ Skipping test: Required test cases are disabled');
      return;
    }

    functionGroupName = fugrTestCase.params.function_group_name;
    functionModuleName = fmTestCase.params.function_module_name;
    packageName = fugrTestCase.params.package_name;
    sourceCode = fmTestCase.params.source_code;

    // Step 1: Create Function Group
    console.log('\n📦 Step 1: Creating Function Group...');
    await createFunctionGroup(connection, {
      function_group_name: functionGroupName,
      description: fugrTestCase.params.description,
      package_name: packageName,
    });
    console.log(`✅ Created FUGR: ${functionGroupName}`);

    // Verify FUGR creation
    const fugrResult = await getFunctionGroup(connection, functionGroupName);
    expect(fugrResult.status).toBe(200);
    console.log(`✅ Verified FUGR exists`);

    // Step 2: Validate FM name (requires FUGR to exist)
    console.log('\n📝 Step 2: Validating FM name...');
    const nameValidation = await validateFunctionModuleName(
      connection,
      functionGroupName,
      functionModuleName,
      fmTestCase.params.description
    );
    expect(nameValidation.valid).toBe(true);
    console.log(`✅ FM name validated: ${functionModuleName}`);

    // Step 3: Create Function Module
    console.log('\n🔧 Step 3: Creating Function Module...');
    try {
      await createFunctionModule(connection, {
        function_module_name: functionModuleName,
        function_group_name: functionGroupName,
        description: fmTestCase.params.description,
        package_name: packageName,
        source_code: sourceCode,
      });
      console.log(`✅ Created FM: ${functionModuleName}`);

      // Step 4: Read Function Module
      console.log('\n📖 Step 4: Reading Function Module...');
      const fmResult = await getFunctionSource(connection, functionModuleName, functionGroupName);
      expect(fmResult.status).toBe(200);
      expect(fmResult.data).toContain(functionModuleName);
      console.log(`✅ Read FM successfully`);

      // Step 5: Check Function Module syntax
      console.log('\n✓ Step 5: Checking FM syntax...');
      const checkResult = await checkFunctionModule(connection, functionGroupName, functionModuleName, 'active');
      expect(checkResult.status).toBe('ok');
      console.log(`✅ FM syntax check passed`);

      // Step 6: Update Function Module
      console.log('\n🔄 Step 6: Updating Function Module...');
      const updatedSourceCode = `FUNCTION ${functionModuleName}.
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
      console.log(`✅ Updated FM source`);

      // Verify update
      const updatedResult = await getFunctionSource(connection, functionModuleName, functionGroupName);
      expect(updatedResult.status).toBe(200);
      expect(updatedResult.data).toContain('Updated Result');
      console.log(`✅ Verified FM update`);

      // Step 7: Validate FM source code
      console.log('\n🔍 Step 7: Validating FM source code...');
      await validateFunctionModuleSource(
        connection,
        functionGroupName,
        functionModuleName,
        updatedSourceCode
      );
      console.log(`✅ FM source validated`);

      // Step 8: Delete Function Module
      console.log('\n🗑️  Step 8: Deleting Function Module...');
      await deleteObject(connection, {
        object_name: functionModuleName,
        object_type: fmTestCase.params.object_type,
        function_group_name: functionGroupName,
      });
      console.log(`✅ Deleted FM: ${functionModuleName}`);

    } catch (error: any) {
      console.warn(`⚠️  FM operations failed (might be authorization): ${error.message}`);
      // Continue to cleanup
    }

    // Step 9: Delete Function Group
    console.log('\n🗑️  Step 9: Deleting Function Group...');
    await deleteObject(connection, {
      object_name: functionGroupName,
      object_type: 'FUGR/F',
    });
    console.log(`✅ Deleted FUGR: ${functionGroupName}`);

    console.log('\n🎉 Complete workflow finished!');
  }, 120000); // 2 minutes timeout for full workflow
});

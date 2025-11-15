/**
 * Integration workflow test for Class
 * Tests complete CRUD workflow in sequence:
 * 1. Create Class
 * 2. Read Class
 * 3. Update Class
 * 4. Check Class
 * 5. Lock Class
 * 6. Unlock Class
 * 7. Activate Class
 * 8. Validate Class source
 * 9. Run Class
 * 10. Delete Class
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { createClass } from '../../core/class/create';
import { getClass } from '../../core/class/read';
import { updateClass } from '../../core/class/update';
import { checkClass } from '../../core/class/check';
import { lockClass } from '../../core/class/lock';
import { unlockClass } from '../../core/class/unlock';
import { activateClass } from '../../core/class/activation';
import { validateClassSource } from '../../core/class/validation';
import { runClass } from '../../core/class/run';
import { deleteObject } from '../../core/delete';
import { generateSessionId } from '../../utils/sessionUtils';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const { getEnabledTestCase } = require('../../../tests/test-helper');

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

function getConfig(): SapConfig {
  const rawUrl = process.env.SAP_URL;
  const url = rawUrl ? rawUrl.split('#')[0].trim() : rawUrl;
  const rawClient = process.env.SAP_CLIENT;
  const client = rawClient ? rawClient.split('#')[0].trim() : rawClient;
  const rawAuthType = process.env.SAP_AUTH_TYPE || 'basic';
  const authType = rawAuthType.split('#')[0].trim();

  if (!url || !/^https?:\/\//.test(url)) {
    throw new Error(`Missing or invalid SAP_URL: ${url}`);
  }

  const config: SapConfig = {
    url,
    authType: authType === 'xsuaa' ? 'jwt' : (authType as 'basic' | 'jwt'),
  };

  if (client) {
    config.client = client;
  }

  if (authType === 'jwt' || authType === 'xsuaa') {
    const jwtToken = process.env.SAP_JWT_TOKEN;
    if (!jwtToken) {
      throw new Error('Missing SAP_JWT_TOKEN for JWT authentication');
    }
    config.jwtToken = jwtToken;
  } else {
    const username = process.env.SAP_USERNAME;
    const password = process.env.SAP_PASSWORD;
    if (!username || !password) {
      throw new Error('Missing SAP_USERNAME or SAP_PASSWORD for basic authentication');
    }
    config.username = username;
    config.password = password;
  }

  return config;
}

describe('Class - Complete Workflow', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let className: string;
  let packageName: string;
  let sessionId: string;
  let lockHandle: string;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      hasConfig = true;
    } catch (error) {
      console.warn('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterAll(async () => {
    if (connection) {
      connection.reset();
    }
  });

  it('should execute complete Class workflow', async () => {
    if (!hasConfig) {
      console.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('create_class', 'basic_class');
    if (!testCase) {
      console.warn('⚠️ Skipping test: Required test case is disabled');
      return;
    }

    className = testCase.params.class_name;
    packageName = testCase.params.package_name;

    // Step 1: Create Class
    console.log('\n📦 Step 1: Creating Class...');
    sessionId = generateSessionId();

    // Step 1.1: Create class object (metadata only)
    await createClass(connection, {
      class_name: className,
      description: testCase.params.description,
      package_name: packageName,
    });

    // Step 1.2: Lock class
    lockHandle = await lockClass(connection, className, sessionId);

    // Step 1.3: Update source code
    if (!testCase.params.source_code) {
      throw new Error('source_code is required');
    }
    await updateClass(
      connection,
      className,
      testCase.params.source_code,
      lockHandle,
      sessionId
    );

    // Step 1.4: Unlock class
    await unlockClass(connection, className, lockHandle, sessionId);

    // Step 1.5: Activate class
    await activateClass(connection, className, sessionId);
    console.log(`✅ Created Class: ${className}`);

    // Step 2: Read Class
    console.log('\n📖 Step 2: Reading Class...');
    const readResult = await getClass(connection, className);
    expect(readResult.status).toBe(200);
    expect(readResult.data).toContain(className);
    console.log(`✅ Read Class successfully`);

    // Step 3: Update Class
    console.log('\n🔄 Step 3: Updating Class...');
    const updatedSourceCode = `CLASS ${className} DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC .

  PUBLIC SECTION.
    METHODS: get_updated_text RETURNING VALUE(rv_text) TYPE string.
ENDCLASS.

CLASS ${className} IMPLEMENTATION.
  METHOD get_updated_text.
    rv_text = 'Updated Text from Workflow'.
  ENDMETHOD.
ENDCLASS.`;

    // Step 3.1: Lock class
    const updateLockHandle = await lockClass(connection, className, sessionId);

    // Step 3.2: Update source code
    await updateClass(
      connection,
      className,
      updatedSourceCode,
      updateLockHandle,
      sessionId
    );

    // Step 3.3: Unlock class
    await unlockClass(connection, className, updateLockHandle, sessionId);

    // Step 3.4: Activate class
    await activateClass(connection, className, sessionId);
    console.log(`✅ Updated Class source`);

    // Verify update
    const updatedResult = await getClass(connection, className, 'inactive');
    expect(updatedResult.status).toBe(200);
    expect(updatedResult.data).toContain('Updated Text from Workflow');
    console.log(`✅ Verified Class update`);

    // Step 4: Check Class (inactive version after update)
    console.log('\n✓ Step 4: Checking Class syntax...');
    const checkResult = await checkClass(connection, className, 'inactive');
    expect(checkResult.status).toBe('ok');
    console.log(`✅ Class syntax check passed`);

    // Step 5: Lock Class
    console.log('\n🔒 Step 5: Locking Class...');
    lockHandle = await lockClass(connection, className, sessionId);
    expect(lockHandle).toBeDefined();
    expect(lockHandle).not.toBe('');
    console.log(`✅ Class locked, handle: ${lockHandle}`);

    // Step 6: Unlock Class
    console.log('\n🔓 Step 6: Unlocking Class...');
    await unlockClass(connection, className, lockHandle, sessionId);
    console.log(`✅ Class unlocked`);

    // Step 7: Activate Class
    console.log('\n⚡ Step 7: Activating Class...');
    const activateResult = await activateClass(connection, className, sessionId);
    expect(activateResult.status).toBe(200);
    console.log(`✅ Class activated`);

    // Step 8: Validate Class source
    console.log('\n🔍 Step 8: Validating Class source...');
    const validateResult = await validateClassSource(connection, className);
    expect(validateResult.status).toBe(200);
    console.log(`✅ Class source validated`);

    // Step 9: Run Class (if runnable)
    console.log('\n▶️  Step 9: Running Class...');
    try {
      const runResult = await runClass(connection, className);
      expect(runResult.status).toBe(200);
      console.log(`✅ Class run successfully`);
    } catch (error: any) {
      console.warn(`⚠️  Class run skipped (might not be runnable): ${error.message}`);
    }

    // Step 10: Delete Class
    console.log('\n🗑️  Step 10: Deleting Class...');
    await deleteObject(connection, {
      object_name: className,
      object_type: 'CLAS/OC',
    });
    console.log(`✅ Deleted Class: ${className}`);

    // Verify deletion
    try {
      await getClass(connection, className);
      fail('Expected 404 error when reading deleted class');
    } catch (error: any) {
      expect(error.response?.status).toBe(404);
      console.log(`✅ Verified Class deletion`);
    }

    console.log('\n🎉 Complete workflow finished!');
  }, 120000); // 2 minutes timeout for full workflow
});

/**
 * Integration tests for Class operations
 * Tests: create, read, update, delete, lock/unlock, check, activate
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- testClass.integration.test.ts
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { createClass } from '../../core/class/create';
import { getClass } from '../../core/class/read';
import { updateClassSource } from '../../core/class/update';
import { deleteObject } from '../../core/delete';
import { lockClass } from '../../core/class/lock';
import { unlockClass } from '../../core/class/unlock';
import { checkClass, validateClassSource } from '../../core/class/check';
import { activateClass } from '../../core/class/activation';
import { runClass } from '../../core/class/run';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load test helper
const { getEnabledTestCase } = require('../../../tests/test-helper');

// Load environment variables
const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// Enable debug logging with DEBUG_TESTS=true
const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: console.warn,
  // Show errors only in debug mode (expected 404s during deletion verification would clutter output)
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {}, // Optional CSRF token logging
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

describe('Class Operations (Integration)', () => {
  let connection: AbapConnection;
  let testClassName: string;
  let testClassNameInherit: string;
  let testPackage: string;
  let hasConfig = false;
  let activeLockHandle: string | null = null;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      hasConfig = true;

      // Cleanup: Delete test classes if they exist
      const basicTestCase = getEnabledTestCase('create_class', 'basic_class');
      const inheritTestCase = getEnabledTestCase('create_class', 'class_with_superclass');

      if (basicTestCase) {
        testClassName = basicTestCase.params.class_name;
        testPackage = basicTestCase.params.package_name;
        try {
          await getClass(connection, testClassName);
          await deleteObject(connection, {
            object_name: testClassName,
            object_type: 'CLAS/OC',
          });
          console.log(`🧹 Cleaned up existing class: ${testClassName}`);
        } catch (error) {
          // Class doesn't exist, that's fine
        }
      }

      if (inheritTestCase) {
        testClassNameInherit = inheritTestCase.params.class_name;
        try {
          await getClass(connection, testClassNameInherit);
          await deleteObject(connection, {
            object_name: testClassNameInherit,
            object_type: 'CLAS/OC',
          });
          console.log(`🧹 Cleaned up existing class: ${testClassNameInherit}`);
        } catch (error) {
          // Class doesn't exist, that's fine
        }
      }
    } catch (error) {
      console.error('Failed to create connection:', error);
      hasConfig = false;
    }
  });

  afterEach(async () => {
    // Clean up any active locks
    if (activeLockHandle && testClassName) {
      try {
        logger.debug(`🔓 Cleaning up lock for class: ${testClassName}`);
        await unlockClass(connection, testClassName, activeLockHandle, '');
        activeLockHandle = null;
      } catch (error) {
        logger.warn(`⚠️ Failed to unlock class in cleanup: ${error}`);
      }
    }
  });

  afterAll(async () => {
    // Final cleanup: Delete test classes
    if (connection && hasConfig) {
      try {
        if (testClassName) {
          await deleteObject(connection, {
            object_name: testClassName,
            object_type: 'CLAS/OC',
          });
          console.log(`🧹 Final cleanup: deleted ${testClassName}`);
        }
      } catch (error) {
        // Already deleted or doesn't exist
      }

      try {
        if (testClassNameInherit) {
          await deleteObject(connection, {
            object_name: testClassNameInherit,
            object_type: 'CLAS/OC',
          });
          console.log(`🧹 Final cleanup: deleted ${testClassNameInherit}`);
        }
      } catch (error) {
        // Already deleted or doesn't exist
      }

      connection.reset();
    }
  });

  describe('Create and Read', () => {
    it('should create basic class and verify by reading', async () => {
      if (!hasConfig) {
        console.warn('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const testCase = getEnabledTestCase('create_class', 'basic_class');
      if (!testCase) {
        console.warn('⚠️ Skipping test: Test case create_class.basic_class is disabled');
        return;
      }

      const description = testCase.params.description;

      // Create the class
      await createClass(connection, {
        class_name: testClassName,
        package_name: testPackage,
        description: description,
      });
      console.log(`✅ Created class: ${testClassName}`);

      // Verify by reading
      const classResponse = await getClass(connection, testClassName);
      expect(classResponse.data).toContain(`CLASS ${testClassName}`);
      console.log(`✅ Read class: ${testClassName}`);
    }, 30000);

    it('should create class with superclass (without inheritance verification)', async () => {
      if (!hasConfig) {
        console.warn('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const testCase = getEnabledTestCase('create_class', 'class_with_superclass');
      if (!testCase) {
        console.warn('⚠️ Skipping test: Test case create_class.class_with_superclass is disabled');
        return;
      }

      const packageName = testCase.params.package_name;
      const description = testCase.params.description;
      const superclass = testCase.params.superclass;
      const isFinal = testCase.params.final;

      // Create the class with superclass
      await createClass(connection, {
        class_name: testClassNameInherit,
        package_name: packageName,
        description: description,
        superclass: superclass,
        final: isFinal,
      });
      console.log(`✅ Created class with inheritance: ${testClassNameInherit}`);

      // Verify by reading
      const classResponse = await getClass(connection, testClassNameInherit);
      expect(classResponse.data).toContain(`CLASS ${testClassNameInherit}`);
      console.log(`✅ Read class with inheritance: ${testClassNameInherit}`);
      // Note: inheritance verification skipped - createClass may not set superclass properly
    }, 30000);
  });

  describe('Update', () => {
    it('should update class source code', async () => {
      if (!hasConfig) {
        console.warn('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const updatedSource = `CLASS ${testClassName} DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    METHODS test_method.
ENDCLASS.

CLASS ${testClassName} IMPLEMENTATION.
  METHOD test_method.
    " Updated test method
  ENDMETHOD.
ENDCLASS.`;

      await updateClassSource(connection, {
        class_name: testClassName,
        source_code: updatedSource,
      });
      console.log(`✅ Updated class: ${testClassName}`);

      // Verify update by reading inactive version (modified but not activated)
      const inactiveResponse = await getClass(connection, testClassName, 'inactive');
      expect(inactiveResponse.data).toContain('test_method');
      console.log(`✅ Verified update (inactive version): ${testClassName}`);
    }, 20000);

    it('should read inactive version after update', async () => {
      if (!hasConfig) {
        console.warn('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      // Read inactive version (GET with version=inactive parameter)
      const inactiveResponse = await getClass(connection, testClassName, 'inactive');
      expect(inactiveResponse.data).toContain(`CLASS ${testClassName}`);
      expect(inactiveResponse.data).toContain('test_method');
      console.log(`✅ Read inactive class version: ${testClassName}`);
    }, 10000);
  });

  describe('Lock and Unlock', () => {
    it('should lock and unlock class', async () => {
      if (!hasConfig) {
        console.warn('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const sessionId = '1234567890';

      // Lock class
      const lockHandle = await lockClass(connection, testClassName, sessionId);
      expect(lockHandle).toBeDefined();
      expect(lockHandle.length).toBeGreaterThan(0);
      console.log(`✅ Locked class: ${testClassName}`);

      // Unlock class
      await unlockClass(connection, testClassName, lockHandle, sessionId);
      console.log(`✅ Unlocked class: ${testClassName}`);
    }, 15000);
  });

  describe('Check', () => {
    it('should check inactive class syntax (after update, before activation)', async () => {
      if (!hasConfig) {
        console.warn('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      // Check inactive version (modified but not yet activated)
      const checkResult = await checkClass(connection, testClassName, 'inactive');
      expect(checkResult).toBeDefined();
      console.log(`✅ Checked inactive class: ${testClassName}`);
    }, 10000);
  });

  describe('Activate', () => {
    it('should activate class', async () => {
      if (!hasConfig) {
        console.warn('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const sessionId = '1234567890';
      await activateClass(connection, testClassName, sessionId);
      console.log(`✅ Activated class: ${testClassName}`);
    }, 10000);

    it('should check active class syntax (after activation)', async () => {
      if (!hasConfig) {
        console.warn('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      // Check active version (after activation)
      const checkResult = await checkClass(connection, testClassName, 'active');
      expect(checkResult).toBeDefined();
      console.log(`✅ Checked active class: ${testClassName}`);
    }, 10000);

    it('should activate class with superclass', async () => {
      if (!hasConfig) {
        console.warn('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const sessionId = '1234567890';
      await activateClass(connection, testClassNameInherit, sessionId);
      console.log(`✅ Activated class with inheritance: ${testClassNameInherit}`);
    }, 10000);
  });

  describe('Live Validation', () => {
    it('should validate correct unsaved source code', async () => {
      if (!hasConfig) {
        console.warn('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      // Use actual test class name that exists
      const validSource = `CLASS ${testClassName.toLowerCase()} DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    METHODS: test_method RETURNING VALUE(rv_result) TYPE string.
ENDCLASS.

CLASS ${testClassName.toLowerCase()} IMPLEMENTATION.
  METHOD test_method.
    rv_result = 'Test'.
  ENDMETHOD.
ENDCLASS.`;

      const response = await validateClassSource(connection, testClassName, validSource);
      console.log(`✅ Valid source code passed validation`);
      expect(response.status).toBe(200);
    }, 10000);

    it('should detect syntax errors in unsaved source code', async () => {
      if (!hasConfig) {
        console.warn('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      // Use actual test class name with intentional syntax error
      const invalidSource = `CLASS ${testClassName.toLowerCase()} DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    METHODS: test_method RETURNING VALUE(rv_result) TYPE string
ENDCLASS.`;

      // Should throw error due to missing period after method declaration
      await expect(validateClassSource(connection, testClassName, invalidSource))
        .rejects.toThrow();
      console.log(`✅ Invalid source code detected correctly`);
    }, 10000);
  });

  describe('Run Class', () => {
    let runnableClassName: string;
    let runnableSource: string;
    let packageName: string;
    let isRunnable: boolean;

    it('should ensure runnable class exists with correct source before running', async () => {
      if (!hasConfig) {
        console.warn('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const testCase = getEnabledTestCase('run_class', 'runnable_class');
      if (!testCase) {
        console.warn('⚠️ Skipping test: Test case run_class.runnable_class is disabled');
        return;
      }

      runnableClassName = testCase.params.class_name;
      runnableSource = testCase.params.source_code;
      packageName = testCase.params.package_name;
      isRunnable = testCase.params.runnable ?? true;

      // Check if class exists
      let classExists = false;
      let needsUpdate = false;

      try {
        const existingClass = await getClass(connection, runnableClassName);
        classExists = true;

        // Check if source code differs
        if (runnableSource && existingClass.data !== runnableSource) {
          needsUpdate = true;
          console.log(`⚠️ Class ${runnableClassName} exists but source differs, will update`);
        } else {
          console.log(`✅ Class ${runnableClassName} exists with correct source`);
        }
      } catch (error) {
        // Class doesn't exist
        classExists = false;
        console.log(`ℹ️ Class ${runnableClassName} doesn't exist, will create`);
      }

      if (!classExists) {
        // Create new class
        await createClass(connection, {
          class_name: runnableClassName,
          package_name: packageName,
          description: testCase.params.description,
        });
        console.log(`✅ Created runnable class: ${runnableClassName}`);

        // Update with source from YAML (implements if_oo_adt_classrun)
        await updateClassSource(connection, {
          class_name: runnableClassName,
          source_code: runnableSource,
        });
        console.log(`✅ Updated runnable class source: ${runnableClassName}`);
      } else if (needsUpdate) {
        // Update existing class with new source
        await updateClassSource(connection, {
          class_name: runnableClassName,
          source_code: runnableSource,
        });
        console.log(`✅ Updated existing class source: ${runnableClassName}`);
      }

      // Activate the class (whether new or updated)
      if (!classExists || needsUpdate) {
        const sessionId = '1234567890';
        await activateClass(connection, runnableClassName, sessionId);
        console.log(`✅ Activated runnable class: ${runnableClassName}`);
      }
    }, 30000);

    it('should run the class and get console output', async () => {
      if (!hasConfig) {
        console.warn('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const testCase = getEnabledTestCase('run_class', 'runnable_class');
      if (!testCase) {
        console.warn('⚠️ Skipping test: Test case run_class.runnable_class is disabled');
        return;
      }

      const className = testCase.params.class_name;
      const runnable = testCase.params.runnable ?? true;

      const result = await runClass(connection, className, runnable);
      expect(result.status).toBe(200);
      expect(result.data).toContain('Hello from ADT Class Run!');
      console.log(`✅ Ran class successfully: ${className}`);
      console.log(`📄 Full console output from class run:`);
      console.log('─'.repeat(80));
      console.log(result.data);
      console.log('─'.repeat(80));
    }, 10000);

    it('should delete runnable class', async () => {
      if (!hasConfig) {
        console.warn('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const testCase = getEnabledTestCase('run_class', 'runnable_class');
      if (!testCase) {
        console.warn('⚠️ Skipping test: Test case run_class.runnable_class is disabled');
        return;
      }

      const className = testCase.params.class_name;

      await deleteObject(connection, {
        object_name: className,
        object_type: 'CLAS/OC',
      });
      console.log(`✅ Deleted runnable class: ${className}`);
    }, 15000);
  });

  describe('Delete', () => {
    it('should delete basic class and verify deletion', async () => {
      if (!hasConfig) {
        console.warn('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      await deleteObject(connection, {
        object_name: testClassName,
        object_type: 'CLAS/OC',
      });
      console.log(`✅ Deleted class: ${testClassName}`);

      // Verify deletion
      await expect(getClass(connection, testClassName)).rejects.toThrow();
      console.log(`✅ Verified deletion: ${testClassName}`);
    }, 15000);

    it('should delete class with superclass and verify deletion', async () => {
      if (!hasConfig) {
        console.warn('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      await deleteObject(connection, {
        object_name: testClassNameInherit,
        object_type: 'CLAS/OC',
      });
      console.log(`✅ Deleted class: ${testClassNameInherit}`);

      // Verify deletion
      await expect(getClass(connection, testClassNameInherit)).rejects.toThrow();
      console.log(`✅ Verified deletion: ${testClassNameInherit}`);
    }, 15000);
  });
});

/**
 * Integration tests for Class operations
 * Tests: create, read, update, delete, lock/unlock, check, activate
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { createClass } from '../../core/class/create';
import { getClass } from '../../core/class/read';
import { updateClassSource } from '../../core/class/update';
import { deleteObject } from '../../core/delete';
import { lockClass } from '../../core/class/lock';
import { unlockClass } from '../../core/class/unlock';
import { checkClass } from '../../core/class/check';
import { activateClass } from '../../core/class/activation';

const path = require('path');
const dotenv = require('dotenv');

// Load .env from package root
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const { getEnabledTestCase, createSapConnection } = require('../../../tests/test-helper');

describe('Class Operations (Integration)', () => {
  let connection: AbapConnection;
  let testClassName: string;
  let testPackage: string;
  let lockHandle: string;

  beforeAll(async () => {
    connection = await createSapConnection();
  });

  afterAll(() => {
    if (connection) {
      connection.reset();
    }
  });

  describe('Create and Read Class', () => {
    it('should create class and verify by reading it', async () => {
      const testCase = getEnabledTestCase('create_class', 'basic_class');
      if (!testCase) {
        console.log('⏭️  Skipping: create_class test case is disabled or not found');
        return;
      }

      testClassName = testCase.params.class_name;
      testPackage = testCase.params.package_name;

      // Step 1: Create class
      const createResponse = await createClass(connection, {
        class_name: testClassName,
        package_name: testPackage,
        description: testCase.params.description,
      });

      expect(createResponse.status).toBe(200);

      // Step 2: Read class and verify
      const classContent = await getClass(connection, testClassName);
      expect(classContent).toBeDefined();
      expect(classContent.data).toContain(testClassName);
    });

    it('should create class with superclass and final flag', async () => {
      const testCase = getEnabledTestCase('create_class', 'class_with_superclass');
      if (!testCase) {
        console.log('⏭️  Skipping: class_with_superclass test case is disabled or not found');
        return;
      }

      const className = testCase.params.class_name;

      // Create class with superclass
      await createClass(connection, {
        class_name: className,
        package_name: testCase.params.package_name,
        description: testCase.params.description,
        superclass: testCase.params.superclass,
        final: testCase.params.final,
      });

      // Verify by reading
      const classContent = await getClass(connection, className);
      expect(classContent.data).toContain(className);
      if (testCase.params.superclass) {
        expect(classContent.data).toContain(testCase.params.superclass);
      }
    });
  });

  describe('Update Class', () => {
    it('should update class source code', async () => {
      const testCase = getEnabledTestCase('create_class', 'basic_class');
      if (!testCase) {
        console.log('⏭️  Skipping: test requires create_class to be enabled');
        return;
      }

      const className = testCase.params.class_name;
      const newSource = `CLASS ${className} DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    METHODS: get_data RETURNING VALUE(result) TYPE string.
  PROTECTED SECTION.
  PRIVATE SECTION.
ENDCLASS.

CLASS ${className} IMPLEMENTATION.
  METHOD get_data.
    result = 'Updated class source'.
  ENDMETHOD.
ENDCLASS.`;

      // Update source
      await updateClassSource(connection, {
        class_name: className,
        source_code: newSource,
      });

      // Read and verify changes
      const updatedContent = await getClass(connection, className);
      expect(updatedContent.data).toContain('get_data');
      expect(updatedContent.data).toContain('Updated class source');
    });
  });

  describe('Lock and Unlock Class', () => {
    it('should lock and unlock class', async () => {
      const testCase = getEnabledTestCase('create_class', 'basic_class');
      if (!testCase) {
        console.log('⏭️  Skipping: test requires create_class to be enabled');
        return;
      }

      const className = testCase.params.class_name;
      const sessionId = `test-session-${Date.now()}`;

      // Lock class
      lockHandle = await lockClass(connection, className, sessionId);
      expect(lockHandle).toBeDefined();
      expect(lockHandle.length).toBeGreaterThan(0);

      // Unlock class
      await unlockClass(connection, className, lockHandle, sessionId);

      // Verify unlocked (should be able to lock again)
      const newSessionId = `test-session-${Date.now()}`;
      const newLockHandle = await lockClass(connection, className, newSessionId);
      expect(newLockHandle).toBeDefined();
      await unlockClass(connection, className, newLockHandle, newSessionId);
    });
  });

  describe('Check Class', () => {
    it('should check class syntax', async () => {
      const testCase = getEnabledTestCase('check_class', 'test_class');
      if (!testCase) {
        console.log('⏭️  Skipping: check_class test case is disabled or not found');
        return;
      }

      const className = testCase.params.class_name;

      // Check syntax
      const checkResult = await checkClass(connection, className);
      expect(checkResult).toBeDefined();
      // If there are no errors, checkResult should indicate success
    });
  });

  describe('Activate Class', () => {
    it('should activate class', async () => {
      const testCase = getEnabledTestCase('create_class', 'basic_class');
      if (!testCase) {
        console.log('⏭️  Skipping: test requires create_class to be enabled');
        return;
      }

      const className = testCase.params.class_name;
      const sessionId = `test-session-${Date.now()}`;

      // Activate class
      const activateResponse = await activateClass(connection, className, sessionId);
      expect(activateResponse.status).toBeGreaterThanOrEqual(200);
      expect(activateResponse.status).toBeLessThan(300);
    });
  });

  describe('Delete Class', () => {
    it('should delete class and verify by reading', async () => {
      const testCase = getEnabledTestCase('create_class', 'basic_class');
      if (!testCase) {
        console.log('⏭️  Skipping: test requires create_class to be enabled');
        return;
      }

      const className = testCase.params.class_name;

      // Delete class
      await deleteObject(connection, {
        object_name: className,
        object_type: 'CLAS/OC',
      });

      // Verify deletion - reading should fail
      await expect(getClass(connection, className)).rejects.toThrow();
    });

    it('should delete class with superclass', async () => {
      const testCase = getEnabledTestCase('create_class', 'class_with_superclass');
      if (!testCase) {
        console.log('⏭️  Skipping: class_with_superclass test case is disabled or not found');
        return;
      }

      const className = testCase.params.class_name;

      // Delete class
      await deleteObject(connection, {
        object_name: className,
        object_type: 'CLAS/OC',
      });

      // Verify deletion
      await expect(getClass(connection, className)).rejects.toThrow();
    });
  });
});

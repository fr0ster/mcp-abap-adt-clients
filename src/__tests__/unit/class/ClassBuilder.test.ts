/**
 * Unit test for ClassBuilder
 * Tests fluent API with Promise chaining, error handling, and result storage
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/class/ClassBuilder.test
 */

import { AbapConnection, createAbapConnection, SapConfig, ILogger } from '@mcp-abap-adt/connection';
import { ClassBuilder, ClassBuilderLogger } from '../../../core/class';
import { deleteObject } from '../../../core/delete';
import { validateClassName } from '../../../core/class/validation';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const { getEnabledTestCase, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const connectionLogger: ILogger = {
  debug: debugEnabled ? (message: string, meta?: any) => console.log(message, meta) : () => {},
  info: debugEnabled ? (message: string, meta?: any) => console.log(message, meta) : () => {},
  warn: (message: string, meta?: any) => console.warn(message, meta),
  error: debugEnabled ? (message: string, meta?: any) => console.error(message, meta) : () => {},
  csrfToken: debugEnabled ? (action: string, token?: string) => console.log(`CSRF ${action}:`, token) : () => {},
};

const builderLogger: ClassBuilderLogger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: console.warn || (() => {}),
  error: debugEnabled ? console.error : () => {},
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

describe('ClassBuilder', () => {
  let connection: AbapConnection;
  let hasConfig = false;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      hasConfig = true;
    } catch (error) {
      builderLogger.warn?.('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterEach(async () => {
    if (connection) {
      connection.reset();
    }
  });

  // Helper function to delete class if exists (idempotency)
  async function deleteClassIfExists(className: string, packageName: string): Promise<void> {
    if (!connection || !hasConfig) {
      return;
    }

    try {
      const validationResult = await validateClassName(connection, className, packageName);
      const classExistsError = !validationResult.valid && validationResult.message &&
        (validationResult.message.toLowerCase().includes('already exists') ||
         validationResult.message.toLowerCase().includes('does already exist') ||
         (validationResult.message.toLowerCase().includes('resource') && validationResult.message.toLowerCase().includes('exist')));

      if (classExistsError) {
        try {
          await deleteObject(connection, {
            object_name: className,
            object_type: 'CLAS/OC',
          });
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (deleteError) {
          // Ignore deletion errors
        }
      }
    } catch (error) {
      // Ignore validation errors
    }
  }

  describe('Builder methods', () => {
    it('should chain builder methods and store configuration', () => {
      if (!hasConfig) {
        builderLogger.warn?.('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const testCase = getEnabledTestCase('create_class', 'basic_class');
      if (!testCase) {
        builderLogger.warn?.('⚠️ Skipping test: Test case is disabled');
        return;
      }

      const className = testCase.params.class_name;
      const packageName = testCase.params.package_name || getDefaultPackage();
      const transportRequest = testCase.params.transport_request || getDefaultTransport();
      const description = testCase.params.description || 'Test description';
      const sourceCode = testCase.params.source_code || 'CLASS ' + className + ' DEFINITION PUBLIC FINAL CREATE PUBLIC. ENDCLASS.';

      const builder = new ClassBuilder(connection, builderLogger, {
        className,
      })
        .setPackage(packageName)
        .setRequest(transportRequest)
        .setName(className)
        .setCode(sourceCode)
        .setDescription(description);

      if (testCase.params.superclass) {
        builder.setSuperclass(testCase.params.superclass);
      }
      if (testCase.params.final !== undefined) {
        builder.setFinal(testCase.params.final);
      }
      if (testCase.params.abstract !== undefined) {
        builder.setAbstract(testCase.params.abstract);
      }
      if (testCase.params.create_protected !== undefined) {
        builder.setCreateProtected(testCase.params.create_protected);
      }

      // Verify configuration is stored
      expect(builder.getClassName()).toBe(className);
      expect(builder.getSessionId()).toBeDefined();
      expect(builder.getSessionId().length).toBeGreaterThan(0);
    });

    it('should allow optional builder methods', () => {
      if (!hasConfig) {
        builderLogger.warn?.('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const testCase = getEnabledTestCase('create_class', 'basic_class');
      if (!testCase) {
        builderLogger.warn?.('⚠️ Skipping test: Test case is disabled');
        return;
      }

      const className = testCase.params.class_name;
      const packageName = testCase.params.package_name || getDefaultPackage();

      const builder = new ClassBuilder(connection, builderLogger, {
        className,
        packageName,
      });

      expect(builder.getClassName()).toBe(className);
    });
  });

  describe('Promise chaining', () => {
    it('should chain operations with .then() and pass builder instance', async () => {
      if (!hasConfig) {
        builderLogger.warn?.('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const testCase = getEnabledTestCase('create_class', 'basic_class');
      if (!testCase) {
        builderLogger.warn?.('⚠️ Skipping test: Test case is disabled');
        return;
      }

      const className = testCase.params.class_name;
      const packageName = testCase.params.package_name || getDefaultPackage();
      const sourceCode = testCase.params.source_code || 'CLASS ' + className + ' DEFINITION PUBLIC FINAL CREATE PUBLIC. ENDCLASS.';

      // Ensure class doesn't exist (idempotency)
      await deleteClassIfExists(className, packageName);

      const builder = new ClassBuilder(connection, builderLogger, {
        className,
        packageName,
        transportRequest: testCase.params.transport_request || getDefaultTransport(),
      })
        .setCode(sourceCode);

      let validationCalled = false;
      let createCalled = false;

      await builder
        .validate()
        .then(b => {
          validationCalled = true;
          // Verify builder instance is passed correctly
          expect(b).toBe(builder);
          expect(b.getValidationResult()).toBeDefined();
          return b.create();
        })
        .then(b => {
          createCalled = true;
          // Verify builder instance is passed correctly
          expect(b).toBe(builder);
          expect(b.getCreateResult()).toBeDefined();
          expect(b.getCreateResult()?.status).toBeGreaterThanOrEqual(200);
          expect(b.getCreateResult()?.status).toBeLessThan(300);
          return b;
        });

      expect(validationCalled).toBe(true);
      expect(createCalled).toBe(true);
    }, 60000);

    it('should interrupt chain on error', async () => {
      if (!hasConfig) {
        builderLogger.warn?.('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const testCase = getEnabledTestCase('create_class', 'basic_class');
      if (!testCase) {
        builderLogger.warn?.('⚠️ Skipping test: Test case is disabled');
        return;
      }

      const className = testCase.params.class_name;
      const sourceCode = testCase.params.source_code || 'CLASS ' + className + ' DEFINITION PUBLIC FINAL CREATE PUBLIC. ENDCLASS.';

      // Create builder without package to cause create to fail
      const builder = new ClassBuilder(connection, builderLogger, {
        className,
        // packageName missing - will cause create to fail
      })
        .setCode(sourceCode);

      let catchCalled = false;
      let afterErrorCalled = false;

      await builder
        .validate()
        .then(b => b.create())
        .then(b => {
          // This should not be called if create fails
          afterErrorCalled = true;
          return b;
        })
        .catch(error => {
          catchCalled = true;
          expect(error).toBeDefined();
          expect(error.message).toBeDefined();
        });

      expect(catchCalled).toBe(true);
      expect(afterErrorCalled).toBe(false); // Chain should be interrupted
    }, 30000);

    it('should execute .finally() even on error', async () => {
      if (!hasConfig) {
        builderLogger.warn?.('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const testCase = getEnabledTestCase('create_class', 'basic_class');
      if (!testCase) {
        builderLogger.warn?.('⚠️ Skipping test: Test case is disabled');
        return;
      }

      const className = testCase.params.class_name;
      const sourceCode = testCase.params.source_code || 'CLASS ' + className + ' DEFINITION PUBLIC FINAL CREATE PUBLIC. ENDCLASS.';

      // Create builder without package to cause create to fail
      const builder = new ClassBuilder(connection, builderLogger, {
        className,
        // packageName missing - will cause create to fail
      })
        .setCode(sourceCode);

      let finallyCalled = false;

      await builder
        .validate()
        .then(b => b.create())
        .catch(error => {
          // Expected error - create should fail without package
        })
        .finally(() => {
          finallyCalled = true;
        });

      expect(finallyCalled).toBe(true);
    }, 30000);
  });

  describe('Result storage', () => {
    it('should store validation result in state', async () => {
      if (!hasConfig) {
        builderLogger.warn?.('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const testCase = getEnabledTestCase('create_class', 'basic_class');
      if (!testCase) {
        builderLogger.warn?.('⚠️ Skipping test: Test case is disabled');
        return;
      }

      const builder = new ClassBuilder(connection, builderLogger, {
        className: testCase.params.class_name,
        packageName: testCase.params.package_name || getDefaultPackage(),
      });

      await builder.validate();

      // Verify result is stored
      const validationResult = builder.getValidationResult();
      expect(validationResult).toBeDefined();
      expect(validationResult?.valid).toBeDefined();

      // Verify result is also in getResults()
      const results = builder.getResults();
      expect(results.validation).toBeDefined();
      expect(results.validation).toBe(validationResult);
    }, 30000);

    it('should store all operation results in state', async () => {
      if (!hasConfig) {
        builderLogger.warn?.('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const testCase = getEnabledTestCase('create_class', 'basic_class');
      if (!testCase) {
        builderLogger.warn?.('⚠️ Skipping test: Test case is disabled');
        return;
      }

      const className = testCase.params.class_name;
      const packageName = testCase.params.package_name || getDefaultPackage();
      const sourceCode = testCase.params.source_code || 'CLASS ' + className + ' DEFINITION PUBLIC FINAL CREATE PUBLIC. ENDCLASS.';

      // Ensure class doesn't exist (idempotency)
      await deleteClassIfExists(className, packageName);

      const builder = new ClassBuilder(connection, builderLogger, {
        className,
        packageName,
        transportRequest: testCase.params.transport_request || getDefaultTransport(),
      })
        .setCode(sourceCode);

      await builder
        .validate()
        .then(b => b.create())
        .then(b => b.lock())
        .then(b => {
          // Verify lockHandle is stored
          const lockHandle = b.getLockHandle();
          expect(lockHandle).toBeDefined();
          expect(lockHandle).not.toBe('');
          return b.update();
        })
        .then(b => b.unlock())
        .catch(error => {
          // Ignore errors for this test
        });

      // Verify all results are stored
      const results = builder.getResults();
      expect(results.validation).toBeDefined();
      expect(results.create).toBeDefined();
      expect(results.update).toBeDefined();

      // Verify individual getters
      expect(builder.getValidationResult()).toBe(results.validation);
      expect(builder.getCreateResult()).toBe(results.create);
      expect(builder.getUpdateResult()).toBe(results.update);
    }, 60000);
  });

  describe('Error handling', () => {
    it('should track errors in state when operation fails', async () => {
      if (!hasConfig) {
        builderLogger.warn?.('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const testCase = getEnabledTestCase('create_class', 'basic_class');
      if (!testCase) {
        builderLogger.warn?.('⚠️ Skipping test: Test case is disabled');
        return;
      }

      const className = testCase.params.class_name;
      const sourceCode = testCase.params.source_code || 'CLASS ' + className + ' DEFINITION PUBLIC FINAL CREATE PUBLIC. ENDCLASS.';

      // Create builder without package to cause create to fail
      const builder = new ClassBuilder(connection, builderLogger, {
        className,
        // packageName missing - will cause create to fail
      })
        .setCode(sourceCode);

      try {
        await builder
          .validate()
          .then(b => b.create()); // This should fail without package
      } catch (error) {
        // Expected error - create should fail without package
      }

      // Verify error is tracked in state
      const errors = builder.getErrors();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].method).toBe('create');
      expect(errors[0].error).toBeDefined();
      expect(errors[0].timestamp).toBeDefined();
      expect(errors[0].error.message.toLowerCase()).toContain('package');

      // Verify state contains errors
      const state = builder.getState();
      expect(state.errors.length).toBeGreaterThan(0);
      expect(state.errors[0]).toBe(errors[0]);
    }, 30000);

    it('should allow cleanup in catch handler', async () => {
      if (!hasConfig) {
        builderLogger.warn?.('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const testCase = getEnabledTestCase('create_class', 'basic_class');
      if (!testCase) {
        builderLogger.warn?.('⚠️ Skipping test: Test case is disabled');
        return;
      }

      const className = testCase.params.class_name;
      const packageName = testCase.params.package_name || getDefaultPackage();
      const sourceCode = testCase.params.source_code || 'CLASS ' + className + ' DEFINITION PUBLIC FINAL CREATE PUBLIC. ENDCLASS.';

      // Ensure class doesn't exist (idempotency)
      await deleteClassIfExists(className, packageName);

      const builder = new ClassBuilder(connection, builderLogger, {
        className,
        packageName,
        transportRequest: testCase.params.transport_request || getDefaultTransport(),
      })
        .setCode(sourceCode);

      let cleanupCalled = false;

      await builder
        .validate()
        .then(b => b.create())
        .then(b => b.lock())
        .then(b => {
          // Simulate error
          throw new Error('Test error');
        })
        .catch(error => {
          // Cleanup in catch handler - verify lockHandle is accessible
          if (builder.getLockHandle()) {
            cleanupCalled = true;
            return builder.unlock().catch(() => {
              // Ignore unlock errors during cleanup
            });
          }
        });

      expect(cleanupCalled).toBe(true);
    }, 60000);
  });

  describe('Full workflow', () => {
    it('should execute full workflow and store all results', async () => {
      if (!hasConfig) {
        builderLogger.warn?.('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const testCase = getEnabledTestCase('create_class', 'basic_class');
      if (!testCase) {
        builderLogger.warn?.('⚠️ Skipping test: Test case is disabled');
        return;
      }

      const className = testCase.params.class_name;
      const packageName = testCase.params.package_name || getDefaultPackage();
      const sourceCode = testCase.params.source_code || 'CLASS ' + className + ' DEFINITION PUBLIC FINAL CREATE PUBLIC. ENDCLASS.';

      // Ensure class doesn't exist (idempotency)
      await deleteClassIfExists(className, packageName);

      const builder = new ClassBuilder(connection, builderLogger, {
        className,
        packageName,
        transportRequest: testCase.params.transport_request || getDefaultTransport(),
      })
        .setCode(sourceCode);

      await builder
        .validate()
        .then(b => {
          // Verify validation result is stored
          expect(b.getValidationResult()?.valid).toBe(true);
          return b.create();
        })
        .then(b => {
          // Verify create result is stored
          expect(b.getCreateResult()?.status).toBeGreaterThanOrEqual(200);
          expect(b.getCreateResult()?.status).toBeLessThan(300);
          return b.lock();
        })
        .then(b => {
          // Verify lockHandle is stored
          expect(b.getLockHandle()).toBeDefined();
          expect(b.getLockHandle()).not.toBe('');
          return b.update();
        })
        .then(b => {
          // Verify update result is stored
          expect(b.getUpdateResult()?.status).toBeGreaterThanOrEqual(200);
          expect(b.getUpdateResult()?.status).toBeLessThan(300);
          return b.check();
        })
        .then(b => {
          // Verify check result is stored
          expect(b.getCheckResult()?.status).toBeGreaterThanOrEqual(200);
          expect(b.getCheckResult()?.status).toBeLessThan(500);
          return b.unlock();
        })
        .then(b => {
          // Verify unlock result is stored
          expect(b.getUnlockResult()?.status).toBeGreaterThanOrEqual(200);
          expect(b.getUnlockResult()?.status).toBeLessThan(300);
          expect(b.getLockHandle()).toBeUndefined(); // Should be cleared after unlock
          return b.activate();
        })
        .then(b => {
          // Verify activate result is stored
          expect(b.getActivateResult()?.status).toBeGreaterThanOrEqual(200);
          expect(b.getActivateResult()?.status).toBeLessThan(300);

          // Verify all results are stored in getResults()
          const results = b.getResults();
          expect(results.validation).toBeDefined();
          expect(results.create).toBeDefined();
          expect(results.update).toBeDefined();
          expect(results.check).toBeDefined();
          expect(results.unlock).toBeDefined();
          expect(results.activate).toBeDefined();
        })
        .catch(error => {
          builderLogger.error?.('Full workflow failed:', error);
          throw error;
        })
        .finally(() => {
          // Ensure cleanup
          if (builder.getLockHandle()) {
            builder.unlock().catch(() => {
              // Ignore cleanup errors
            });
          }
        });
    }, 120000);
  });

  describe('Getters', () => {
    it('should provide access to all getters', () => {
      if (!hasConfig) {
        builderLogger.warn?.('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const testCase = getEnabledTestCase('create_class', 'basic_class');
      if (!testCase) {
        builderLogger.warn?.('⚠️ Skipping test: Test case is disabled');
        return;
      }

      const className = testCase.params.class_name;
      const packageName = testCase.params.package_name || getDefaultPackage();

      const builder = new ClassBuilder(connection, builderLogger, {
        className,
        packageName,
      });

      // Verify all getters work
      expect(builder.getClassName()).toBe(className);
      expect(builder.getSessionId()).toBeDefined();
      expect(builder.getSessionId().length).toBeGreaterThan(0);
      expect(builder.getLockHandle()).toBeUndefined(); // Not locked yet
      expect(builder.getState()).toBeDefined();
      expect(builder.getErrors()).toEqual([]);
      expect(builder.getResults()).toBeDefined();

      // Verify individual result getters return undefined initially
      expect(builder.getValidationResult()).toBeUndefined();
      expect(builder.getCreateResult()).toBeUndefined();
      expect(builder.getUpdateResult()).toBeUndefined();
      expect(builder.getCheckResult()).toBeUndefined();
      expect(builder.getUnlockResult()).toBeUndefined();
      expect(builder.getActivateResult()).toBeUndefined();
    });
  });
});

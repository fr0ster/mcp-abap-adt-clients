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
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';
import {
  logBuilderTestError,
  logBuilderTestSkip,
  logBuilderTestStart,
  logBuilderTestSuccess,
  logBuilderTestEnd,
  logBuilderTestStep,
  setTotalTests,
  resetTestCounter
} from '../../helpers/builderTestLogger';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const {
  getEnabledTestCase,
  getDefaultPackage,
  getDefaultTransport,
  getTestCaseDefinition
} = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const connectionLogger: ILogger = {
  debug: debugEnabled ? (message: string, meta?: any) => console.log(message, meta) : () => {},
  info: debugEnabled ? (message: string, meta?: any) => console.log(message, meta) : () => {},
  warn: debugEnabled ? (message: string, meta?: any) => console.warn(message, meta) : () => {},
  error: debugEnabled ? (message: string, meta?: any) => console.error(message, meta) : () => {},
  csrfToken: debugEnabled ? (action: string, token?: string) => console.log(`CSRF ${action}:`, token) : () => {},
};

const builderLogger: ClassBuilderLogger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
};

describe('ClassBuilder', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;

  beforeAll(async () => {
    // Count total tests for progress tracking
    const testCount = 2; // Full workflow + Read standard object
    setTotalTests(testCount);
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);

      // Setup session and lock tracking based on test-config.yaml
      // This will enable stateful session if persist_session: true in YAML
      const env = await setupTestEnvironment(connection, 'class_builder', __filename);
      sessionId = env.sessionId;
      testConfig = env.testConfig;
      lockTracking = env.lockTracking;

      if (sessionId) {
        builderLogger.debug?.(`✓ Session persistence enabled: ${sessionId}`);
        builderLogger.debug?.(`  Session storage: ${testConfig?.session_config?.sessions_dir || '.sessions'}`);
      } else {
        builderLogger.debug?.('⚠️ Session persistence disabled (persist_session: false in test-config.yaml)');
      }

      if (lockTracking?.enabled) {
        builderLogger.debug?.(`✓ Lock tracking enabled: ${lockTracking.locksDir}`);
      } else {
        builderLogger.debug?.('⚠️ Lock tracking disabled (persist_locks: false in test-config.yaml)');
      }

      // Connect to SAP system to initialize session (get CSRF token and cookies)
      await (connection as any).connect();

      hasConfig = true;
    } catch (error) {
      builderLogger.warn?.('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterAll(async () => {
    resetTestCounter();
    if (connection) {
      await cleanupTestEnvironment(connection, sessionId, testConfig);
      connection.reset();
    }
  });

  function getBuilderTestDefinition() {
    return getTestCaseDefinition('create_class', 'builder_class');
  }

  /**
   * Ensure class is ready for test (delete if exists)
   * Uses validateClassName to check existence
   */
  async function ensureClassReady(className: string, packageName: string): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: false, reason: 'No connection' };
    }

    try {
      // Check if class exists using validation
      // valid: true = class doesn't exist (can be created)
      // valid: false = class already exists
      const validationResult = await validateClassName(connection, className, packageName);

      if (!validationResult.valid) {
        // Class exists, delete it
        if (debugEnabled) {
          builderLogger.debug?.(`[CLEANUP] Class ${className} exists, deleting...`);
        }
        try {
        await deleteObject(connection, {
          object_name: className,
          object_type: 'CLAS/OC',
        });
          if (debugEnabled) {
            builderLogger.debug?.(`[CLEANUP] Class ${className} deleted`);
          }
        } catch (deleteError: any) {
          const errorMsg = `Failed to delete class ${className}: ${deleteError.message}`;
          if (debugEnabled) {
            builderLogger.warn?.(`[CLEANUP] ${errorMsg}`);
          }
          return { success: false, reason: errorMsg };
        }
      } else {
        if (debugEnabled) {
          builderLogger.debug?.(`[CLEANUP] Class ${className} doesn't exist`);
        }
      }

      // Verify class doesn't exist (wait a bit for async deletion)
      await new Promise(resolve => setTimeout(resolve, 1000));

      try {
        const verifyResult = await validateClassName(connection, className, packageName);
        if (!verifyResult.valid) {
          // Class still exists
          const errorMsg = `Class ${className} still exists after cleanup attempt (may be locked or in use)`;
          if (debugEnabled) {
            builderLogger.warn?.(`[CLEANUP] ${errorMsg}`);
          }
          return { success: false, reason: errorMsg };
        }
        return { success: true };
      } catch (error: any) {
        const errorMsg = `Cannot verify cleanup status for ${className} (may be locked)`;
        if (debugEnabled) {
          builderLogger.warn?.(`[CLEANUP] ${errorMsg}:`, error.message);
        }
        return { success: false, reason: errorMsg };
      }
    } catch (error: any) {
      const errorMsg = `Error checking/deleting class ${className}: ${error.message}`;
      if (debugEnabled) {
        builderLogger.warn?.(`[CLEANUP] ${errorMsg}`);
    }
      return { success: false, reason: errorMsg };
    }
  }

  describe('Full workflow', () => {
    let testCase: any = null;
    let testClassName: string | null = null;
    let skipReason: string | null = null;

    beforeEach(async () => {
      skipReason = null;
      testCase = null;
      testClassName = null;

      if (!hasConfig) {
        skipReason = 'No SAP configuration';
        return;
      }

      const definition = getBuilderTestDefinition();
      if (!definition) {
        skipReason = 'Test case not defined in test-config.yaml';
        return;
      }

      const tc = getEnabledTestCase('create_class', 'builder_class');
      if (!tc) {
        skipReason = 'Test case disabled or not found';
        return;
      }

      testCase = tc;
      testClassName = tc.params.class_name;

      // Cleanup before test
      if (testClassName) {
        const packageName = tc.params.package_name || getDefaultPackage();
        const cleanup = await ensureClassReady(testClassName, packageName);
        if (!cleanup.success) {
          skipReason = cleanup.reason || 'Failed to cleanup class before test';
          testCase = null;
          testClassName = null;
        }
      }
    });

    afterEach(async () => {
      if (testClassName && connection) {
        // Cleanup after test
        const packageName = testCase?.params.package_name || getDefaultPackage();
        const cleanup = await ensureClassReady(testClassName, packageName);
        if (!cleanup.success && cleanup.reason) {
          if (debugEnabled) {
            builderLogger.warn?.(`[CLEANUP] Cleanup failed: ${cleanup.reason}`);
          }
        }
      }
    });

    it('should execute full workflow and store all results', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(builderLogger, 'ClassBuilder - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(builderLogger, 'ClassBuilder - full workflow', skipReason);
        return;
      }

      if (!testCase || !testClassName) {
        logBuilderTestSkip(builderLogger, 'ClassBuilder - full workflow', skipReason || 'Test case not available');
        return;
      }

      const testPackageName = testCase.params.package_name || getDefaultPackage();
      const sourceCode = testCase.params.source_code || `CLASS ${testClassName} DEFINITION PUBLIC FINAL CREATE PUBLIC. ENDCLASS.`;

        const builder = new ClassBuilder(connection, builderLogger, {
          className: testClassName,
          packageName: testPackageName,
          transportRequest: testCase.params.transport_request || getDefaultTransport(),
      }).setCode(sourceCode);

      try {
        logBuilderTestStep('validate');
      await builder
        .validate()
        .then(b => {
            logBuilderTestStep('create');
          return b.create();
        })
        .then(b => {
            logBuilderTestStep('check(inactive)');
            return b.check('inactive');
          })
          .then(b => {
            logBuilderTestStep('lock');
          return b.lock();
        })
          .then(b => {
            logBuilderTestStep('update');
          return b.update();
        })
          .then(b => {
            logBuilderTestStep('check(inactive)');
            return b.check('inactive');
        })
        .then(b => {
            logBuilderTestStep('unlock');
          return b.unlock();
        })
          .then(b => {
            logBuilderTestStep('activate');
            return b.activate();
          })
          .then(b => {
            logBuilderTestStep('check(active)');
            return b.check('active');
          });

        const state = builder.getState();
        expect(state.createResult).toBeDefined();
        expect(state.activateResult).toBeDefined();
        expect(state.errors.length).toBe(0);

        logBuilderTestSuccess(builderLogger, 'ClassBuilder - full workflow');
      } catch (error) {
        logBuilderTestError(builderLogger, 'ClassBuilder - full workflow', error);
        throw error;
      } finally {
        await builder.forceUnlock().catch(() => {});
        logBuilderTestEnd(builderLogger, 'ClassBuilder - full workflow');
      }
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP class', async () => {
      const standardClassName = 'CL_ABAP_CHAR_UTILITIES'; // Standard SAP class
      logBuilderTestStart(builderLogger, 'ClassBuilder - read standard object', {
        name: 'read_standard',
        params: { class_name: standardClassName }
      });

      if (!hasConfig) {
        logBuilderTestSkip(builderLogger, 'ClassBuilder - read standard object', 'No SAP configuration');
        return;
      }

      const builder = new ClassBuilder(
        connection,
        builderLogger,
        {
          className: standardClassName,
          packageName: 'SAP' // Standard package
        }
      );

      try {
        logBuilderTestStep('read');
        await builder.read('active');

        const result = builder.getReadResult();
        expect(result).toBeDefined();
        expect(result?.status).toBe(200);
        expect(result?.data).toBeDefined();

        logBuilderTestSuccess(builderLogger, 'ClassBuilder - read standard object');
      } catch (error) {
        logBuilderTestError(builderLogger, 'ClassBuilder - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(builderLogger, 'ClassBuilder - read standard object');
      }
    }, getTimeout('test'));
  });
});

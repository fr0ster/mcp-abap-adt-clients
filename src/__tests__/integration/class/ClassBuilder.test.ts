/**
 * Unit test for ClassBuilder
 * Tests fluent API with Promise chaining, error handling, and result storage
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/class/ClassBuilder.test
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { ClassBuilder, ClassBuilderLogger } from '../../../core/class';
import { getClass } from '../../../core/class/read';
import { isCloudEnvironment } from '../../../core/shared/systemInfo';
import { getConfig } from '../../helpers/sessionConfig';
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
  getTestCaseDefinition,
  resolvePackageName,
  resolveTransportRequest,
  ensurePackageConfig,
  resolveStandardObject
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
  let isCloudSystem = false;

  beforeAll(async () => {
    // Count total tests for progress tracking
    const testCount = 3; // Full workflow + Read standard object + Read transport request
    setTotalTests(testCount);
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);

      // Connect to SAP system to initialize session (get CSRF token and cookies)
      await (connection as any).connect();

      hasConfig = true;
      // Check if this is a cloud system
      isCloudSystem = await isCloudEnvironment(connection);
    } catch (error) {
      builderLogger.warn?.('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterAll(async () => {
    resetTestCounter();
    if (connection) {
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
  /**
   * Pre-check: Verify test class doesn't exist
   * Safety: Skip test if object exists to avoid accidental deletion
   */
  async function ensureClassReady(className: string, packageName: string): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: true };
    }

    // Check if class exists
    try {
      await getClass(connection, className);
      return {
        success: false,
        reason: `⚠️ SAFETY: Class ${className} already exists! ` +
                `Delete manually or use different test name to avoid accidental deletion.`
      };
    } catch (error: any) {
      // 404 is expected - object doesn't exist, we can proceed
      if (error.response?.status !== 404) {
        return {
          success: false,
          reason: `Cannot verify class existence: ${error.message}`
        };
      }
    }

    return { success: true };
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

      const packageCheck = ensurePackageConfig(tc.params, 'ClassBuilder - full workflow');
      if (!packageCheck.success) {
        skipReason = packageCheck.reason || 'Default package is not configured';
        return;
      }

      testCase = tc;
      testClassName = tc.params.class_name;

      // Cleanup before test
      if (testClassName) {
        const packageName = resolvePackageName(tc.params.package_name);
        const cleanup = await ensureClassReady(testClassName, packageName);
        if (!cleanup.success) {
          skipReason = cleanup.reason || 'Failed to cleanup class before test';
          testCase = null;
          testClassName = null;
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

      const testPackageName = resolvePackageName(testCase.params.package_name);
      if (!testPackageName) {
        logBuilderTestSkip(builderLogger, 'ClassBuilder - full workflow', 'package_name not configured');
        return;
      }
      const sourceCode = testCase.params.source_code || `CLASS ${testClassName} DEFINITION PUBLIC FINAL CREATE PUBLIC. ENDCLASS.`;

        const builder = new ClassBuilder(connection, builderLogger, {
          className: testClassName,
          packageName: testPackageName,
          description: `Test class ${testClassName}`,
          transportRequest: resolveTransportRequest(testCase.params.transport_request),
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
            logBuilderTestStep('lock');
          return b.lock();
        })
          .then(b => {
            logBuilderTestStep('check with source code (before update)');
            return b.check('inactive', sourceCode);
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
          })
          .then(b => {
            logBuilderTestStep('delete (cleanup)');
            return b.delete();
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
        // Cleanup: force unlock in case of failure
        await builder.forceUnlock().catch(() => {});
        logBuilderTestEnd(builderLogger, 'ClassBuilder - full workflow');
      }
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP class', async () => {
      const testCase = getTestCaseDefinition('create_class', 'builder_class');
      const standardObject = resolveStandardObject('class', isCloudSystem, testCase);

      if (!standardObject) {
        logBuilderTestStart(builderLogger, 'ClassBuilder - read standard object', {
          name: 'read_standard',
          params: {}
        });
        logBuilderTestSkip(builderLogger, 'ClassBuilder - read standard object',
          `Standard class not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`);
        return;
      }

      const standardClassName = standardObject.name;
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
          packageName: 'SAP', // Standard package
          description: '' // Not used for read operations
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

  describe('Read transport request', () => {
    it('should read transport request for class', async () => {
      const testCase = getTestCaseDefinition('create_class', 'builder_class');
      const standardObject = resolveStandardObject('class', isCloudSystem, testCase);

      if (!standardObject) {
        logBuilderTestStart(builderLogger, 'ClassBuilder - read transport request', {
          name: 'read_transport',
          params: {}
        });
        logBuilderTestSkip(builderLogger, 'ClassBuilder - read transport request',
          `Standard class not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`);
        return;
      }

      const standardClassName = standardObject.name;

      // Check if transport_request is configured in YAML
      const transportRequest = resolveTransportRequest(testCase?.params?.transport_request);
      if (!transportRequest) {
        logBuilderTestStart(builderLogger, 'ClassBuilder - read transport request', {
          name: 'read_transport',
          params: { class_name: standardClassName }
        });
        logBuilderTestSkip(builderLogger, 'ClassBuilder - read transport request',
          'transport_request not configured in test-config.yaml (required for transport read test)');
        return;
      }

      logBuilderTestStart(builderLogger, 'ClassBuilder - read transport request', {
        name: 'read_transport',
        params: { class_name: standardClassName, transport_request: transportRequest }
      });

      if (!hasConfig) {
        logBuilderTestSkip(builderLogger, 'ClassBuilder - read transport request', 'No SAP configuration');
        return;
      }

      const builder = new ClassBuilder(
        connection,
        builderLogger,
        {
          className: standardClassName,
          packageName: 'SAP', // Standard package
          description: '' // Not used for read operations
        }
      );

      try {
        logBuilderTestStep('readTransport');
        await builder.readTransport();

        const result = builder.getTransportResult();
        expect(result).toBeDefined();
        expect(result?.status).toBe(200);
        expect(result?.data).toBeDefined();

        logBuilderTestSuccess(builderLogger, 'ClassBuilder - read transport request');
      } catch (error) {
        logBuilderTestError(builderLogger, 'ClassBuilder - read transport request', error);
        throw error;
      } finally {
        logBuilderTestEnd(builderLogger, 'ClassBuilder - read transport request');
      }
    }, getTimeout('test'));
  });
});

/**
 * Unit test for StructureBuilder
 * Tests fluent API with Promise chaining, error handling, and result storage
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- integration/structure/StructureBuilder
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { StructureBuilder, StructureBuilderLogger } from '../../../core/structure';
import { deleteStructure } from '../../../core/structure/delete';
import { getStructureSource } from '../../../core/structure/read';
import { getConfig } from '../../helpers/sessionConfig';
import {
  logBuilderTestError,
  logBuilderTestSkip,
  logBuilderTestStart,
  logBuilderTestSuccess,
  logBuilderTestEnd,
  logBuilderTestStep
} from '../../helpers/builderTestLogger';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const {
  getEnabledTestCase,
  getTestCaseDefinition,
  getDefaultPackage,
  getDefaultTransport
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

const builderLogger: StructureBuilderLogger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
};

describe('StructureBuilder', () => {
  let connection: AbapConnection;
  let hasConfig = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      hasConfig = true;
    } catch (error) {
      builderLogger.warn?.('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterAll(async () => {
    if (connection) {
      connection.reset();
    }
  });

  async function ensureStructureReady(structureName: string): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: false, reason: 'No connection' };
    }

    // Try to delete if exists
    try {
      await deleteStructure(connection, { structure_name: structureName });
      if (debugEnabled) {
        builderLogger.debug?.(`[CLEANUP] Structure ${structureName} deleted`);
      }
    } catch (error: any) {
      const rawMessage =
        error?.response?.data ||
        error?.message ||
        (typeof error === 'string' ? error : JSON.stringify(error));

      // 404 = object doesn't exist, that's fine
      if (
        error.response?.status === 404 ||
        rawMessage?.toLowerCase?.().includes('not found') ||
        rawMessage?.toLowerCase?.().includes('does not exist')
      ) {
        if (debugEnabled) {
          builderLogger.debug?.(`[CLEANUP] Structure ${structureName} already absent`);
        }
        return { success: true };
      }

      // Other errors - log only in debug mode
      if (debugEnabled) {
        builderLogger.warn?.(`[CLEANUP] Failed to delete ${structureName}:`, rawMessage);
      }
    }

    // Verify object doesn't exist (wait a bit for async deletion)
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      await getStructureSource(connection, structureName);
      // Object still exists - check if it's locked
      const errorMsg = `Structure ${structureName} still exists after cleanup attempt (may be locked or in use)`;
      if (debugEnabled) {
        builderLogger.warn?.(`[CLEANUP] ${errorMsg}`);
      }
      return { success: false, reason: errorMsg };
    } catch (error: any) {
      // 404 = object doesn't exist, cleanup successful
      if (error.response?.status === 404) {
        return { success: true };
      }
      // Other error - object might be locked
      const errorMsg = `Cannot verify cleanup status for ${structureName} (may be locked)`;
      if (debugEnabled) {
        builderLogger.warn?.(`[CLEANUP] ${errorMsg}:`, error.message);
      }
      return { success: false, reason: errorMsg };
    }
  }

  function getBuilderTestDefinition() {
    return getTestCaseDefinition('create_structure', 'builder_structure');
  }

  function buildBuilderConfig(testCase: any) {
    const params = testCase?.params || {};
    return {
      structureName: params.structure_name,
      packageName: params.package_name || getDefaultPackage(),
      transportRequest: params.transport_request || getDefaultTransport(),
      description: params.description,
      ddlCode: params.ddl_code
    };
  }

  describe('Full workflow', () => {
    let testCase: any = null;
    let structureName: string | null = null;
    let skipReason: string | null = null;

    beforeEach(async () => {
      skipReason = null;
      testCase = null;
      structureName = null;

      if (!hasConfig) {
        skipReason = 'No SAP configuration';
        return;
      }

      const definition = getBuilderTestDefinition();
      if (!definition) {
        skipReason = 'Test case not defined in test-config.yaml';
        return;
      }

      const tc = getEnabledTestCase('create_structure', 'builder_structure');
      if (!tc) {
        skipReason = 'Test case disabled or not found';
        return;
      }

      testCase = tc;
      structureName = tc.params.structure_name;

      // Cleanup before test
      if (structureName) {
        const cleanup = await ensureStructureReady(structureName);
        if (!cleanup.success) {
          skipReason = cleanup.reason || 'Failed to cleanup structure before test';
          testCase = null;
          structureName = null;
        }
      }
    });

    afterEach(async () => {
      if (structureName && connection) {
        // Cleanup after test
        const cleanup = await ensureStructureReady(structureName);
        if (!cleanup.success && cleanup.reason) {
          if (debugEnabled) {
            builderLogger.warn?.(`[CLEANUP] Cleanup failed: ${cleanup.reason}`);
          }
        }
      }
    });

    it('should execute full workflow and store all results', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(builderLogger, 'StructureBuilder - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(builderLogger, 'StructureBuilder - full workflow', skipReason);
        return;
      }

      if (!testCase || !structureName) {
        logBuilderTestSkip(builderLogger, 'StructureBuilder - full workflow', skipReason || 'Test case not available');
        return;
      }

      const builder = new StructureBuilder(connection, builderLogger, buildBuilderConfig(testCase));

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

        logBuilderTestSuccess(builderLogger, 'StructureBuilder - full workflow');
      } catch (error) {
        logBuilderTestError(builderLogger, 'StructureBuilder - full workflow', error);
        throw error;
      } finally {
        await builder.forceUnlock().catch(() => {});
        logBuilderTestEnd(builderLogger, 'StructureBuilder - full workflow');
      }
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP structure', async () => {
      // Standard SAP structure (exists in most ABAP systems)
      const standardStructureName = 'SYST';
      logBuilderTestStart(builderLogger, 'StructureBuilder - read standard object', {
        name: 'read_standard',
        params: { structure_name: standardStructureName }
      });

      if (!hasConfig) {
        logBuilderTestSkip(builderLogger, 'StructureBuilder - read standard object', 'No SAP configuration');
        return;
      }

      const builder = new StructureBuilder(
        connection,
        builderLogger,
        {
          structureName: standardStructureName,
          packageName: 'SAP' // Standard package
        }
      );

      try {
        logBuilderTestStep('read');
        await builder.read();

        const result = builder.getReadResult();
        expect(result).toBeDefined();
        expect(result?.status).toBe(200);
        expect(result?.data).toBeDefined();

        logBuilderTestSuccess(builderLogger, 'StructureBuilder - read standard object');
      } catch (error) {
        logBuilderTestError(builderLogger, 'StructureBuilder - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(builderLogger, 'StructureBuilder - read standard object');
      }
    }, getTimeout('test'));
  });
});

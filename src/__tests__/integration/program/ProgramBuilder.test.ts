/**
 * Unit test for ProgramBuilder
 * Tests fluent API with Promise chaining, error handling, and result storage
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/program/ProgramBuilder.test
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { ProgramBuilder, ProgramBuilderLogger } from '../../../core/program';
import { deleteProgram } from '../../../core/program/delete';
import { getProgramSource } from '../../../core/program/read';
import { getConfig } from '../../helpers/sessionConfig';
import { isCloudEnvironment } from '../../../core/shared/systemInfo';
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

const builderLogger: ProgramBuilderLogger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
};

describe('ProgramBuilder', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let isCloudSystem = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      hasConfig = true;
      // Check if this is a cloud system (programs are not supported in cloud)
      isCloudSystem = await isCloudEnvironment(connection);
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

  /**
   * Pre-check: Verify test program doesn't exist
   * Safety: Skip test if object exists to avoid accidental deletion
   */
  async function ensureProgramReady(programName: string): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: true };
    }

    // Check if program exists
    try {
      await getProgramSource(connection, programName);
      return {
        success: false,
        reason: `⚠️ SAFETY: Program ${programName} already exists! ` +
                `Delete manually or use different test name to avoid accidental deletion.`
      };
    } catch (error: any) {
      // 404 is expected - object doesn't exist, we can proceed
      if (error.response?.status !== 404) {
        return {
          success: false,
          reason: `Cannot verify program existence: ${error.message}`
        };
      }
    }

    return { success: true };
  }

  function getBuilderTestDefinition() {
    return getTestCaseDefinition('create_program', 'builder_program');
  }

  function buildBuilderConfig(testCase: any) {
    const params = testCase?.params || {};
    const packageName = resolvePackageName(params.package_name);
    if (!packageName) {
      throw new Error('package_name not configured for ProgramBuilder test');
    }
    return {
      programName: params.program_name,
      packageName,
      transportRequest: resolveTransportRequest(params.transport_request),
      description: params.description,
      programType: params.program_type,
      sourceCode: params.source_code
    };
  }

  describe('Full workflow', () => {
    let testCase: any = null;
    let programName: string | null = null;
    let skipReason: string | null = null;

    beforeEach(async () => {
      skipReason = null;
      testCase = null;
      programName = null;

      if (!hasConfig) {
        skipReason = 'No SAP configuration';
        return;
      }

      if (isCloudSystem) {
        skipReason = 'Programs are not supported in cloud systems (BTP ABAP Environment)';
        return;
      }

      const definition = getBuilderTestDefinition();
      if (!definition) {
        skipReason = 'Test case not defined in test-config.yaml';
        return;
      }

      const tc = getEnabledTestCase('create_program', 'builder_program');
      if (!tc) {
        skipReason = 'Test case disabled or not found';
        return;
      }

      const packageCheck = ensurePackageConfig(tc.params, 'ProgramBuilder - full workflow');
      if (!packageCheck.success) {
        skipReason = packageCheck.reason || 'Default package is not configured';
        return;
      }

      testCase = tc;
      programName = tc.params.program_name;

      // Cleanup before test
      if (programName) {
        const cleanup = await ensureProgramReady(programName);
        if (!cleanup.success) {
          skipReason = cleanup.reason || 'Failed to cleanup program before test';
          testCase = null;
          programName = null;
        }
      }
    });

    it('should execute full workflow and store all results', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(builderLogger, 'ProgramBuilder - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(builderLogger, 'ProgramBuilder - full workflow', skipReason);
        return;
      }

      if (!testCase || !programName) {
        logBuilderTestSkip(builderLogger, 'ProgramBuilder - full workflow', skipReason || 'Test case not available');
        return;
      }

      const builder = new ProgramBuilder(connection, builderLogger, buildBuilderConfig(testCase));
      
      const sourceCode = testCase.params.source_code;

      try {
        logBuilderTestStep('validate');
      await builder
        .validate()
          .then(b => {
            logBuilderTestStep('create');
            return b.create();
          })
          .then(async b => {
            // Wait for SAP to finish create operation (includes lock/unlock internally)
            await new Promise(resolve => setTimeout(resolve, 1000));
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

        logBuilderTestSuccess(builderLogger, 'ProgramBuilder - full workflow');
      } catch (error) {
        logBuilderTestError(builderLogger, 'ProgramBuilder - full workflow', error);
        throw error;
      } finally {
        await builder.forceUnlock().catch(() => {});
        logBuilderTestEnd(builderLogger, 'ProgramBuilder - full workflow');
      }
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP program', async () => {
      if (!hasConfig) {
        logBuilderTestSkip(builderLogger, 'ProgramBuilder - read standard object', 'No SAP configuration');
        return;
      }

      if (isCloudSystem) {
        logBuilderTestSkip(builderLogger, 'ProgramBuilder - read standard object', 'Programs are not supported in cloud systems (BTP ABAP Environment)');
        return;
      }

      const testCase = getTestCaseDefinition('create_program', 'builder_program');
      const standardObject = resolveStandardObject('program', isCloudSystem, testCase);

      if (!standardObject) {
        logBuilderTestStart(builderLogger, 'ProgramBuilder - read standard object', {
          name: 'read_standard',
          params: {}
        });
        logBuilderTestSkip(
          builderLogger,
          'ProgramBuilder - read standard object',
          'Standard program not configured for on-premise environment'
        );
        return;
      }

      const standardProgramName = standardObject.name;
      logBuilderTestStart(builderLogger, 'ProgramBuilder - read standard object', {
        name: 'read_standard',
        params: { program_name: standardProgramName }
      });

      const builder = new ProgramBuilder(connection, builderLogger, {
        programName: standardProgramName,
        packageName: 'SAP', // Standard package
        description: '' // Not used for read operations
      });

      try {
        logBuilderTestStep('read');
        await builder.read();

        const result = builder.getReadResult();
        expect(result).toBeDefined();
        expect(result?.status).toBe(200);
        expect(result?.data).toBeDefined();

        logBuilderTestSuccess(builderLogger, 'ProgramBuilder - read standard object');
      } catch (error) {
        logBuilderTestError(builderLogger, 'ProgramBuilder - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(builderLogger, 'ProgramBuilder - read standard object');
      }
    }, getTimeout('test'));
  });
});


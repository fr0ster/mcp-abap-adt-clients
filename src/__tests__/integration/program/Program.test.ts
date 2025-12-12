/**
 * Integration test for Program (AdtProgram)
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - Program library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=program/Program
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { AdtClient } from '../../../clients/AdtClient';
import { getProgramSource } from '../../../core/program/read';
import { getConfig } from '../../helpers/sessionConfig';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import {
  logBuilderTestStart,
  logBuilderTestSkip,
  logBuilderTestSuccess,
  logBuilderTestError,
  logBuilderTestEnd,
  logBuilderTestStep,
  logBuilderTestStepError,
  getHttpStatusText
} from '../../helpers/builderTestLogger';
import { createBuilderLogger, createConnectionLogger, createTestsLogger, isDebugEnabled } from '../../helpers/testLogger';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const {
  getEnabledTestCase,
  getTestCaseDefinition,
  resolvePackageName,
  resolveTransportRequest,
  ensurePackageConfig,
  resolveStandardObject,
  getTimeout,
  getOperationDelay,
  retryCheckAfterActivate,
  getEnvironmentConfig
} = require('../../helpers/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code (ClassBuilder) uses DEBUG_ADT_LIBS
const builderLogger: ILogger = createBuilderLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('Program (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, builderLogger);
      hasConfig = true;
      // Check if this is a cloud system (programs are not supported in cloud)
      isCloudSystem = await isCloudEnvironment(connection);
    } catch (error) {
      testsLogger.warn?.('⚠️ Skipping tests: No .env file or SAP configuration found');
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
    return getTestCaseDefinition('create_program', 'adt_program');
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

      const tc = getEnabledTestCase('create_program', 'adt_program');
      if (!tc) {
        skipReason = 'Test case disabled or not found';
        return;
      }

      const packageCheck = ensurePackageConfig(tc.params, 'Program - full workflow');
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
      logBuilderTestStart(testsLogger, 'Program - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(testsLogger, 'Program - full workflow', skipReason);
        return;
      }

      if (!testCase || !programName) {
        logBuilderTestSkip(testsLogger, 'Program - full workflow', skipReason || 'Test case not available');
        return;
      }

      const config = buildBuilderConfig(testCase);
      const sourceCode = testCase.params.source_code;

      logBuilderTestStep('validate');
      const validationState = await client.getProgram().validate({
        programName: config.programName,
        packageName: config.packageName!,
        description: config.description || ''
      });
      const validationResponse = validationState?.validationResponse;
      if (validationResponse?.status !== 200) {
        const errorData = typeof validationResponse?.data === 'string' 
          ? validationResponse.data 
          : JSON.stringify(validationResponse?.data);
        console.error(`Validation failed (HTTP ${validationResponse?.status}): ${errorData}`);
      }
      expect(validationResponse?.status).toBe(200);
      
      // Check cleanup settings: cleanup_after_test (global) and skip_cleanup (test-specific or global)
      const envConfig = getEnvironmentConfig();
      const cleanupAfterTest = envConfig.cleanup_after_test !== false; // Default: true if not set
      const globalSkipCleanup = envConfig.skip_cleanup === true;
      const skipCleanup = testCase.params.skip_cleanup !== undefined
        ? testCase.params.skip_cleanup === true
        : globalSkipCleanup;
      const shouldCleanup = cleanupAfterTest && !skipCleanup;
      
      let programCreated = false;
      let currentStep = '';
      
      try {
          currentStep = 'create';
          logBuilderTestStep(currentStep);
          await client.getProgram().create({
            programName: config.programName,
            packageName: config.packageName!,
            description: config.description || '',
            transportRequest: config.transportRequest,
            programType: config.programType
          }, { activateOnCreate: false, sourceCode: sourceCode });
          programCreated = true;
          // Wait for object to be ready using long polling
          try {
            await client.getProgram().read({ programName: config.programName }, 'active', { withLongPolling: true });
          } catch (readError) {
            testsLogger?.warn?.('read with long polling failed (object may not be ready yet):', readError);
            // Continue anyway - check might still work
          }
          
          currentStep = 'check with source code (before update)';
          logBuilderTestStep(currentStep);
          const checkBeforeUpdateState = await client.getProgram().check({ 
            programName: config.programName,
            sourceCode: sourceCode
          }, 'inactive');
          const checkBeforeUpdate = checkBeforeUpdateState?.checkResult;
          expect(checkBeforeUpdate?.status).toBeDefined();
          
          currentStep = 'update';
          logBuilderTestStep(currentStep);
          await client.getProgram().update({
            programName: config.programName
          }, { sourceCode: sourceCode });
          // Wait for object to be ready after update using long polling
          try {
            await client.getProgram().read({ programName: config.programName }, 'active', { withLongPolling: true });
          } catch (readError) {
            testsLogger?.warn?.('read with long polling failed (object may not be ready yet):', readError);
            // Continue anyway - check might still work
          }
        
          currentStep = 'check(inactive)';
          logBuilderTestStep(currentStep);
          const checkResultInactiveState = await client.getProgram().check({ programName: config.programName }, 'inactive');
          const checkResultInactive = checkResultInactiveState?.checkResult;
          expect(checkResultInactive?.status).toBeDefined();
          
          currentStep = 'activate';
          logBuilderTestStep(currentStep);
          await client.getProgram().activate({ programName: config.programName });
          // Wait for object to be ready after activation using long polling
          try {
            await client.getProgram().read({ programName: config.programName }, 'active', { withLongPolling: true });
          } catch (readError) {
            testsLogger?.warn?.('read with long polling failed (object may not be ready yet):', readError);
            // Continue anyway - check might still work
          }
          
          currentStep = 'check(active)';
          logBuilderTestStep(currentStep);
          // Retry check for active version - activation may take time
          const checkResultActiveState = await retryCheckAfterActivate(
            async () => {
              const state = await client.getProgram().check({ programName: config.programName }, 'active');
              return state?.checkResult;
            },
            {
              maxAttempts: 5,
              delay: 1000,
              logger: testsLogger,
              objectName: config.programName
            }
          );
          expect(checkResultActiveState?.status).toBeDefined();
          
          if (shouldCleanup) {
            currentStep = 'delete (cleanup)';
            logBuilderTestStep(currentStep);
            await client.getProgram().delete({
              programName: config.programName,
              transportRequest: config.transportRequest
            });
          } else {
            testsLogger.info?.(`⚠️ Cleanup skipped (cleanup_after_test=${cleanupAfterTest}, skip_cleanup=${skipCleanup}) - program left for analysis: ${config.programName}`);
          }

          logBuilderTestSuccess(testsLogger, 'Program - full workflow');
        } catch (error: any) {
          // Log step error with details before failing test
          logBuilderTestStepError(currentStep || 'unknown', error);
          
          // Cleanup: delete if object was created and cleanup is enabled
          if (shouldCleanup && programCreated) {
            try {
              logBuilderTestStep('delete (cleanup)');
              await client.getProgram().delete({
                programName: config.programName,
                transportRequest: config.transportRequest
              });
            } catch (cleanupError) {
              // Log cleanup error but don't fail test - original error is more important
              testsLogger.warn?.(`Cleanup failed for ${config.programName}:`, cleanupError);
            }
          } else if (!shouldCleanup && programCreated) {
            testsLogger.info?.(`⚠️ Cleanup skipped (cleanup_after_test=${cleanupAfterTest}, skip_cleanup=${skipCleanup}) - program left for analysis: ${config.programName}`);
          }
          
          const statusText = getHttpStatusText(error);
          const enhancedError = statusText !== 'HTTP ?'
            ? Object.assign(new Error(`[${statusText}] ${error.message}`), { stack: error.stack })
            : error;
          logBuilderTestError(testsLogger, 'Program - full workflow', enhancedError);
          throw enhancedError;
      } finally {
        logBuilderTestEnd(testsLogger, 'Program - full workflow');
      }
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP program', async () => {
      if (!hasConfig) {
        logBuilderTestSkip(testsLogger, 'Program - read standard object', 'No SAP configuration');
        return;
      }

      if (isCloudSystem) {
        logBuilderTestSkip(testsLogger, 'Program - read standard object', 'Programs are not supported in cloud systems (BTP ABAP Environment)');
        return;
      }

      const testCase = getTestCaseDefinition('create_program', 'adt_program');
      const standardObject = resolveStandardObject('program', isCloudSystem, testCase);

      if (!standardObject) {
        logBuilderTestStart(testsLogger, 'Program - read standard object', {
          name: 'read_standard',
          params: {}
        });
        logBuilderTestSkip(
          testsLogger,
          'Program - read standard object',
          'Standard program not configured for on-premise environment'
        );
        return;
      }

      const standardProgramName = standardObject.name;
      logBuilderTestStart(testsLogger, 'Program - read standard object', {
        name: 'read_standard',
        params: { program_name: standardProgramName }
      });

      try {
        logBuilderTestStep('read');
        const resultState = await client.getProgram().read({ programName: standardProgramName });
        expect(resultState).toBeDefined();
        expect(resultState?.readResult).toBeDefined();
        // Program read returns source code - check if it's a string or in response data
        const sourceCode = typeof resultState?.readResult === 'string' 
          ? resultState.readResult 
          : (resultState?.readResult as any)?.data || '';
        expect(typeof sourceCode).toBe('string');

        logBuilderTestSuccess(testsLogger, 'Program - read standard object');
      } catch (error) {
        logBuilderTestError(testsLogger, 'Program - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'Program - read standard object');
      }
    }, getTimeout('test'));
  });
});


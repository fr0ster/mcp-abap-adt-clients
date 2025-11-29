/**
 * Integration test for ProgramBuilder
 * Tests using CrudClient for unified CRUD operations
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - ProgramBuilder library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=program/ProgramBuilder
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { CrudClient } from '../../../clients/CrudClient';
import { ProgramBuilder } from '../../../core/program';
import { IAdtLogger } from '../../../utils/logger';
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
  retryCheckAfterActivate
} = require('../../helpers/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code (ClassBuilder) uses DEBUG_ADT_LIBS
const builderLogger: IAdtLogger = createBuilderLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: IAdtLogger = createTestsLogger();

describe('ProgramBuilder (using CrudClient)', () => {
  let connection: AbapConnection;
  let client: CrudClient;
  let hasConfig = false;
  let isCloudSystem = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new CrudClient(connection);
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
      logBuilderTestStart(testsLogger, 'ProgramBuilder - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(testsLogger, 'ProgramBuilder - full workflow', skipReason);
        return;
      }

      if (!testCase || !programName) {
        logBuilderTestSkip(testsLogger, 'ProgramBuilder - full workflow', skipReason || 'Test case not available');
        return;
      }

      const config = buildBuilderConfig(testCase);
      const sourceCode = testCase.params.source_code;

      logBuilderTestStep('validate');
      const validationResponse = await client.validateProgram({
        programName: config.programName,
        packageName: config.packageName!,
        description: config.description || ''
      });
      if (validationResponse?.status !== 200) {
        const errorData = typeof validationResponse?.data === 'string' 
          ? validationResponse.data 
          : JSON.stringify(validationResponse?.data);
        console.error(`Validation failed (HTTP ${validationResponse?.status}): ${errorData}`);
      }
      expect(validationResponse?.status).toBe(200);
      
      let programCreated = false;
      let programLocked = false;
      let currentStep = '';
      
      try {
          currentStep = 'create';
          logBuilderTestStep(currentStep);
          await client.createProgram({
            programName: config.programName,
            packageName: config.packageName!,
            description: config.description || '',
            transportRequest: config.transportRequest,
            programType: config.programType
          });
          programCreated = true;
          // Wait for SAP to finish create operation
          await new Promise(resolve => setTimeout(resolve, getOperationDelay('create', testCase)));
          
          currentStep = 'lock';
          logBuilderTestStep(currentStep);
          await client.lockProgram({ programName: config.programName });
          programLocked = true;
          await new Promise(resolve => setTimeout(resolve, getOperationDelay('lock', testCase)));
          
          currentStep = 'check with source code (before update)';
          logBuilderTestStep(currentStep);
          const checkBeforeUpdate = await client.checkProgram({ programName: config.programName });
          expect(checkBeforeUpdate?.status).toBeDefined();
          
          currentStep = 'update';
          logBuilderTestStep(currentStep);
          await client.updateProgram({
            programName: config.programName,
            sourceCode: sourceCode || ''
          });
          await new Promise(resolve => setTimeout(resolve, getOperationDelay('update', testCase)));
        
          currentStep = 'check(inactive)';
          logBuilderTestStep(currentStep);
          const checkResultInactive = await client.checkProgram({ programName: config.programName });
          expect(checkResultInactive?.status).toBeDefined();
          
          currentStep = 'unlock';
          logBuilderTestStep(currentStep);
          await client.unlockProgram({ programName: config.programName });
          programLocked = false; // Unlocked successfully
          await new Promise(resolve => setTimeout(resolve, getOperationDelay('unlock', testCase)));
          
          currentStep = 'activate';
          logBuilderTestStep(currentStep);
          await client.activateProgram({ programName: config.programName });
          // Wait for activation to complete (activation is asynchronous)
          await new Promise(resolve => setTimeout(resolve, getOperationDelay('activate', testCase) || 2000));
          
          currentStep = 'check(active)';
          logBuilderTestStep(currentStep);
          // Retry check for active version - activation may take time
          const checkResultActive = await retryCheckAfterActivate(
            () => client.checkProgram({ programName: config.programName }),
            {
              maxAttempts: 5,
              delay: 1000,
              logger: testsLogger,
              objectName: config.programName
            }
          );
          expect(checkResultActive?.status).toBeDefined();
          
          currentStep = 'delete (cleanup)';
          logBuilderTestStep(currentStep);
          await client.deleteProgram({
            programName: config.programName,
            transportRequest: config.transportRequest
          });

          expect(client.getCreateResult()).toBeDefined();
          expect(client.getActivateResult()).toBeDefined();

          logBuilderTestSuccess(testsLogger, 'ProgramBuilder - full workflow');
        } catch (error: any) {
          // Log step error with details before failing test
          logBuilderTestStepError(currentStep || 'unknown', error);
          
          // Cleanup: unlock and delete if object was created/locked
          if (programLocked || programCreated) {
            try {
              if (programLocked) {
                logBuilderTestStep('unlock (cleanup)');
                await client.unlockProgram({ programName: config.programName });
              }
              if (programCreated) {
                logBuilderTestStep('delete (cleanup)');
                await client.deleteProgram({
                  programName: config.programName,
                  transportRequest: config.transportRequest
                });
              }
            } catch (cleanupError) {
              // Log cleanup error but don't fail test - original error is more important
              testsLogger.warn?.(`Cleanup failed for ${config.programName}:`, cleanupError);
            }
          }
          
          const statusText = getHttpStatusText(error);
          const enhancedError = statusText !== 'HTTP ?'
            ? Object.assign(new Error(`[${statusText}] ${error.message}`), { stack: error.stack })
            : error;
          logBuilderTestError(testsLogger, 'ProgramBuilder - full workflow', enhancedError);
          throw enhancedError;
      } finally {
        logBuilderTestEnd(testsLogger, 'ProgramBuilder - full workflow');
      }
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP program', async () => {
      if (!hasConfig) {
        logBuilderTestSkip(testsLogger, 'ProgramBuilder - read standard object', 'No SAP configuration');
        return;
      }

      if (isCloudSystem) {
        logBuilderTestSkip(testsLogger, 'ProgramBuilder - read standard object', 'Programs are not supported in cloud systems (BTP ABAP Environment)');
        return;
      }

      const testCase = getTestCaseDefinition('create_program', 'builder_program');
      const standardObject = resolveStandardObject('program', isCloudSystem, testCase);

      if (!standardObject) {
        logBuilderTestStart(testsLogger, 'ProgramBuilder - read standard object', {
          name: 'read_standard',
          params: {}
        });
        logBuilderTestSkip(
          testsLogger,
          'ProgramBuilder - read standard object',
          'Standard program not configured for on-premise environment'
        );
        return;
      }

      const standardProgramName = standardObject.name;
      logBuilderTestStart(testsLogger, 'ProgramBuilder - read standard object', {
        name: 'read_standard',
        params: { program_name: standardProgramName }
      });

      try {
        logBuilderTestStep('read');
        const result = await client.readProgram(standardProgramName);
        expect(result).toBeDefined();
        expect(typeof result).toBe('string'); // Program read returns source code as string

        logBuilderTestSuccess(testsLogger, 'ProgramBuilder - read standard object');
      } catch (error) {
        logBuilderTestError(testsLogger, 'ProgramBuilder - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'ProgramBuilder - read standard object');
      }
    }, getTimeout('test'));
  });
});


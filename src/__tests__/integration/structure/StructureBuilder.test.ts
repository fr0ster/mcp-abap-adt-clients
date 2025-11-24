/**
 * Unit test for StructureBuilder
 * Tests fluent API with Promise chaining, error handling, and result storage
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - StructureBuilder library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=structure/StructureBuilder
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { StructureBuilder } from '../../../core/structure';
import { IAdtLogger } from '../../../utils/logger';
import { getStructure } from '../../../core/structure/read';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import { getConfig } from '../../helpers/sessionConfig';
import {
  logBuilderTestError,
  logBuilderTestSkip,
  logBuilderTestStart,
  logBuilderTestSuccess,
  logBuilderTestEnd,
  logBuilderTestStep
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
  getOperationDelay
} = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}


// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code uses DEBUG_ADT_LIBS
const builderLogger: IAdtLogger = createBuilderLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: IAdtLogger = createTestsLogger();

describe('StructureBuilder', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let isCloudSystem = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      hasConfig = true;
      // Check if this is a cloud system
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
   * Pre-check: Verify test structure doesn't exist
   * Safety: Skip test if object exists to avoid accidental deletion
   */
  async function ensureStructureReady(structureName: string): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: true };
    }

    // Check if structure exists
    try {
      await getStructure(connection, structureName);
      return {
        success: false,
        reason: `⚠️ SAFETY: Structure ${structureName} already exists! ` +
                `Delete manually or use different test name to avoid accidental deletion.`
      };
    } catch (error: any) {
      // 404 is expected - object doesn't exist, we can proceed
      if (error.response?.status !== 404) {
        return {
          success: false,
          reason: `Cannot verify structure existence: ${error.message}`
        };
      }
    }

    return { success: true };
  }

  function getBuilderTestDefinition() {
    return getTestCaseDefinition('create_structure', 'builder_structure');
  }

  function buildBuilderConfig(testCase: any) {
    const params = testCase?.params || {};
    const packageName = resolvePackageName(params.package_name);
    if (!packageName) {
      throw new Error('package_name not configured for StructureBuilder test');
    }
    return {
      structureName: params.structure_name,
      packageName,
      transportRequest: resolveTransportRequest(params.transport_request),
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

      const packageCheck = ensurePackageConfig(tc.params, 'StructureBuilder - full workflow');
      if (!packageCheck.success) {
        skipReason = packageCheck.reason || 'Default package is not configured';
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

    it('should execute full workflow and store all results', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(testsLogger, 'StructureBuilder - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(testsLogger, 'StructureBuilder - full workflow', skipReason);
        return;
      }

      if (!testCase || !structureName) {
        logBuilderTestSkip(testsLogger, 'StructureBuilder - full workflow', skipReason || 'Test case not available');
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
          .then(async b => {
            // Wait for SAP to finish create operation (includes lock/unlock internally)
            await new Promise(resolve => setTimeout(resolve, getOperationDelay('create', testCase)));
            logBuilderTestStep('lock');
            return b.lock();
          })
          .then(async b => {
            // Wait for SAP to commit lock operation
            await new Promise(resolve => setTimeout(resolve, getOperationDelay('lock', testCase)));
            logBuilderTestStep('update');
            return b.update();
          })
          .then(async b => {
            // Wait for SAP to commit update operation
            await new Promise(resolve => setTimeout(resolve, getOperationDelay('update', testCase)));
            logBuilderTestStep('check(inactive)');
            return b.check('inactive');
          })
          .then(b => {
            logBuilderTestStep('unlock');
            return b.unlock();
          })
          .then(async b => {
            // Wait for SAP to commit unlock operation
            await new Promise(resolve => setTimeout(resolve, getOperationDelay('unlock', testCase)));
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

        logBuilderTestSuccess(testsLogger, 'StructureBuilder - full workflow');
      } catch (error: any) {
        // Extract error message from error object (may be in message or response.data)
        const errorMsg = error.message || '';
        const errorData = error.response?.data || '';
        const errorText = typeof errorData === 'string' ? errorData : JSON.stringify(errorData);
        const fullErrorText = `${errorMsg} ${errorText}`.toLowerCase();

        // "Already exists" errors should fail the test (cleanup must work)
        logBuilderTestError(testsLogger, 'StructureBuilder - full workflow', error);
        throw error;
      } finally {
        // Cleanup: force unlock in case of failure
        await builder.forceUnlock().catch(() => {});
        logBuilderTestEnd(testsLogger, 'StructureBuilder - full workflow');
      }
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP structure', async () => {
      const testCase = getTestCaseDefinition('create_structure', 'builder_structure');
      const standardObject = resolveStandardObject('structure', isCloudSystem, testCase);

      if (!standardObject) {
        logBuilderTestStart(testsLogger, 'StructureBuilder - read standard object', {
          name: 'read_standard',
          params: {}
        });
        logBuilderTestSkip(testsLogger, 'StructureBuilder - read standard object',
          `Standard structure not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`);
        return;
      }

      const standardStructureName = standardObject.name;
      logBuilderTestStart(testsLogger, 'StructureBuilder - read standard object', {
        name: 'read_standard',
        params: { structure_name: standardStructureName }
      });

      if (!hasConfig) {
        logBuilderTestSkip(testsLogger, 'StructureBuilder - read standard object', 'No SAP configuration');
        return;
      }

      const builder = new StructureBuilder(
        connection,
        builderLogger,
        {
          structureName: standardStructureName,
          packageName: 'SAP', // Standard package
          description: '' // Not used for read operations
        }
      );

      try {
        logBuilderTestStep('read');
        await builder.read();

        const result = builder.getReadResult();
        expect(result).toBeDefined();
        expect(result?.status).toBe(200);
        expect(result?.data).toBeDefined();

        logBuilderTestSuccess(testsLogger, 'StructureBuilder - read standard object');
      } catch (error) {
        logBuilderTestError(testsLogger, 'StructureBuilder - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'StructureBuilder - read standard object');
      }
    }, getTimeout('test'));
  });
});

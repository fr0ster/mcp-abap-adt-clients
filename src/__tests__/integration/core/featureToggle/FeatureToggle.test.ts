/**
 * Integration test for FeatureToggle
 * Tests using AdtClient for unified CRUD operations + domain methods.
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_ADT_LIBS=true    - FeatureToggle library logs
 *  DEBUG_CONNECTORS=true  - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPatterns=featureToggle/FeatureToggle
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import type { IFeatureToggleObject } from '../../../../core/featureToggle';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { BaseTester } from '../../../helpers/BaseTester';
import {
  createTestAdtClient,
  getConfig,
  resolveSystemContext,
} from '../../../helpers/sessionConfig';
import { TestConfigResolver } from '../../../helpers/TestConfigResolver';
import {
  createConnectionLogger,
  createLibraryLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';
import {
  logTestEnd,
  logTestError,
  logTestSkip,
  logTestStart,
  logTestSuccess,
} from '../../../helpers/testProgressLogger';

const {
  getEnabledTestCase,
  getTestCaseDefinition,
  resolvePackageName,
  resolveTransportRequest,
  resolveMasterSystem,
  ensurePackageConfig,
  getTimeout,
} = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code uses DEBUG_ADT_LIBS
const libraryLogger: ILogger = createLibraryLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('FeatureToggle (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isLegacy = false;
  let isCloudSystem = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      isCloudSystem = await isCloudEnvironment(connection);
      const systemContext = await resolveSystemContext(
        connection,
        isCloudSystem,
      );
      const { client: resolvedClient, isLegacy: legacy } =
        await createTestAdtClient(connection, libraryLogger, systemContext);
      client = resolvedClient;
      isLegacy = legacy;
      hasConfig = true;
    } catch (_error) {
      testsLogger.warn?.(
        '⚠️ Skipping tests: No .env file or SAP configuration found',
      );
      hasConfig = false;
    }
  });

  afterAll(async () => {
    if (connection) {
      (connection as any).reset();
    }
  });

  /**
   * Pre-check: probe existence of the test feature toggle via readMetadata.
   * 404 => safe to create. Anything else => objectExists so the workflow can
   * clean up and re-run idempotently.
   */
  async function ensureFeatureToggleReady(
    featureToggleName: string,
  ): Promise<{ success: boolean; objectExists?: boolean; reason?: string }> {
    if (!connection || !client) {
      return { success: true };
    }
    try {
      await client.getFeatureToggle().readMetadata({ featureToggleName });
      return {
        success: false,
        objectExists: true,
        reason:
          `⚠️ SAFETY: Feature toggle ${featureToggleName} already exists! ` +
          `Delete manually or use a different test name to avoid accidental deletion.`,
      };
    } catch (error: any) {
      const status = error?.response?.status ?? error?.status;
      if (status === 404) {
        return { success: true };
      }
      return {
        success: false,
        reason: `Cannot verify feature toggle existence: ${error.message}`,
      };
    }
  }

  function getTestDefinition() {
    return getTestCaseDefinition('create_feature_toggle', 'adt_feature_toggle');
  }

  function buildConfig(testCase: any, resolver?: any) {
    const params = testCase?.params || {};
    const packageName =
      resolver?.getPackageName?.() || resolvePackageName(params.package_name);
    if (!packageName) {
      throw new Error('package_name not configured for FeatureToggle test');
    }
    const transportRequest =
      resolver?.getTransportRequest?.() ||
      resolveTransportRequest(params.transport_request);
    return {
      featureToggleName: params.feature_toggle_name,
      packageName,
      transportRequest,
      description: params.description,
      masterSystem: resolveMasterSystem(params.master_system),
      responsible: process.env.SAP_USERNAME || process.env.SAP_USER,
    };
  }

  /**
   * Gather the gating state (skipReason, testCase, featureToggleName) used by
   * every `it()` block below. Returns `skipReason` non-null when the test
   * should be skipped. Mirrors the AuthorizationField beforeEach but is
   * callable so the domain-method tests can reuse it.
   */
  async function resolveTestContext(): Promise<{
    skipReason: string | null;
    testCase: any | null;
    featureToggleName: string | null;
  }> {
    if (!hasConfig) {
      return {
        skipReason: 'No SAP configuration',
        testCase: null,
        featureToggleName: null,
      };
    }

    const definition = getTestDefinition();
    if (!definition) {
      return {
        skipReason: 'Test case not defined in test-config.yaml',
        testCase: null,
        featureToggleName: null,
      };
    }

    if (
      !TestConfigResolver.isTestAvailable(definition, isCloudSystem, isLegacy)
    ) {
      return {
        skipReason: `Test not available for ${
          isCloudSystem ? 'cloud' : isLegacy ? 'legacy' : 'onprem'
        } environment`,
        testCase: null,
        featureToggleName: null,
      };
    }

    const tc = getEnabledTestCase(
      'create_feature_toggle',
      'adt_feature_toggle',
    );
    if (!tc) {
      return {
        skipReason: 'Test case disabled or not found',
        testCase: null,
        featureToggleName: null,
      };
    }

    const packageCheck = ensurePackageConfig(tc.params, 'FeatureToggle');
    if (!packageCheck.success) {
      return {
        skipReason: packageCheck.reason || 'Default package is not configured',
        testCase: null,
        featureToggleName: null,
      };
    }

    return {
      skipReason: null,
      testCase: tc,
      featureToggleName: tc.params.feature_toggle_name,
    };
  }

  /**
   * Ensure the test feature toggle exists in the system (for domain-method
   * tests that don't execute the full create flow themselves). If it doesn't
   * exist, create it via the handler so the domain methods have something to
   * observe. Returns null on success or a skip reason on failure.
   */
  async function ensureFeatureToggleExists(
    testCase: any,
    featureToggleName: string,
  ): Promise<string | null> {
    try {
      await client.getFeatureToggle().readMetadata({ featureToggleName });
      return null;
    } catch (error: any) {
      const status = error?.response?.status ?? error?.status;
      if (status !== 404) {
        return `Cannot verify feature toggle: ${error.message}`;
      }
    }
    try {
      const resolver = new TestConfigResolver({
        testCase,
        isCloud: isCloudSystem,
        logger: testsLogger,
      });
      const config = buildConfig(testCase, resolver);
      await client.getFeatureToggle().create(config);
      return null;
    } catch (error: any) {
      return `Failed to create feature toggle for domain test: ${error.message}`;
    }
  }

  describe('Full workflow', () => {
    let testCase: any = null;
    let featureToggleName: string | null = null;
    let skipReason: string | null = null;

    beforeEach(async () => {
      const ctx = await resolveTestContext();
      skipReason = ctx.skipReason;
      testCase = ctx.testCase;
      featureToggleName = ctx.featureToggleName;

      if (skipReason || !featureToggleName) {
        return;
      }

      const cleanup = await ensureFeatureToggleReady(featureToggleName);
      if (!cleanup.success) {
        if (
          /^[ZY]/i.test(featureToggleName) &&
          client &&
          cleanup.objectExists
        ) {
          try {
            await client.getFeatureToggle().delete({
              featureToggleName,
              transportRequest: resolveTransportRequest(
                testCase.params.transport_request,
              ),
            });
            testsLogger.info?.(
              `Pre-existing feature toggle ${featureToggleName} deleted before test`,
            );
          } catch (deleteErr: any) {
            skipReason = `Pre-existing feature toggle cleanup failed: ${deleteErr.message}`;
            testCase = null;
            featureToggleName = null;
          }
        } else {
          skipReason =
            cleanup.reason || 'Failed to cleanup feature toggle before test';
          testCase = null;
          featureToggleName = null;
        }
      }
    });

    it(
      'should execute full workflow and store all results',
      async () => {
        const definition = getTestDefinition();
        logTestStart(testsLogger, 'FeatureToggle - full workflow', definition);

        if (skipReason) {
          logTestSkip(testsLogger, 'FeatureToggle - full workflow', skipReason);
          return;
        }

        if (!testCase || !featureToggleName) {
          logTestSkip(
            testsLogger,
            'FeatureToggle - full workflow',
            skipReason || 'Test case not available',
          );
          return;
        }

        const resolver = new TestConfigResolver({
          testCase,
          isCloud: isCloudSystem,
          logger: testsLogger,
        });
        const config = buildConfig(testCase, resolver);

        const tester = new BaseTester(
          client.getFeatureToggle(),
          'FeatureToggle',
          'create_feature_toggle',
          'adt_feature_toggle',
          testsLogger,
        );

        try {
          await tester.flowTest(config, testCase.params, {
            updateConfig: {
              featureToggleName: config.featureToggleName,
              packageName: config.packageName!,
              description:
                testCase.params.update_description ||
                `${config.description || 'updated'} (upd)`,
            },
          });

          logTestSuccess(testsLogger, 'FeatureToggle - full workflow');
        } catch (error: any) {
          logTestError(testsLogger, 'FeatureToggle - full workflow', error);
          throw error;
        } finally {
          logTestEnd(testsLogger, 'FeatureToggle - full workflow');
        }
      },
      getTimeout('test'),
    );
  });

  describe('Domain methods', () => {
    let testCase: any = null;
    let featureToggleName: string | null = null;
    let skipReason: string | null = null;

    beforeEach(async () => {
      const ctx = await resolveTestContext();
      skipReason = ctx.skipReason;
      testCase = ctx.testCase;
      featureToggleName = ctx.featureToggleName;

      if (skipReason || !featureToggleName || !testCase) {
        return;
      }

      // Domain tests operate on an existing toggle — make sure one exists.
      const ensureReason = await ensureFeatureToggleExists(
        testCase,
        featureToggleName,
      );
      if (ensureReason) {
        skipReason = ensureReason;
        testCase = null;
        featureToggleName = null;
      }
    });

    it(
      'should fetch runtime state',
      async () => {
        if (skipReason || !featureToggleName) {
          logTestSkip(
            testsLogger,
            'FeatureToggle - getRuntimeState',
            skipReason || 'Test case not available',
          );
          return;
        }
        const handler: IFeatureToggleObject = client.getFeatureToggle();
        const state = await handler.getRuntimeState({ featureToggleName });
        expect(state.runtimeState).toBeDefined();
        expect(state.runtimeState?.name).toBe(featureToggleName.toUpperCase());
        expect(['on', 'off', 'undefined']).toContain(
          state.runtimeState?.clientState,
        );
      },
      getTimeout('test'),
    );

    it(
      'should check state (pre-flight)',
      async () => {
        if (skipReason || !featureToggleName) {
          logTestSkip(
            testsLogger,
            'FeatureToggle - checkState',
            skipReason || 'Test case not available',
          );
          return;
        }
        const handler: IFeatureToggleObject = client.getFeatureToggle();
        const state = await handler.checkState({ featureToggleName });
        expect(state.checkStateResult).toBeDefined();
        expect(typeof state.checkStateResult?.customizingTransportAllowed).toBe(
          'boolean',
        );
      },
      getTimeout('test'),
    );

    it(
      'should read source',
      async () => {
        if (skipReason || !featureToggleName) {
          logTestSkip(
            testsLogger,
            'FeatureToggle - readSource',
            skipReason || 'Test case not available',
          );
          return;
        }
        const handler: IFeatureToggleObject = client.getFeatureToggle();
        const state = await handler.readSource({ featureToggleName });
        expect(state.readResult).toBeDefined();
        expect(state.sourceResult).toBeDefined();
      },
      getTimeout('test'),
    );

    // Switch on/off requires a transport request. Cloud trial has no transport
    // system, so gate the test with it.skip when none is configured.
    const resolvedTransport = resolveTransportRequest();
    const switchIt = resolvedTransport ? it : it.skip;
    switchIt(
      'should switch toggle on/off',
      async () => {
        if (skipReason || !featureToggleName) {
          logTestSkip(
            testsLogger,
            'FeatureToggle - switch on/off',
            skipReason || 'Test case not available',
          );
          return;
        }
        const transportRequest = resolveTransportRequest(
          testCase?.params?.transport_request,
        );
        const handler: IFeatureToggleObject = client.getFeatureToggle();
        const onState = await handler.switchOn(
          { featureToggleName },
          { transportRequest },
        );
        expect(
          onState.runtimeState?.clientState === 'on' ||
            onState.runtimeState?.clientState === 'undefined',
        ).toBe(true);

        const offState = await handler.switchOff(
          { featureToggleName },
          { transportRequest },
        );
        expect(
          offState.runtimeState?.clientState === 'off' ||
            offState.runtimeState?.clientState === 'undefined',
        ).toBe(true);
      },
      getTimeout('test'),
    );
  });
});

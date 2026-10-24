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
import {
  featureToggleCheckState,
  featureToggleRuntimeState,
} from '@mcp-abap-adt/adt-strategies';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import { featureToggleDocuments } from '../../../../core/featureToggle/types';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { integrationHeadersOf } from '../../../helpers/adtHeaders';
import { BaseTester } from '../../../helpers/BaseTester';
import {
  configuredCase,
  gate,
  gateAll,
  missingCaseMessage,
} from '../../../helpers/caseGate';
import { expectResult } from '../../../helpers/contract';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
  resolveSystemContext,
  skipUnlessConfigured,
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

const featureToggleReadings = {
  ...featureToggleDocuments,
  runtimeState: featureToggleRuntimeState,
  checkState: featureToggleCheckState,
};

const {
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

/**
 * The system's own refusal to create feature toggles.
 *
 * the on-premise system answers `403 "It is not allowed to create/update feature toggles in this
 * system."` — a policy, not a defect and not something a test can arrange
 * around. Recognised so the suite can say that instead of failing, and
 * recognised narrowly: any other 403 is a real failure and still is one.
 */
function isCreationForbiddenBySystem(error: unknown): boolean {
  const e = error as { response?: { status?: number; data?: unknown } };
  if (e?.response?.status !== 403) return false;
  const body =
    typeof e.response?.data === 'string'
      ? e.response.data
      : JSON.stringify(e.response?.data ?? '');
  return /not allowed to create\/update feature toggles/i.test(body);
}

/** A gated test whose setup failed is red with the reason, never a skip. */
function notReady(reason: string): Error {
  return new Error(
    `Test could not be set up: ${reason}. Nothing was verified.`,
  );
}

describe('FeatureToggle (using AdtClient)', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
      isCloudSystem = await isCloudEnvironment(connection);
      const systemContext = await resolveSystemContext(
        connection,
        isCloudSystem,
      );
      const { client: resolvedClient } = await createTestAdtClient(
        connection,
        libraryLogger,
        systemContext,
      );
      client = resolvedClient;
      hasConfig = true;
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      hasConfig = skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(async () => {
    if (connection) {
      await releaseTestConnection(connection);
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
    return configuredCase('create_feature_toggle', 'adt_feature_toggle');
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
   * Gather the gating state (setupError, testCase, featureToggleName) used by
   * every `it()` block below. Returns `setupError` non-null when the test
   * should be skipped. Mirrors the AuthorizationField beforeEach but is
   * callable so the domain-method tests can reuse it.
   */
  async function resolveTestContext(): Promise<{
    setupError: string | null;
    testCase: any | null;
    featureToggleName: string | null;
  }> {
    if (!hasConfig) {
      return {
        setupError: 'No SAP configuration',
        testCase: null,
        featureToggleName: null,
      };
    }

    // The gate registered the tests, so the case is configured, enabled and
    // available here; a case that is not there is a defect, not a skip.
    const tc = getTestDefinition();
    if (!tc) {
      return {
        setupError: missingCaseMessage(
          'create_feature_toggle',
          'adt_feature_toggle',
        ),
        testCase: null,
        featureToggleName: null,
      };
    }

    const packageCheck = ensurePackageConfig(tc.params, 'FeatureToggle');
    if (!packageCheck.success) {
      return {
        setupError: packageCheck.reason || 'Default package is not configured',
        testCase: null,
        featureToggleName: null,
      };
    }

    return {
      setupError: null,
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
      await client.getFeatureToggle().create(config, {
        headers: integrationHeadersOf(client.getFeatureToggle(), 'create'),
      });
      return null;
    } catch (error: any) {
      return `Failed to create feature toggle for domain test: ${error.message}`;
    }
  }

  describe('Full workflow', () => {
    let testCase: any = null;
    let featureToggleName: string | null = null;
    let setupError: string | null = null;

    beforeEach(async () => {
      const ctx = await resolveTestContext();
      setupError = ctx.setupError;
      testCase = ctx.testCase;
      featureToggleName = ctx.featureToggleName;

      if (setupError || !featureToggleName) {
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
            await client.getFeatureToggle().delete(
              {
                featureToggleName,
                transportRequest: resolveTransportRequest(
                  testCase.params.transport_request,
                ),
              },
              {
                headers: integrationHeadersOf(
                  client.getFeatureToggle(),
                  'delete',
                ),
              },
            );
            testsLogger.info?.(
              `Pre-existing feature toggle ${featureToggleName} deleted before test`,
            );
          } catch (deleteErr: any) {
            setupError = `Pre-existing feature toggle cleanup failed: ${deleteErr.message}`;
            testCase = null;
            featureToggleName = null;
          }
        } else {
          setupError =
            cleanup.reason || 'Failed to cleanup feature toggle before test';
          testCase = null;
          featureToggleName = null;
        }
      }
    });

    gate('create_feature_toggle', 'adt_feature_toggle')(
      'should execute full workflow and store all results',
      async () => {
        const definition = getTestDefinition();
        logTestStart(testsLogger, 'FeatureToggle - full workflow', definition);

        if (setupError || !featureToggleName) {
          throw notReady(setupError ?? 'feature_toggle_name not configured');
        }

        if (!testCase || !featureToggleName) {
          throw notReady('feature_toggle_name not configured');
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
          // The system refusing to have feature toggles created in it is not a
          // failure of this code, and no arrangement here can get past it.
          // Anything else is, and still fails.
          if (isCreationForbiddenBySystem(error)) {
            logTestSkip(
              testsLogger,
              'FeatureToggle - full workflow',
              'the system does not allow creating feature toggles — 403 "It is not allowed to create/update feature toggles in this system."',
            );
            return;
          }
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
    let setupError: string | null = null;

    beforeEach(async () => {
      const ctx = await resolveTestContext();
      setupError = ctx.setupError;
      testCase = ctx.testCase;
      featureToggleName = ctx.featureToggleName;

      if (setupError || !featureToggleName || !testCase) {
        return;
      }

      // Domain tests operate on an existing toggle — make sure one exists.
      const ensureReason = await ensureFeatureToggleExists(
        testCase,
        featureToggleName,
      );
      if (ensureReason) {
        setupError = ensureReason;
        testCase = null;
        featureToggleName = null;
      }
    });

    gate('create_feature_toggle', 'adt_feature_toggle')(
      'should fetch runtime state',
      async () => {
        if (setupError || !featureToggleName) {
          throw notReady(setupError ?? 'feature_toggle_name not configured');
        }
        // The states are JSON documents; the readings that build the shapes
        // asserted below are strategies the test passes.
        const handler = client.getFeatureToggle(featureToggleReadings);
        const state = expectResult(
          await handler.getRuntimeState({ featureToggleName }),
          'getRuntimeState',
        );
        expect(state.name).toBe(featureToggleName.toUpperCase());
        expect(['on', 'off', 'undefined']).toContain(state.clientState);
      },
      getTimeout('test'),
    );

    gate('create_feature_toggle', 'adt_feature_toggle')(
      'should check state (pre-flight)',
      async () => {
        if (setupError || !featureToggleName) {
          throw notReady(setupError ?? 'feature_toggle_name not configured');
        }
        // The states are JSON documents; the readings that build the shapes
        // asserted below are strategies the test passes.
        const handler = client.getFeatureToggle(featureToggleReadings);
        const state = expectResult(
          await handler.checkState({ featureToggleName }, undefined, {
            headers: integrationHeadersOf(handler, 'checkState'),
          }),
          'checkState',
        );
        expect(typeof state.customizingTransportAllowed).toBe('boolean');
      },
      getTimeout('test'),
    );

    gate('create_feature_toggle', 'adt_feature_toggle')(
      'should read source',
      async () => {
        if (setupError || !featureToggleName) {
          throw notReady(setupError ?? 'feature_toggle_name not configured');
        }
        // The states are JSON documents; the readings that build the shapes
        // asserted below are strategies the test passes.
        const handler = client.getFeatureToggle(featureToggleReadings);
        // The source document, as it arrived. A caller who wants
        // `IFeatureToggleSource` parsed out of it supplies a strategy that does
        // it — this member does not decide that for everyone.
        const source = expectResult(
          await handler.readSource({ featureToggleName }),
          'readSource',
        );
        expect(typeof source).toBe('string');
      },
      getTimeout('test'),
    );

    // Switch on/off requires a transport request. The ABAP Cloud system has no transport
    // system, so gate the test with it.skip when none is configured.
    const resolvedTransport = resolveTransportRequest();
    const switchIt = gateAll(
      gate('create_feature_toggle', 'adt_feature_toggle'),
      resolvedTransport ? it : it.skip,
    );
    switchIt(
      'should switch toggle on/off',
      async () => {
        if (setupError || !featureToggleName) {
          throw notReady(setupError ?? 'feature_toggle_name not configured');
        }
        const transportRequest = resolveTransportRequest(
          testCase?.params?.transport_request,
        );
        // The states are JSON documents; the readings that build the shapes
        // asserted below are strategies the test passes.
        const handler = client.getFeatureToggle(featureToggleReadings);
        // The switch answers the toggle's own response; the runtime state is a
        // second request, and the test makes it because the library no longer
        // makes it for the caller.
        expectResult(
          await handler.switchOn({ featureToggleName }, { transportRequest }),
          'switchOn',
        );
        const onState = expectResult(
          await handler.getRuntimeState({ featureToggleName }),
          'onState',
        );
        expect(
          onState?.clientState === 'on' || onState?.clientState === 'undefined',
        ).toBe(true);

        expectResult(
          await handler.switchOff({ featureToggleName }, { transportRequest }),
          'switchOff',
        );
        const offState = expectResult(
          await handler.getRuntimeState({ featureToggleName }),
          'offState',
        );
        expect(
          offState?.clientState === 'off' ||
            offState?.clientState === 'undefined',
        ).toBe(true);
      },
      getTimeout('test'),
    );
  });
});

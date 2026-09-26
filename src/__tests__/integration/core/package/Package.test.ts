/**
 * Integration test for Package
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 * - DEBUG_ADT_TESTS=true npm test -- --testPathPatterns=package  (ADT-clients logs)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyseDeletion } from '@mcp-abap-adt/adt-strategies';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import type { IPackageConfig } from '../../../../core/package';
import { deletePackage } from '../../../../core/package/delete';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { patchXmlAttribute } from '../../../../utils/xmlPatch';
import { BaseTester } from '../../../helpers/BaseTester';
import { expectResult } from '../../../helpers/contract';
import { presenceOf } from '../../../helpers/objectPresence';
import {
  createTestAdtClient,
  createTestConnection,
  getConfig,
  recycleTestSession,
  resolveSystemContext,
  skipUnlessConfigured,
} from '../../../helpers/sessionConfig';
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
  getTestCaseDefinition,
  resolveMasterSystem,
  resolvePackageName,
  resolveTransportRequest,
  resolveStandardObject,
  getTimeout,
} = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const debugEnabled =
  process.env.DEBUG_ADT_TESTS === 'true' || process.env.DEBUG_ADT === 'true';
const _debugConnection = process.env.DEBUG_CONNECTORS === 'true'; // Connection uses DEBUG_CONNECTORS

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code uses DEBUG_ADT_LIBS
const libraryLogger: ILogger = createLibraryLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('Package (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let _connectionConfig: any = null;
  let hasConfig = false;
  let isLegacy = false;
  let isCloudSystem = false;
  let tester: BaseTester<IPackageConfig>;

  beforeAll(async () => {
    try {
      const config = getConfig();
      _connectionConfig = config;
      connection = await createTestConnection(connectionLogger);
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

      tester = new BaseTester(
        // getPackage() is narrowed to Crud & Validatable & Checkable &
        // Lockable & TransportAware (no activate/getVersions); BaseTester's
        // flowTest still exercises activate, which the concrete handler
        // implements at runtime — cast through the full interface.
        client.getPackage(),
        'Package',
        'create_package',
        'adt_package',
        testsLogger,
      );

      tester.setup({
        connection,
        client,
        hasConfig,
        isCloudSystem,
        buildConfig: (testCase: any, resolver?: any) => {
          const params = testCase?.params || {};
          // Use resolver to get resolved parameters (from test case params or global defaults)
          // Priority: super_package > package_name (from resolver) > global default
          const parentPackage =
            params.super_package ||
            resolver?.getPackageName?.() ||
            resolvePackageName(params.package_name);
          if (!parentPackage)
            throw new Error('Parent package is not configured');
          const testPackage =
            params.test_package ||
            params.test_package_name ||
            params.package_name;
          if (!testPackage) throw new Error('test_package is not configured');
          return {
            packageName: testPackage,
            superPackage: parentPackage,
            description: params.description,
            packageType: params.package_type || 'development',
            softwareComponent: params.software_component,
            transportLayer: params.transport_layer,
            transportRequest: resolveTransportRequest(params.transport_request),
            applicationComponent: params.application_component,
            responsible: params.responsible,
            masterSystem: resolveMasterSystem(params.master_system),
            recordChanges: params.record_changes === true,
          };
        },
        cleanupObject: async (cfg: IPackageConfig) => {
          // **A fresh ABAP session for the delete** (issue #176). `CL_PACKAGE`
          // keeps a static instance buffer for the whole ABAP session, and a
          // create or an update leaves the package's instance in it in state
          // `requested`. Delete loads the package from that buffer and
          // `set_changeable` refuses: `isDeleted="false"` with PAK/058,
          // "already locked", inside a 200. No ADT call resets the buffer, so
          // the only way out is a session that has not saved the package.
          // Measured on E19 2026-09-26 over HTTP and RFC alike: delete right
          // after an update is refused from the updating session and succeeds
          // from a new one.
          //
          // `recycleTestSession` replaces the run's one session — it never
          // opens a second beside it. This is the consumer's workaround and
          // lives here, in the test; the library's `delete` stays one request.
          if (connection) {
            await recycleTestSession(connection);
          }

          // `isDeleted="false"` with PAK/058 arrives inside a 200, and the
          // library reads nothing into it — so the test passes the reading.
          // Without one a refused delete was silent: three runs passed this
          // flow and left ZAC_INNER_PKG04 behind every time.
          expectResult(
            await client.getPackage().delete(
              {
                packageName: cfg.packageName,
                transportRequest: cfg.transportRequest,
              },
              { analyse: analyseDeletion },
            ),
            `delete package ${cfg.packageName}`,
          );
        },
        ensureObjectReady: async (packageName: string) => {
          if (!connection || !client) return { success: true };
          // The answer decides — see `presenceOf`. "Could not find out" stays
          // apart from "it is not there": creating over a package that may be
          // there is the irreversible half of that guess.
          const presence = presenceOf(
            await client.getPackage().readMetadata({ packageName }),
            `package ${packageName}`,
          );
          if (presence.present === 'unknown') {
            return { success: false, reason: `⚠️ SAFETY: ${presence.reason}` };
          }
          if (presence.present) {
            return {
              success: false,
              objectExists: true,
              reason: `⚠️ SAFETY: Package ${packageName} already exists!`,
            };
          }
          return { success: true };
        },
      });
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      hasConfig = skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(() => tester?.afterAll()());

  describe('Full workflow', () => {
    beforeEach(() => tester?.beforeEach()());
    afterEach(() => tester?.afterEach()());

    it(
      'should execute full workflow and store all results',
      async () => {
        if (!tester) {
          return;
        }

        if (!hasConfig) {
          await tester.flowTestAuto();
          return;
        }
        const config = tester.getConfig();
        if (!config) {
          await tester.flowTestAuto();
          return;
        }

        await tester.flowTestAuto({
          // **The update in its own ABAP session** (issue #176): the create
          // leaves the package in `CL_PACKAGE`'s session buffer as
          // `requested`, and a PUT from the same session is refused with 400
          // PAK/058. Over HTTP the create is stateless and its session is gone
          // anyway; over RFC every call shares one session, so without this
          // the update fails there. Replacing the session is what a consumer
          // has to do too — the library does not do it for them.
          afterCreate: () => recycleTestSession(connection),
          updateTakesDocument: (current) =>
            patchXmlAttribute(
              current,
              'adtcore:description',
              `${config.description || ''} (updated)`.slice(0, 60),
            ),
          // Packages do not require activation in ADT
          activateOnCreate: true,
          activateOnUpdate: true,
          updateConfig: {
            packageName: config.packageName,
            superPackage: config.superPackage,
            description: config.description || '',
            packageType: config.packageType,
            softwareComponent: config.softwareComponent,
            transportLayer: config.transportLayer,
            applicationComponent: config.applicationComponent,
            responsible: config.responsible,
          },
        });
      },
      getTimeout('test'),
    );
  });

  describe('Read standard object', () => {
    it(
      'should read standard SAP package',
      async () => {
        const standardObject = resolveStandardObject(
          'package',
          isCloudSystem,
          null,
          isLegacy,
        );

        if (!standardObject) {
          logTestStart(testsLogger, 'Package - read standard object', {
            name: 'read_standard',
            params: {},
          });
          logTestSkip(
            testsLogger,
            'Package - read standard object',
            `Standard package not configured for ${isCloudSystem ? 'cloud' : isLegacy ? 'legacy' : 'on-premise'} environment`,
          );
          return;
        }

        const standardPackageName = standardObject.name;
        logTestStart(testsLogger, 'Package - read standard object', {
          name: 'read_standard',
          params: { package_name: standardPackageName },
        });

        if (!hasConfig) {
          logTestSkip(
            testsLogger,
            'Package - read standard object',
            'No SAP configuration',
          );
          return;
        }

        try {
          const resultState = await tester.readTest({
            packageName: standardPackageName,
          });
          expect(resultState).toBeDefined();
          const packageConfig = resultState;
          if (
            packageConfig &&
            typeof packageConfig === 'object' &&
            'packageName' in packageConfig
          ) {
            expect((packageConfig as any).packageName).toBe(
              standardPackageName,
            );
          }

          logTestSuccess(testsLogger, 'Package - read standard object');
        } catch (error) {
          logTestError(testsLogger, 'Package - read standard object', error);
          throw error;
        } finally {
          logTestEnd(testsLogger, 'Package - read standard object');
        }
      },
      getTimeout('test'),
    );
  });
});

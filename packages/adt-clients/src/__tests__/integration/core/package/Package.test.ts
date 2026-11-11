/**
 * Integration test for Package
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 * - DEBUG_ADT_TESTS=true npm test -- --testPathPatterns=package  (ADT-clients logs)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  analyseDeletion,
  analyseException,
} from '@mcp-abap-adt/adt-strategies';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import {
  type IPackageChanges,
  type IPackageConfig,
  patchPackageDocument,
} from '../../../../core/package';
import { deletePackage } from '../../../../core/package/delete';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { integrationHeadersOf } from '../../../helpers/adtHeaders';
import { BaseTester } from '../../../helpers/BaseTester';
import { gate, gateStandardObject } from '../../../helpers/caseGate';
import { expectFailure, expectResult } from '../../../helpers/contract';
import {
  descriptionOfLength,
  expectDescriptionRefused,
  overTheLimit,
  swbToolTooLong,
} from '../../../helpers/descriptionLimit';
import { documentAt } from '../../../helpers/documentAt';
import { judged } from '../../../helpers/judged';
import { presenceOf } from '../../../helpers/objectPresence';
import { patchedDocument } from '../../../helpers/patchedDocument';
import { readRootDescription } from '../../../helpers/rootDescription';
import {
  createTestAdtClient,
  createTestConnection,
  getConfig,
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
  logTestStart,
  logTestSuccess,
} from '../../../helpers/testProgressLogger';

const {
  getSharedDependenciesConfig,
  getTestCaseDefinition,
  resolveMasterSystem,
  resolvePackageName,
  resolveTransportRequest,
  resolveStandardObject,
  getTimeout,
} = require('../../../helpers/test-helper');

const ATTRIBUTES = ['pak:attributes'];
const SOFTWARE_COMPONENT = ['pak:transport', 'pak:softwareComponent'];
const TRANSPORT_LAYER = ['pak:transport', 'pak:transportLayer'];

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
      const { client: resolvedClient } = await createTestAdtClient(
        connection,
        libraryLogger,
        systemContext,
      );
      client = resolvedClient;
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
          // Measured on premise (BASIS 816) 2026-09-26 over HTTP and RFC alike: delete right
          // after an update is refused from the updating session and succeeds
          // from a new one.
          //
          // `recycleSession` replaces the run's one session — it never opens a
          // second beside it — on a new connection instance, since one
          // instance is one session (connection 16); the client below is the
          // one built over it. This is the consumer's workaround and lives
          // here, in the test; the library's `delete` stays one request.
          if (connection) {
            ({ connection, client } = await tester.recycleSession());
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
              {
                headers: integrationHeadersOf(client.getPackage(), 'delete'),
                analyse: judged(analyseDeletion),
              },
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
            await client
              .getPackage()
              .readMetadata({ packageName }, { analyse: analyseException }),
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

    gate('create_package', 'adt_package')(
      'should execute full workflow and store all results',
      async () => {
        const config = await tester.requireConfig();
        // Exactly the 60 characters a package's description holds: stored
        // whole. One more is refused by SAP, asserted after the update.
        const description = descriptionOfLength(
          `${config.description || ''} (updated)`,
          60,
        );

        await tester.flowTestAuto({
          // **The update in its own ABAP session** (issue #176): the create
          // leaves the package in `CL_PACKAGE`'s session buffer as
          // `requested`, and a PUT from the same session is refused with 400
          // PAK/058. Over HTTP the create is stateless and its session is gone
          // anyway; over RFC every call shares one session, so without this
          // the update fails there. Replacing the session is what a consumer
          // has to do too — the library does not do it for them.
          afterCreate: async () => {
            ({ connection, client } = await tester.recycleSession());
          },
          updateTakesDocument: (current) =>
            patchedDocument(
              patchPackageDocument(current, { description }),
              'package update',
            ),
          // The super package moved by name alone; SAP resolves the reference
          // (measured): the read-back carries its own uri and type.
          afterUpdate: async (pkg) => {
            expect(readRootDescription(await pkg.read())).toBe(description);
            // A write from the session that wrote last is refused (#176).
            ({ connection, client } = await tester.recycleSession());
            const target = getSharedDependenciesConfig()?.package;
            if (!target) throw new Error('shared_dependencies.package not set');
            await pkg.write(
              patchedDocument(
                patchPackageDocument(await pkg.read(), {
                  superPackage: target,
                }),
                'package move',
              ),
            );
            const stored = await pkg.read();
            const reference =
              documentAt(stored, ['pak:superPackage'])?.attributes ?? {};
            expect([
              reference['adtcore:uri'],
              reference['adtcore:type'],
              reference['adtcore:name'],
            ]).toEqual([
              `/sap/bc/adt/packages/${target.toLowerCase()}`,
              'DEVC/K',
              target,
            ]);

            // Over the limit: passed as given, refused by SAP, and the stored
            // description stays.
            ({ connection, client } = await tester.recycleSession());
            expectDescriptionRefused(
              await pkg.attempt(
                patchedDocument(
                  patchPackageDocument(stored, {
                    description: overTheLimit(60),
                  }),
                  'package description over the limit',
                ),
              ),
              swbToolTooLong(60),
            );
            expect(readRootDescription(await pkg.read())).toBe(description);

            // Every other field, one write each, through the shipped patch.
            // Where the system offers no other value, the patch writes its own
            // (the user who created the package, the master system, the
            // software component, the transport layer SAP answered) and SAP
            // stores it. A change SAP does not allow is refused, and the
            // stored value stays (measured 2026-11-11):
            //   packageType → `main` under a development super package:
            //     onprem 400 `00/001` "Package type cannot be changed.
            //     Superpackage … is not a structure package or main package.",
            //     cloud 404 `PAK/188` "No authorization to change the package type";
            //   recordChanges flipped: onprem (transportable) 400 `TR/432`
            //     "Change recording must be activated", cloud (local) 404
            //     `TR/434` "No change recording for local packages";
            //   transportLayer → '' while recording: onprem 400 `TR/609`
            //     "Transport layer  does not exist" (cloud has no other layer).
            const attributeOf = (
              document: string,
              at: readonly string[],
              name: string,
            ) => documentAt(document, at)?.attributes[name];
            const attemptChange = async (
              changes: IPackageChanges,
              what: string,
            ) => {
              ({ connection, client } = await tester.recycleSession());
              return pkg.attempt(
                patchedDocument(
                  patchPackageDocument(await pkg.read(), changes),
                  what,
                ),
              );
            };
            const own = await pkg.read();
            const kept: ReadonlyArray<{
              changes: IPackageChanges;
              at: readonly string[];
              name: string;
              value: string | undefined;
            }> = [
              {
                changes: {
                  responsible: attributeOf(own, [], 'adtcore:createdBy'),
                },
                at: [],
                name: 'adtcore:responsible',
                value: attributeOf(own, [], 'adtcore:createdBy'),
              },
              {
                changes: {
                  masterSystem: attributeOf(own, [], 'adtcore:masterSystem'),
                },
                at: [],
                name: 'adtcore:masterSystem',
                value: attributeOf(own, [], 'adtcore:masterSystem'),
              },
              {
                changes: {
                  softwareComponent: attributeOf(
                    own,
                    SOFTWARE_COMPONENT,
                    'pak:name',
                  ),
                },
                at: SOFTWARE_COMPONENT,
                name: 'pak:name',
                value: attributeOf(own, SOFTWARE_COMPONENT, 'pak:name'),
              },
              {
                changes: {
                  transportLayer: attributeOf(own, TRANSPORT_LAYER, 'pak:name'),
                },
                at: TRANSPORT_LAYER,
                name: 'pak:name',
                value: attributeOf(own, TRANSPORT_LAYER, 'pak:name'),
              },
            ];
            for (const step of kept) {
              const field = Object.keys(step.changes).join();
              expect(step.value).toBeDefined();
              ({ connection, client } = await tester.recycleSession());
              await pkg.write(
                patchedDocument(
                  patchPackageDocument(await pkg.read(), step.changes),
                  `package ${field}`,
                ),
              );
              expect(attributeOf(await pkg.read(), step.at, step.name)).toBe(
                step.value,
              );
            }

            const recording =
              attributeOf(own, ATTRIBUTES, 'pak:recordChanges') === 'true';
            const refused: ReadonlyArray<{
              changes: IPackageChanges;
              at: readonly string[];
              name: string;
              status: number;
              t100: unknown;
            }> = [
              {
                changes: { packageType: 'main' },
                at: ATTRIBUTES,
                name: 'pak:packageType',
                ...(isCloudSystem
                  ? { status: 404, t100: { id: 'PAK', no: '188' } }
                  : {
                      status: 400,
                      t100: expect.objectContaining({ id: '00', no: '001' }),
                    }),
              },
              {
                changes: { recordChanges: !recording },
                at: ATTRIBUTES,
                name: 'pak:recordChanges',
                status: isCloudSystem ? 404 : 400,
                t100: {
                  id: 'TR',
                  no: isCloudSystem ? '434' : '432',
                  values: [config.packageName],
                },
              },
              ...(isCloudSystem
                ? []
                : [
                    {
                      changes: { transportLayer: '' },
                      at: TRANSPORT_LAYER,
                      name: 'pak:name',
                      status: 400,
                      t100: { id: 'TR', no: '609' },
                    },
                  ]),
            ];
            for (const step of refused) {
              const field = Object.keys(step.changes).join();
              const before = attributeOf(await pkg.read(), step.at, step.name);
              const failure = expectFailure(
                await attemptChange(step.changes, `package ${field}`),
                `package ${field}`,
              );
              expect(failure.response?.status).toBe(step.status);
              expect(failure.messages.map((m) => m.t100)).toContainEqual(
                step.t100,
              );
              expect(attributeOf(await pkg.read(), step.at, step.name)).toBe(
                before,
              );
            }
          },
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
    gateStandardObject('package')(
      'should read standard SAP package',
      async () => {
        const standardObject = resolveStandardObject(
          'package',
          isCloudSystem,
          null,
        );

        if (!standardObject) {
          throw new Error(
            `Standard package not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`,
          );
        }

        const standardPackageName = standardObject.name;
        logTestStart(testsLogger, 'Package - read standard object', {
          name: 'read_standard',
          params: { package_name: standardPackageName },
        });

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

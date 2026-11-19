/**
 * Live: a table's technical settings written to non-default values
 * (`getTableSettings()`, adt-clients 46.0.0). On premise and on the cloud.
 *
 * Creates a table under a fresh name in the test package, writes its DDL and
 * activates it. Then, under the settings' own lock: reads the settings with
 * the library's reading (`tableSettings` of adt-strategies, which throws
 * naming any setting the read lacks), changes data class (APPL1), size
 * category (1), buffering (allowed X, single records) and logging (on), keeps
 * every other setting — the translation's four attributes included — as read,
 * and writes the whole set with the read's ETag as `If-Match` (a read with no
 * ETag fails the test); unlocks on every path. Activates the table, which
 * activates its settings, reads the active settings back and asserts that
 * every setting is what was written, the unchanged ones included. Cleanup
 * releases any lock still held, then deletes the table and reads its absence
 * back — also when a step failed.
 *
 * Run: npm test -- --testPathPatterns 'integration/core/tableSettings/TableSettings\.test\.ts$'
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  analyseActivation,
  analyseDeletion,
  analyseException,
  tableSettings,
} from '@mcp-abap-adt/adt-strategies';
import {
  type ITableSettingsRead,
  TABLE_SETTINGS_MEDIA_TYPE,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import { tableSettingsDocuments } from '../../../../core/tableSettings/types';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { freshSuffix } from '../../../helpers/abapUnitProbes';
import { integrationHeadersOf } from '../../../helpers/adtHeaders';
import {
  configuredCase,
  gate,
  missingCaseMessage,
} from '../../../helpers/caseGate';
import {
  expectResult,
  raiseAfterCleanup,
  releasing,
} from '../../../helpers/contract';
import { removeAndReadBack } from '../../../helpers/ifMatchProbes';
import { judged } from '../../../helpers/judged';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
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
  logTestStep,
  logTestSuccess,
} from '../../../helpers/testProgressLogger';

const {
  getTimeout,
  resolvePackageName,
  resolveTransportRequest,
} = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger: ILogger = createConnectionLogger();
const libraryLogger: ILogger = createLibraryLogger();
const testsLogger: ILogger = createTestsLogger();

const SECTION = 'table_settings';
const CASE = 'adt_table_settings';
const TITLE = 'TableSettings - non-default settings written and activated';

/** The table's DDL: the one key field a transparent table needs. */
function tableDdl(tableName: string, label: string): string {
  return `@EndUserText.label : '${label}'
@AbapCatalog.enhancement.category : #NOT_EXTENSIBLE
@AbapCatalog.tableCategory : #TRANSPARENT
@AbapCatalog.deliveryClass : #A
@AbapCatalog.dataMaintenance : #RESTRICTED
define table ${tableName.toLowerCase()} {
  key client : abap.clnt not null;
  key id     : abap.char(10) not null;
  text       : abap.char(40);
}
`;
}

describe("A table's technical settings (AdtTableSettings)", () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;
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
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(async () => {
    if (connection) {
      await releaseTestConnection(connection);
    }
  });

  gate(SECTION, CASE)(
    'writes non-default settings under their lock, patches one, activates the table and reads them back — the cloud flag isWritableByAMDP kept',
    async () => {
      const testCase = configuredCase(SECTION, CASE);
      if (!testCase) throw new Error(missingCaseMessage(SECTION, CASE));
      const params = testCase.params ?? {};
      const packageName = resolvePackageName(params.package_name);
      if (!packageName) throw new Error('package_name not configured');
      const transportRequest =
        resolveTransportRequest(params.transport_request) || undefined;
      const tableName = `ZAC_TS${freshSuffix()}`;
      const description = 'Table settings probe';
      const tableConfig = { tableName, transportRequest };
      logTestStart(testsLogger, TITLE, {
        name: CASE,
        params: { tableName, packageName },
      });

      const table = client.getTable();
      // The library's reading: every setting, the description and the ETag;
      // a setting the read lacks throws, naming it.
      const settings = client.getTableSettings({
        ...tableSettingsDocuments,
        metadata: tableSettings,
      });
      let written: ITableSettingsRead | undefined;
      let tableCreated = false;
      let failed: { error: unknown } | undefined;
      try {
        logTestStep('create the table and write its DDL', testsLogger);
        expectResult(
          await table.create(
            { tableName, packageName, transportRequest, description },
            {
              analyse: analyseException,
              headers: integrationHeadersOf(table, 'create'),
            },
          ),
          `create table ${tableName}`,
        );
        tableCreated = true;
        const tableLock = expectResult(
          await table.lock(tableConfig, { analyse: analyseException }),
          `lock table ${tableName}`,
        );
        await releasing(
          async () =>
            expectResult(
              await table.update(tableConfig, {
                analyse: analyseException,
                headers: integrationHeadersOf(table, 'update'),
                source: tableDdl(tableName, description),
                lockHandle: tableLock,
              }),
              `write the DDL of ${tableName}`,
            ),
          () =>
            table.unlock(tableConfig, tableLock, {
              analyse: analyseException,
            }),
          `unlock table ${tableName}`,
        );
        expectResult(
          await table.activate(tableConfig, {
            analyse: judged(analyseActivation),
            headers: integrationHeadersOf(table, 'activate'),
          }),
          `activate table ${tableName}`,
        );

        logTestStep('lock, read, change and write the settings', testsLogger);
        const settingsLock = expectResult(
          await settings.lock({ tableName }, { analyse: analyseException }),
          `lock the settings of ${tableName}`,
        );
        // Read under the lock, so no edit made before it is lost; the
        // whole set is written back with the read's ETag.
        await releasing(
          async () => {
            const read = expectResult(
              await settings.readMetadata(
                { tableName },
                { analyse: analyseException, version: 'inactive' },
              ),
              `read the settings of ${tableName}`,
            );
            if (!read.etag) {
              throw new Error(
                `the settings read of ${tableName} answered no ETag: the write cannot be guarded with If-Match`,
              );
            }
            // Every setting read is written back, the cloud's
            // isWritableByAMDP included: a cloud PUT without it reset it to
            // false (measured 2026-11-19).
            if (isCloudSystem && read.settings.isWritableByAMDP === undefined) {
              throw new Error(
                `the cloud settings read of ${tableName} answered no ts:isWritableByAMDP`,
              );
            }
            written = {
              ...read.settings,
              dataClassCategory: 'APPL1',
              sizeCategory: '1',
              buffering: {
                ...read.settings.buffering,
                allowed: 'X',
                type: 'P',
              },
              loggingEnabled: true,
            };
            return expectResult(
              await settings.updateMetadata(
                {
                  tableName,
                  transportRequest,
                  description: read.description,
                  settings: written,
                },
                {
                  analyse: analyseException,
                  headers: integrationHeadersOf(settings, 'updateMetadata'),
                  lockHandle: settingsLock,
                  ifMatch: read.etag,
                },
              ),
              `write the settings of ${tableName}`,
            );
          },
          () =>
            settings.unlock({ tableName }, settingsLock, {
              analyse: analyseException,
            }),
          `unlock the settings of ${tableName}`,
        );

        logTestStep(
          'patch one setting (and, on the cloud, isWritableByAMDP) under the lock',
          testsLogger,
        );
        const patchLock = expectResult(
          await settings.lock({ tableName }, { analyse: analyseException }),
          `lock the settings of ${tableName} for the patch`,
        );
        const before = written;
        if (!before) throw new Error('nothing was written before the patch');
        // The write carried every setting back: the working area reads what
        // was written, the cloud's isWritableByAMDP as it was read.
        const afterWrite = expectResult(
          await settings.readMetadata(
            { tableName },
            { analyse: analyseException, version: 'inactive' },
          ),
          `read the written settings of ${tableName}`,
        );
        expect(afterWrite.settings).toEqual(before);
        const flag =
          before.isWritableByAMDP === undefined
            ? undefined
            : !before.isWritableByAMDP;
        // The cloud refuses to activate a table writable by AMDP with
        // logging on ("AMDP writes to table … not possible (Logging
        // activated)", answered 200 with an E message, measured 2026-11-19):
        // a patch that turns the flag on turns logging off in the same write.
        const changes =
          flag === undefined
            ? { sizeCategory: '2' }
            : flag
              ? {
                  sizeCategory: '2',
                  isWritableByAMDP: true,
                  loggingEnabled: false,
                }
              : { sizeCategory: '2', isWritableByAMDP: false };
        await releasing(
          async () =>
            expectResult(
              await settings.patchMetadata(
                {
                  tableName,
                  transportRequest,
                  changes,
                },
                {
                  analyse: analyseException,
                  headers: { accept: TABLE_SETTINGS_MEDIA_TYPE },
                  lockHandle: patchLock,
                },
              ),
              `patch the settings of ${tableName}`,
            ),
          () =>
            settings.unlock({ tableName }, patchLock, {
              analyse: analyseException,
            }),
          `unlock the settings of ${tableName} after the patch`,
        );
        written = { ...before, ...changes };

        logTestStep(
          'activate the table, which activates its settings',
          testsLogger,
        );
        expectResult(
          await table.activate(tableConfig, {
            analyse: judged(analyseActivation),
            headers: integrationHeadersOf(table, 'activate'),
          }),
          `activate table ${tableName} with its settings`,
        );

        logTestStep('read the active settings back', testsLogger);
        const active = expectResult(
          await settings.readMetadata(
            { tableName },
            { analyse: analyseException, version: 'active' },
          ),
          `read the active settings of ${tableName}`,
        );
        // Every setting is what was written and patched, the unchanged ones
        // and the cloud's isWritableByAMDP included.
        expect(active.settings).toEqual(written);
        logTestSuccess(testsLogger, TITLE);
      } catch (error) {
        failed = { error };
        logTestError(testsLogger, TITLE, error);
      }

      // Cleanup deletes only what this run created and reads the absence back.
      logTestStep('delete the table and read back (cleanup)', testsLogger);
      const refusals: string[] = [];
      // A lock whose UNLOCK failed stays in the client's registry: release it
      // before the delete, which a held lock would refuse.
      for (const failure of await client.unlockAll()) {
        refusals.push(
          `lock ${failure.key} still held after unlockAll: ${failure.error instanceof Error ? failure.error.message : String(failure.error)}`,
        );
      }
      if (tableCreated) {
        refusals.push(
          await removeAndReadBack(
            () =>
              table.delete(tableConfig, {
                analyse: judged(analyseDeletion),
                headers: integrationHeadersOf(table, 'delete'),
              }),
            () =>
              table.readMetadata({ tableName }, { analyse: analyseException }),
            `table ${tableName}`,
          ),
        );
      }
      logTestEnd(testsLogger, TITLE);
      raiseAfterCleanup(failed, refusals);
    },
    getTimeout('test'),
  );
});

/**
 * Live: a table's technical settings written to non-default values
 * (`getTableSettings()`, adt-clients 45.6.0). On premise and on the cloud.
 *
 * Creates a table under a fresh name in the test package, writes its DDL and
 * activates it. Then, under the settings' own lock: reads the settings,
 * changes them to non-default values (data class APPL1, size category 1,
 * buffering allowed X with single-record buffering, logging on) keeping every
 * other setting as read, writes the whole set with the read's ETag, and
 * unlocks — also when a step failed. Activates the table, which activates
 * its settings, reads the active settings back and checks the written values.
 * Deletes the table and reads its absence back — also when a step failed.
 *
 * Run: npm test -- --testPathPatterns 'integration/core/tableSettings/TableSettings\.test\.ts$'
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  analyseActivation,
  analyseDeletion,
  analyseException,
} from '@mcp-abap-adt/adt-strategies';
import type { ITableSettings } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import { XMLParser } from 'fast-xml-parser';
import type { AdtClient } from '../../../../clients/AdtClient';
import { tableSettingsDocuments } from '../../../../core/tableSettings/types';
import { wireItself } from '../../../../utils/resultStrategy';
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

/** The text of a `ts:` element of the settings document; `''` when empty. */
function text(node: unknown): string {
  if (node === undefined || node === null) return '';
  if (typeof node === 'object') {
    const inner = (node as Record<string, unknown>)['#text'];
    return inner === undefined ? '' : String(inner);
  }
  return String(node);
}

/**
 * The settings a read answered, as the write states them: every setting,
 * so the write keeps what it does not change.
 */
function settingsOf(document: string): ITableSettings {
  const tree = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    parseTagValue: false,
  }).parse(document);
  const root = tree?.tableSettings;
  if (!root) throw new Error('the settings read answered no ts:tableSettings');
  const buffering = root.buffering ?? {};
  return {
    dataClassCategory: text(root.dataClassCategory),
    sizeCategory: text(root.sizeCategory),
    buffering: {
      allowed: text(buffering.allowed),
      type: text(buffering.type),
      areaKeyFields: Number(text(buffering.areaKeyFields) || '0'),
    },
    storageType: text(root.storageType),
    sharingType: text(root.sharingType),
    loadUnit: text(root.loadUnit),
    translation: String(root.translation?.['@_value'] ?? ''),
    loggingEnabled: text(root.loggingEnabled) === 'true',
  };
}

describe("A table's technical settings (AdtTableSettings)", () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
      const isCloudSystem = await isCloudEnvironment(connection);
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
    'writes non-default settings under their lock, activates the table and reads them back',
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
      // The read answers the whole exchange, so the ETag is read beside the
      // document.
      const settings = client.getTableSettings({
        ...tableSettingsDocuments,
        metadata: wireItself,
      });
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
            const current = settingsOf(String(read.data));
            const etag = read.headers?.etag;
            return expectResult(
              await settings.updateMetadata(
                {
                  tableName,
                  transportRequest,
                  description,
                  settings: {
                    ...current,
                    dataClassCategory: 'APPL1',
                    sizeCategory: '1',
                    buffering: { allowed: 'X', type: 'P', areaKeyFields: 0 },
                    loggingEnabled: true,
                  },
                },
                {
                  analyse: analyseException,
                  headers: integrationHeadersOf(settings, 'updateMetadata'),
                  lockHandle: settingsLock,
                  ...(typeof etag === 'string' ? { ifMatch: etag } : {}),
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
        const written = settingsOf(String(active.data));
        expect(written.dataClassCategory).toBe('APPL1');
        expect(written.sizeCategory).toBe('1');
        expect(written.buffering.allowed).toBe('X');
        expect(written.buffering.type).toBe('P');
        expect(written.loggingEnabled).toBe(true);
        logTestSuccess(testsLogger, TITLE);
      } catch (error) {
        failed = { error };
        logTestError(testsLogger, TITLE, error);
      }

      // Cleanup deletes only what this run created and reads the absence back.
      logTestStep('delete the table and read back (cleanup)', testsLogger);
      const refusals: string[] = [];
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

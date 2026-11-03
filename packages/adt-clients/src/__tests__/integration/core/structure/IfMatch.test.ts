/**
 * Live: a structure's DDIC source written only if unchanged — `update` with
 * `ifMatch`, sent as `If-Match` (adt-clients 42.2.0). On premise and on the
 * cloud.
 *
 * Creates a structure under a fresh name in the package of its case (`$TMP`
 * on premise; on the cloud the test package that takes no transport), reads
 * its source and takes the ETag, writes with it (accepted), writes again
 * with that first ETag (refused `412` `ExceptionPreconditionFailed`), writes
 * with the new one (accepted) — that write's label is non-ASCII text
 * (`'Größe Ü ж'`), and the source read back must hold it intact: the guarded
 * write goes without `charset`, so this measures that no charset is safe —
 * and deletes the structure and reads its
 * absence back — also when a step failed. Nothing is activated. The
 * sequence is `helpers/ifMatchProbes.ts`.
 *
 * Off by default: `if_match.test_cases[if_match_structure].enabled` and
 * `.params.package_name` in the overlay turn it on.
 *
 * Run: npm test -- --testPathPatterns 'integration/core/structure/IfMatch\.test\.ts$'
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  analyseDeletion,
  analyseException,
} from '@mcp-abap-adt/adt-strategies';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import { structureDocuments } from '../../../../core/structure/types';
import { wireItself } from '../../../../utils/resultStrategy';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { freshSuffix, probePlace } from '../../../helpers/abapUnitProbes';
import { integrationHeadersOf } from '../../../helpers/adtHeaders';
import {
  configuredCase,
  gate,
  missingCaseMessage,
} from '../../../helpers/caseGate';
import { expectResult, raiseAfterCleanup } from '../../../helpers/contract';
import {
  proveIfMatch,
  removeAndReadBack,
} from '../../../helpers/ifMatchProbes';
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
  getOperationDelay,
} = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger: ILogger = createConnectionLogger();
const libraryLogger: ILogger = createLibraryLogger();
const testsLogger: ILogger = createTestsLogger();

const SECTION = 'if_match';
const CASE = 'if_match_structure';
const TITLE = 'IfMatch - a structure source written only if unchanged';

/** The structure's source of write `n`: each differs from the others. */
/**
 * The label the third, guarded write carries: non-ASCII text. A guarded write
 * of a DDIC source goes without `charset` (SAP builds its ETag with the media
 * type), so reading it back intact is the measurement that this is safe.
 */
const NON_ASCII_LABEL = 'Größe Ü ж';

function structureSource(structureName: string, n: number): string {
  const label = n === 3 ? NON_ASCII_LABEL : `If-Match probe, write ${n}`;
  return `@EndUserText.label : '${label}'
@AbapCatalog.enhancement.category : #NOT_EXTENSIBLE
define structure ${structureName.toLowerCase()} {
  field1 : abap.int1;
}
`;
}

describe("If-Match: a structure's DDIC source (AdtStructure.update)", () => {
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
    'writes with the ETag read, is refused with a stale one, writes with the new one',
    async () => {
      const testCase = configuredCase(SECTION, CASE);
      if (!testCase) throw new Error(missingCaseMessage(SECTION, CASE));
      const place = probePlace(testCase.params ?? {});
      const structureName = `ZIFM_S${freshSuffix()}`;
      const config = {
        structureName,
        transportRequest: place.transportRequest,
      };
      logTestStart(testsLogger, TITLE, {
        name: CASE,
        params: { structureName, packageName: place.packageName },
      });

      // What this run created, and so may delete: nothing yet.
      let created = false;
      let failed: { error: unknown } | undefined;
      try {
        logTestStep('create the structure', testsLogger);
        const structure = client.getStructure();
        expectResult(
          await structure.create(
            {
              structureName,
              packageName: place.packageName,
              transportRequest: place.transportRequest,
              description: 'If-Match probe',
            },
            {
              analyse: analyseException,
              headers: integrationHeadersOf(structure, 'create'),
            },
          ),
          `create structure ${structureName}`,
        );
        created = true;

        const wired = client.getStructure({
          ...structureDocuments,
          source: wireItself,
        });
        await proveIfMatch(
          {
            what: `source of structure ${structureName}`,
            readDocument: () =>
              wired.read(config, 'inactive', { analyse: analyseException }),
            takeLock: () => wired.lock(config, { analyse: analyseException }),
            writeDocument: (source, lockHandle, ifMatch) =>
              wired.update(config, {
                analyse: analyseException,
                headers: integrationHeadersOf(wired, 'update'),
                source,
                lockHandle,
                ifMatch,
              }),
            releaseLock: (lockHandle) =>
              wired.unlock(config, lockHandle, { analyse: analyseException }),
            documentFor: (_current, n) => structureSource(structureName, n),
          },
          getOperationDelay('update', testCase),
          testsLogger,
        );

        logTestStep('read back the non-ASCII label', testsLogger);
        const readBack = expectResult(
          await wired.read(config, 'inactive', { analyse: analyseException }),
          `read structure ${structureName} back`,
        );
        expect(String(readBack.data)).toContain(`'${NON_ASCII_LABEL}'`);
        logTestSuccess(testsLogger, TITLE);
      } catch (error) {
        failed = { error };
        logTestError(testsLogger, TITLE, error);
      }
      // Cleanup deletes only what this run created and reads the absence back.
      logTestStep('delete and read back (cleanup)', testsLogger);
      const refusals = created
        ? [
            await removeAndReadBack(
              () =>
                client.getStructure().delete(config, {
                  analyse: judged(analyseDeletion),
                  headers: integrationHeadersOf(
                    client.getStructure(),
                    'delete',
                  ),
                }),
              () =>
                client.getStructure().read({ structureName }, undefined, {
                  analyse: analyseException,
                }),
              `structure ${structureName}`,
            ),
          ]
        : [];
      logTestEnd(testsLogger, TITLE);
      raiseAfterCleanup(failed, refusals);
    },
    getTimeout('test'),
  );
});

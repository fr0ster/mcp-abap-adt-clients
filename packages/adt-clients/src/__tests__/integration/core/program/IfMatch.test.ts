/**
 * Live: a program's source written only if unchanged — `update` with
 * `ifMatch`, sent as `If-Match` (adt-clients 42.2.0). On premise only: a
 * cloud system has no programs.
 *
 * Creates a program under a fresh name in the local package of its case
 * (`$TMP`), reads its source and takes the ETag, writes with it (accepted),
 * writes again with that first ETag (refused `412`
 * `ExceptionPreconditionFailed`), writes with the new one (accepted), and
 * deletes the program and reads its absence back — also when a step failed.
 * The sequence is `helpers/ifMatchProbes.ts`.
 *
 * Off by default: `if_match.test_cases[if_match_program].enabled` and
 * `.params.package_name` in the overlay turn it on.
 *
 * Run: npm test -- --testPathPatterns 'integration/core/program/IfMatch\.test\.ts$'
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
import { programDocuments } from '../../../../core/program/types';
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
const CASE = 'if_match_program';
const TITLE = 'IfMatch - a program source written only if unchanged';

/** The program's source of write `n`: each differs from the others. */
function programSource(programName: string, n: number): string {
  return `REPORT ${programName.toLowerCase()}.\n\n" If-Match probe, write ${n}\nWRITE 'ok'.\n`;
}

describe('If-Match: a program source (AdtProgram.update)', () => {
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
      const programName = `ZIFM_P${freshSuffix()}`;
      const config = {
        programName,
        transportRequest: place.transportRequest,
      };
      logTestStart(testsLogger, TITLE, {
        name: CASE,
        params: { programName, packageName: place.packageName },
      });

      // What this run created, and so may delete: nothing yet.
      let created = false;
      let failed: { error: unknown } | undefined;
      try {
        logTestStep('create the program', testsLogger);
        const program = client.getProgram();
        expectResult(
          await program.create(
            {
              programName,
              packageName: place.packageName,
              transportRequest: place.transportRequest,
              description: 'If-Match probe',
            },
            {
              analyse: analyseException,
              headers: integrationHeadersOf(program, 'create'),
            },
          ),
          `create program ${programName}`,
        );
        created = true;

        const wired = client.getProgram({
          ...programDocuments,
          source: wireItself,
        });
        await proveIfMatch(
          {
            what: `source of program ${programName}`,
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
            documentFor: (_current, n) => programSource(programName, n),
          },
          getOperationDelay('update', testCase),
          testsLogger,
        );
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
                client.getProgram().delete(config, {
                  analyse: judged(analyseDeletion),
                  headers: integrationHeadersOf(client.getProgram(), 'delete'),
                }),
              () =>
                client.getProgram().read({ programName }, undefined, {
                  analyse: analyseException,
                }),
              `program ${programName}`,
            ),
          ]
        : [];
      logTestEnd(testsLogger, TITLE);
      raiseAfterCleanup(failed, refusals);
    },
    getTimeout('test'),
  );
});

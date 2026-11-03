/**
 * Live: a DDL source written only if unchanged — `update` with `ifMatch`,
 * sent as `If-Match` (adt-clients 42.2.0). On premise and on the cloud.
 *
 * Creates a DDL source under a fresh name in the package of its case (`$TMP`
 * on premise; on the cloud the test package that takes no transport), reads
 * its source and takes the ETag, writes with it (accepted), writes again
 * with that first ETag (refused `412` `ExceptionPreconditionFailed`), writes
 * with the new one (accepted), and deletes the DDL source and reads its
 * absence back — also when a step failed. Nothing is activated. The
 * sequence is `helpers/ifMatchProbes.ts`.
 *
 * Off by default: `if_match.test_cases[if_match_ddl].enabled` and
 * `.params.package_name` in the overlay turn it on.
 *
 * Run: npm test -- --testPathPatterns 'integration/core/ddl/IfMatch\.test\.ts$'
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
import { ddlDocuments } from '../../../../core/ddl/types';
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
const CASE = 'if_match_ddl';
const TITLE = 'IfMatch - a DDL source written only if unchanged';

/** The view entity's source of write `n`: each differs from the others. */
function ddlSource(ddlName: string, n: number): string {
  return `@AccessControl.authorizationCheck: #NOT_REQUIRED
@EndUserText.label: 'If-Match probe, write ${n}'
define view entity ${ddlName}
  as select from I_Language
{
  key Language
}
`;
}

describe('If-Match: a DDL source (AdtDdl.update)', () => {
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
      const ddlName = `ZIFM_D${freshSuffix()}`;
      const config = { ddlName, transportRequest: place.transportRequest };
      logTestStart(testsLogger, TITLE, {
        name: CASE,
        params: { ddlName, packageName: place.packageName },
      });

      // What this run created, and so may delete: nothing yet.
      let created = false;
      let failed: { error: unknown } | undefined;
      try {
        logTestStep('create the DDL source', testsLogger);
        const ddl = client.getDdl();
        expectResult(
          await ddl.create(
            {
              ddlName,
              packageName: place.packageName,
              transportRequest: place.transportRequest,
              description: 'If-Match probe',
            },
            {
              analyse: analyseException,
              headers: integrationHeadersOf(ddl, 'create'),
            },
          ),
          `create DDL source ${ddlName}`,
        );
        created = true;

        const wired = client.getDdl({ ...ddlDocuments, source: wireItself });
        await proveIfMatch(
          {
            what: `DDL source ${ddlName}`,
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
            documentFor: (_current, n) => ddlSource(ddlName, n),
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
                client.getDdl().delete(config, {
                  analyse: judged(analyseDeletion),
                  headers: integrationHeadersOf(client.getDdl(), 'delete'),
                }),
              () =>
                client.getDdl().read({ ddlName }, undefined, {
                  analyse: analyseException,
                }),
              `DDL source ${ddlName}`,
            ),
          ]
        : [];
      logTestEnd(testsLogger, TITLE);
      raiseAfterCleanup(failed, refusals);
    },
    getTimeout('test'),
  );
});

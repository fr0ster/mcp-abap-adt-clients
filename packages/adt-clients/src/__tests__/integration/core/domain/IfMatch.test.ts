/**
 * Live: a domain's metadata document written only if unchanged —
 * `updateMetadata` with `ifMatch`, sent as `If-Match` (adt-clients 42.2.0).
 * The XML write path; on premise and on the cloud.
 *
 * Creates a domain under a fresh name in the package of its case (`$TMP` on
 * premise; on the cloud the test package that takes no transport), reads its
 * document and takes the ETag, writes the document read with its
 * description and type changed (accepted), writes again with that first ETag
 * (refused `412` `ExceptionPreconditionFailed`), writes with the new one
 * (accepted), and deletes the domain and reads its absence back — also when
 * a step failed. Nothing is activated. The sequence is
 * `helpers/ifMatchProbes.ts`.
 *
 * Off by default: `if_match.test_cases[if_match_domain].enabled` and
 * `.params.package_name` in the overlay turn it on.
 *
 * Run: npm test -- --testPathPatterns 'integration/core/domain/IfMatch\.test\.ts$'
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
import { domainDocuments } from '../../../../core/domain/types';
import { wireItself } from '../../../../utils/resultStrategy';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { patchXmlAttribute, patchXmlElement } from '../../../../utils/xmlPatch';
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
const CASE = 'if_match_domain';
const TITLE = 'IfMatch - a domain document written only if unchanged';

/**
 * The document of write `n`: the one read, with its description naming the
 * write and the type a domain needs (as the domain workflow writes it).
 */
function domainDocument(current: string, n: number): string {
  const described = patchXmlAttribute(
    current,
    'adtcore:description',
    `If-Match probe, write ${n}`,
  );
  return patchXmlElement(
    patchXmlElement(described, 'doma:datatype', 'CHAR'),
    'doma:length',
    '000005',
  );
}

describe("If-Match: a domain's metadata document (AdtDomain.updateMetadata)", () => {
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
      const domainName = `ZIFM_O${freshSuffix()}`;
      const config = { domainName, transportRequest: place.transportRequest };
      logTestStart(testsLogger, TITLE, {
        name: CASE,
        params: { domainName, packageName: place.packageName },
      });

      // What this run created, and so may delete: nothing yet.
      let created = false;
      let failed: { error: unknown } | undefined;
      try {
        logTestStep('create the domain', testsLogger);
        const domain = client.getDomain();
        expectResult(
          await domain.create(
            {
              domainName,
              packageName: place.packageName,
              transportRequest: place.transportRequest,
              description: 'If-Match probe',
            },
            {
              analyse: analyseException,
              headers: integrationHeadersOf(domain, 'create'),
            },
          ),
          `create domain ${domainName}`,
        );
        created = true;

        const wired = client.getDomain({
          ...domainDocuments,
          metadata: wireItself,
        });
        await proveIfMatch(
          {
            what: `document of domain ${domainName}`,
            readDocument: () =>
              wired.readMetadata(config, {
                analyse: analyseException,
                version: 'inactive',
              }),
            takeLock: () => wired.lock(config, { analyse: analyseException }),
            writeDocument: (source, lockHandle, ifMatch) =>
              wired.updateMetadata(config, {
                analyse: analyseException,
                headers: integrationHeadersOf(wired, 'updateMetadata'),
                source,
                lockHandle,
                ifMatch,
              }),
            releaseLock: (lockHandle) =>
              wired.unlock(config, lockHandle, { analyse: analyseException }),
            documentFor: (current, n) => domainDocument(current, n),
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
                client.getDomain().delete(config, {
                  analyse: judged(analyseDeletion),
                  headers: integrationHeadersOf(client.getDomain(), 'delete'),
                }),
              () =>
                client.getDomain().readMetadata(
                  { domainName },
                  {
                    analyse: analyseException,
                  },
                ),
              `domain ${domainName}`,
            ),
          ]
        : [];
      logTestEnd(testsLogger, TITLE);
      raiseAfterCleanup(failed, refusals);
    },
    getTimeout('test'),
  );
});

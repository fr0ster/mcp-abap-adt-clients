/**
 * Live: a function module's source written only if unchanged — `update`
 * with `ifMatch`, sent as `If-Match` (adt-clients 42.2.0). On premise and on
 * the cloud.
 *
 * Creates a function group and a function module in it under fresh names in
 * the package of its case (`$TMP` on premise; on the cloud the test package
 * that takes no transport), reads the module's source and takes the ETag,
 * writes with it (accepted), writes again with that first ETag (refused `412`
 * `ExceptionPreconditionFailed`), writes with the new one (accepted), and
 * deletes the module and the group and reads their absence back — also when
 * a step failed. The sequence is `helpers/ifMatchProbes.ts`.
 *
 * Off by default: `if_match.test_cases[if_match_function_module].enabled`
 * and `.params.package_name` in the overlay turn it on.
 *
 * Run: npm test -- --testPathPatterns 'integration/core/functionModule/IfMatch\.test\.ts$'
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
import { functionModuleDocuments } from '../../../../core/functionModule/types';
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
const CASE = 'if_match_function_module';
const TITLE = 'IfMatch - a function module source written only if unchanged';

/** The module's source of write `n`: each differs from the others. */
function moduleSource(moduleName: string, n: number): string {
  return `FUNCTION ${moduleName.toLowerCase()}.
  " If-Match probe, write ${n}
ENDFUNCTION.
`;
}

describe("If-Match: a function module's source (AdtFunctionModule.update)", () => {
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
      const suffix = freshSuffix();
      const functionGroupName = `ZIFMG${suffix}`;
      const functionModuleName = `Z_IFM_${suffix}`;
      const groupConfig = {
        functionGroupName,
        transportRequest: place.transportRequest,
      };
      const config = {
        functionGroupName,
        functionModuleName,
        transportRequest: place.transportRequest,
      };
      logTestStart(testsLogger, TITLE, {
        name: CASE,
        params: {
          functionGroupName,
          functionModuleName,
          packageName: place.packageName,
        },
      });

      // What this run created, and so may delete: nothing yet.
      let groupCreated = false;
      let moduleCreated = false;
      let failed: { error: unknown } | undefined;
      try {
        logTestStep('create the function group', testsLogger);
        const group = client.getFunctionGroup();
        expectResult(
          await group.create(
            {
              functionGroupName,
              packageName: place.packageName,
              transportRequest: place.transportRequest,
              description: 'If-Match probe',
            },
            {
              analyse: analyseException,
              headers: integrationHeadersOf(group, 'create'),
            },
          ),
          `create function group ${functionGroupName}`,
        );
        groupCreated = true;

        logTestStep('create the function module', testsLogger);
        const module = client.getFunctionModule();
        expectResult(
          await module.create(
            {
              functionGroupName,
              functionModuleName,
              transportRequest: place.transportRequest,
              description: 'If-Match probe',
            },
            {
              analyse: analyseException,
              headers: integrationHeadersOf(module, 'create'),
            },
          ),
          `create function module ${functionModuleName}`,
        );
        moduleCreated = true;

        const wired = client.getFunctionModule({
          ...functionModuleDocuments,
          source: wireItself,
        });
        await proveIfMatch(
          {
            what: `source of function module ${functionModuleName}`,
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
            documentFor: (_current, n) => moduleSource(functionModuleName, n),
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
      // The module first, and its absence read back while its group still
      // stands: a read of the module whose group is gone answered 500 (on premise,
      // 2026-11-03), which says nothing about the module. The group is
      // deleted only once the module is read back absent, else it is left in
      // place and named; then the group's absence is read back.
      const refusals: string[] = [];
      let moduleGone = !moduleCreated;
      if (moduleCreated) {
        const moduleRefusal = await removeAndReadBack(
          () =>
            client.getFunctionModule().delete(config, {
              analyse: judged(analyseDeletion),
              headers: integrationHeadersOf(
                client.getFunctionModule(),
                'delete',
              ),
            }),
          // Its metadata, not its source: for a deleted module whose group
          // stands, the metadata read answers 404 ExceptionResourceNotFound
          // and the source read 500 (measured on premise, 2026-11-03).
          () =>
            client
              .getFunctionModule()
              .readMetadata(
                { functionGroupName, functionModuleName },
                { analyse: analyseException },
              ),
          `function module ${functionModuleName}`,
        );
        refusals.push(moduleRefusal);
        moduleGone = moduleRefusal === '';
      }
      if (groupCreated && !moduleGone) {
        refusals.push(
          `function group ${functionGroupName} left in place: the absence of function module ${functionModuleName} was not read back`,
        );
      }
      if (groupCreated && moduleGone) {
        refusals.push(
          await removeAndReadBack(
            () =>
              client.getFunctionGroup().delete(groupConfig, {
                analyse: judged(analyseDeletion),
                headers: integrationHeadersOf(
                  client.getFunctionGroup(),
                  'delete',
                ),
              }),
            () =>
              client.getFunctionGroup().readMetadata(
                { functionGroupName },
                {
                  analyse: analyseException,
                },
              ),
            `function group ${functionGroupName}`,
          ),
        );
      }
      logTestEnd(testsLogger, TITLE);
      raiseAfterCleanup(failed, refusals);
    },
    getTimeout('test'),
  );
});

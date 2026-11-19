/**
 * Live: a program's (on premise) or a class's (on the cloud) text elements
 * created, changed and deleted (`getTextElements()`).
 *
 * Creates the object under a fresh name in the test package, writes its
 * source and activates it. Then, under the text elements' own lock (TEXT):
 * reads the symbols, writes symbols 001 and 002 (and, for a program, the
 * selection text of P_TEST), unlocks on every path, and activates the object
 * together with its text elements in one request
 * (`textElementsActivationReferences`). Reads the active texts back and
 * asserts every entry. Writes the symbols again without 002, activates, and
 * asserts 002 is gone — SAP deletes what a write leaves out. Cleanup releases
 * any lock still held, deletes the object and reads its absence back — also
 * when a step failed.
 *
 * A second case, on premise only (ABAP cloud creates no function group):
 * a function group's text elements — written through `getTextElements()`
 * with kind `functionGroup`, activated with the group through the typed
 * `activateObjects` (`FUGR/F` and `PROG/PX` at
 * `/textelements/functiongroups/{group}`), read back active, and found by
 * where-used with `container: 'functionGroup'`; the group deleted after.
 *
 * Run: npm test -- --testPathPatterns 'integration/core/textElements/TextElements\.test\.ts$'
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  analyseActivation,
  analyseDeletion,
  analyseException,
  selectionTexts,
  textSymbols,
} from '@mcp-abap-adt/adt-strategies';
import type { ITextSymbol } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import { createAdtClient } from '../../../../clients/createAdtClient';
import { textElementsActivationReferences } from '../../../../core/textElements/activation';
import { textElementsDocuments } from '../../../../core/textElements/types';
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

const SECTION = 'text_elements';
const CASE = 'adt_text_elements';
const TITLE =
  'TextElements - symbols and a selection text written, changed and deleted';
const GROUP_CASE = 'adt_text_elements_function_group';
const GROUP_TITLE =
  "TextElements - a function group's symbols written, activated with the group, found by where-used";

/** A program with one parameter, so it has a selection text to write. */
function programSource(name: string): string {
  return `REPORT ${name.toLowerCase()}.
PARAMETERS p_test TYPE c LENGTH 10.
WRITE: / TEXT-001, / TEXT-002.
`;
}

/** A class whose method uses the two text symbols. */
function classSource(name: string): string {
  return `CLASS ${name.toLowerCase()} DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    METHODS texts RETURNING VALUE(result) TYPE string.
ENDCLASS.

CLASS ${name.toLowerCase()} IMPLEMENTATION.
  METHOD texts.
    result = TEXT-001 && TEXT-002.
  ENDMETHOD.
ENDCLASS.
`;
}

const BOTH: ITextSymbol[] = [
  { key: '001', text: 'Symbol one', maxLength: 20 },
  { key: '002', text: 'Symbol two', maxLength: 20 },
];

describe('Text elements (AdtTextElements)', () => {
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
    'writes symbols and a selection text under the TEXT lock, activates them with the object, and deletes one by leaving it out',
    async () => {
      const testCase = configuredCase(SECTION, CASE);
      if (!testCase) throw new Error(missingCaseMessage(SECTION, CASE));
      const params = testCase.params ?? {};
      const packageName = resolvePackageName(params.package_name);
      if (!packageName) throw new Error('package_name not configured');
      const transportRequest =
        resolveTransportRequest(params.transport_request) || undefined;
      // A program on premise; ABAP cloud creates no program, so a class.
      const objectKind = isCloudSystem ? 'class' : 'program';
      const objectName = isCloudSystem
        ? `ZCL_AC_TE${freshSuffix()}`
        : `ZAC_TE${freshSuffix()}`;
      const description = 'Text elements probe';
      logTestStart(testsLogger, TITLE, {
        name: CASE,
        params: { objectKind, objectName, packageName },
      });

      const program = client.getProgram();
      const cls = client.getClass();
      const texts = client.getTextElements({
        ...textElementsDocuments,
        source: textSymbols,
      });
      const selections = client.getTextElements({
        ...textElementsDocuments,
        source: selectionTexts,
      });
      const utils = client.getUtils();
      const object = { objectKind, objectName } as const;
      let created = false;
      let failed: { error: unknown } | undefined;

      /** Lock TEXT, write what `write` writes, unlock on every path. */
      const underLock = async (
        what: string,
        write: (lockHandle: string) => Promise<unknown>,
      ) => {
        const lockHandle = expectResult(
          await texts.lock(object, { analyse: analyseException }),
          `lock the text elements of ${objectName}`,
        );
        await releasing(
          () => write(lockHandle),
          () => texts.unlock(object, lockHandle, { analyse: analyseException }),
          `unlock the text elements of ${objectName} (${what})`,
        );
      };

      /**
       * Activate the object and its text elements in one request. A program
       * activates on premise only, so its references go through the
       * on-premise client's utilities.
       */
      const activateBoth = async (what: string) => {
        const answer =
          objectKind === 'program'
            ? await (
                await createAdtClient(connection, {
                  variant: 'onprem',
                  logger: libraryLogger,
                })
              )
                .getUtils()
                .activateObjects(
                  textElementsActivationReferences({
                    objectKind: 'program',
                    objectName,
                  }),
                  true,
                  {
                    analyse: judged(analyseActivation),
                    headers: integrationHeadersOf(utils, 'activateObjects'),
                  },
                )
            : await utils.activateObjects(
                textElementsActivationReferences({
                  objectKind: 'class',
                  objectName,
                }),
                true,
                {
                  analyse: judged(analyseActivation),
                  headers: integrationHeadersOf(utils, 'activateObjects'),
                },
              );
        expectResult(
          answer,
          `activate ${objectName} with its text elements (${what})`,
        );
      };

      /** The active symbols, read with the library's reading. */
      const activeSymbols = async () =>
        expectResult(
          await texts.read(
            { objectKind, objectName, part: 'symbols' },
            'active',
            {
              analyse: analyseException,
            },
          ),
          `read the active symbols of ${objectName}`,
        ).symbols;

      try {
        logTestStep(
          `create the ${objectKind} and write its source`,
          testsLogger,
        );
        if (objectKind === 'program') {
          const config = { programName: objectName, transportRequest };
          expectResult(
            await program.create(
              {
                programName: objectName,
                packageName,
                transportRequest,
                description,
              },
              {
                analyse: analyseException,
                headers: integrationHeadersOf(program, 'create'),
              },
            ),
            `create program ${objectName}`,
          );
          created = true;
          const lock = expectResult(
            await program.lock(config, { analyse: analyseException }),
            `lock program ${objectName}`,
          );
          await releasing(
            async () =>
              expectResult(
                await program.update(config, {
                  analyse: analyseException,
                  headers: integrationHeadersOf(program, 'update'),
                  source: programSource(objectName),
                  lockHandle: lock,
                }),
                `write the source of ${objectName}`,
              ),
            () => program.unlock(config, lock, { analyse: analyseException }),
            `unlock program ${objectName}`,
          );
        } else {
          const config = { className: objectName, transportRequest };
          expectResult(
            await cls.create(
              {
                className: objectName,
                packageName,
                transportRequest,
                description,
              },
              {
                analyse: analyseException,
                headers: integrationHeadersOf(cls, 'create'),
              },
            ),
            `create class ${objectName}`,
          );
          created = true;
          const lock = expectResult(
            await cls.lock(config, { analyse: analyseException }),
            `lock class ${objectName}`,
          );
          await releasing(
            async () =>
              expectResult(
                await cls.update(config, {
                  analyse: analyseException,
                  headers: integrationHeadersOf(cls, 'update'),
                  source: classSource(objectName),
                  lockHandle: lock,
                }),
                `write the source of ${objectName}`,
              ),
            () => cls.unlock(config, lock, { analyse: analyseException }),
            `unlock class ${objectName}`,
          );
        }

        logTestStep(
          'lock TEXT, read, write 001 and 002 (and P_TEST), unlock',
          testsLogger,
        );
        await underLock('first write', async (lockHandle) => {
          expectResult(
            await texts.read(
              { objectKind, objectName, part: 'symbols' },
              undefined,
              {
                analyse: analyseException,
              },
            ),
            `read the symbols of ${objectName}`,
          );
          expectResult(
            await texts.update(
              {
                objectKind,
                objectName,
                part: 'symbols',
                symbols: BOTH,
                transportRequest,
              },
              {
                analyse: analyseException,
                headers: integrationHeadersOf(texts, 'update'),
                lockHandle,
              },
            ),
            `write symbols 001 and 002 of ${objectName}`,
          );
          if (objectKind === 'program') {
            expectResult(
              await selections.update(
                {
                  objectKind: 'program',
                  objectName,
                  part: 'selections',
                  selections: [
                    {
                      name: 'P_TEST',
                      text: 'Test parameter',
                      ddicReference: false,
                    },
                  ],
                  transportRequest,
                },
                {
                  analyse: analyseException,
                  headers: {
                    accept:
                      'application/vnd.sap.adt.textelements.selections.v1',
                    contentType:
                      'application/vnd.sap.adt.textelements.selections.v1; charset=utf-8',
                  },
                  lockHandle,
                },
              ),
              `write the selection text of ${objectName}`,
            );
          }
        });

        logTestStep('activate the object with its text elements', testsLogger);
        await activateBoth('first write');

        logTestStep('read the active texts back', testsLogger);
        expect(await activeSymbols()).toEqual(BOTH);
        if (objectKind === 'program') {
          const active = expectResult(
            await selections.read(
              { objectKind: 'program', objectName, part: 'selections' },
              'active',
              { analyse: analyseException },
            ),
            `read the active selection texts of ${objectName}`,
          );
          // SAP pads the name to eight characters on a read (measured).
          expect(active.selections).toEqual([
            { name: 'P_TEST  ', text: 'Test parameter', ddicReference: false },
          ]);
        }

        logTestStep('write the symbols without 002, activate', testsLogger);
        const onlyFirst = BOTH.filter((symbol) => symbol.key === '001');
        await underLock('delete 002', async (lockHandle) =>
          expectResult(
            await texts.update(
              {
                objectKind,
                objectName,
                part: 'symbols',
                symbols: onlyFirst,
                transportRequest,
              },
              {
                analyse: analyseException,
                headers: integrationHeadersOf(texts, 'update'),
                lockHandle,
              },
            ),
            `write symbol 001 alone of ${objectName}`,
          ),
        );
        await activateBoth('delete 002');

        logTestStep('read back: 002 is gone', testsLogger);
        expect(await activeSymbols()).toEqual(onlyFirst);
        logTestSuccess(testsLogger, TITLE);
      } catch (error) {
        failed = { error };
        logTestError(testsLogger, TITLE, error);
      }

      // Cleanup deletes only what this run created and reads the absence back.
      logTestStep(
        `delete the ${objectKind} and read back (cleanup)`,
        testsLogger,
      );
      const refusals: string[] = [];
      // A lock whose UNLOCK failed stays in the client's registry: release it
      // before the delete, which a held lock would refuse.
      for (const failure of await client.unlockAll()) {
        refusals.push(
          `lock ${failure.key} still held after unlockAll: ${failure.error instanceof Error ? failure.error.message : String(failure.error)}`,
        );
      }
      if (created) {
        refusals.push(
          objectKind === 'program'
            ? await removeAndReadBack(
                () =>
                  program.delete(
                    { programName: objectName, transportRequest },
                    {
                      analyse: judged(analyseDeletion),
                      headers: integrationHeadersOf(program, 'delete'),
                    },
                  ),
                () =>
                  program.read({ programName: objectName }, undefined, {
                    analyse: analyseException,
                  }),
                `program ${objectName}`,
              )
            : await removeAndReadBack(
                () =>
                  cls.delete(
                    { className: objectName, transportRequest },
                    {
                      analyse: judged(analyseDeletion),
                      headers: integrationHeadersOf(cls, 'delete'),
                    },
                  ),
                () =>
                  cls.read({ className: objectName }, undefined, {
                    analyse: analyseException,
                  }),
                `class ${objectName}`,
              ),
        );
      }
      logTestEnd(testsLogger, TITLE);
      raiseAfterCleanup(failed, refusals);
    },
    getTimeout('test'),
  );
  // On premise only — the case lists `available_in: ["onprem"]`: ABAP cloud
  // creates no function group, so there is none to write text elements to.
  gate(SECTION, GROUP_CASE)(
    "writes a function group's symbols, activates them with the group and finds them by where-used",
    async () => {
      const testCase = configuredCase(SECTION, GROUP_CASE);
      if (!testCase) throw new Error(missingCaseMessage(SECTION, GROUP_CASE));
      const params = testCase.params ?? {};
      const packageName = resolvePackageName(params.package_name);
      if (!packageName) throw new Error('package_name not configured');
      const transportRequest =
        resolveTransportRequest(params.transport_request) || undefined;
      const functionGroupName = `ZAC_TEG${freshSuffix()}`;
      const groupConfig = { functionGroupName, transportRequest };
      logTestStart(testsLogger, GROUP_TITLE, {
        name: GROUP_CASE,
        params: { functionGroupName, packageName },
      });

      const group = client.getFunctionGroup();
      const texts = client.getTextElements({
        ...textElementsDocuments,
        source: textSymbols,
      });
      const object = {
        objectKind: 'functionGroup',
        objectName: functionGroupName,
      } as const;
      let created = false;
      let failed: { error: unknown } | undefined;
      try {
        logTestStep('create the function group', testsLogger);
        expectResult(
          await group.create(
            {
              functionGroupName,
              packageName,
              transportRequest,
              description: 'Text elements probe',
            },
            {
              analyse: analyseException,
              headers: integrationHeadersOf(group, 'create'),
            },
          ),
          `create function group ${functionGroupName}`,
        );
        created = true;

        logTestStep(
          'lock TEXT, write symbols 001 and 002, unlock',
          testsLogger,
        );
        const lockHandle = expectResult(
          await texts.lock(object, { analyse: analyseException }),
          `lock the text elements of ${functionGroupName}`,
        );
        await releasing(
          async () =>
            expectResult(
              await texts.update(
                { ...object, part: 'symbols', symbols: BOTH, transportRequest },
                {
                  analyse: analyseException,
                  headers: integrationHeadersOf(texts, 'update'),
                  lockHandle,
                },
              ),
              `write the symbols of ${functionGroupName}`,
            ),
          () => texts.unlock(object, lockHandle, { analyse: analyseException }),
          `unlock the text elements of ${functionGroupName}`,
        );

        logTestStep(
          'activate the group with its text elements (FUGR/F and PROG/PX under functiongroups)',
          testsLogger,
        );
        const references = textElementsActivationReferences(object);
        expect(references).toEqual([
          {
            name: functionGroupName,
            type: 'FUGR/F',
            uri: `/sap/bc/adt/functions/groups/${functionGroupName.toLowerCase()}`,
          },
          {
            name: functionGroupName,
            type: 'PROG/PX',
            uri: `/sap/bc/adt/textelements/functiongroups/${functionGroupName.toLowerCase()}`,
          },
        ]);
        const onPremise = await createAdtClient(connection, {
          variant: 'onprem',
          logger: libraryLogger,
        });
        const utils = onPremise.getUtils();
        expectResult(
          await utils.activateObjects(references, true, {
            analyse: judged(analyseActivation),
            headers: integrationHeadersOf(utils, 'activateObjects'),
          }),
          `activate ${functionGroupName} with its text elements`,
        );

        logTestStep('read the active symbols back', testsLogger);
        const active = expectResult(
          await texts.read({ ...object, part: 'symbols' }, 'active', {
            analyse: analyseException,
          }),
          `read the active symbols of ${functionGroupName}`,
        );
        expect(active.symbols).toEqual(BOTH);

        logTestStep(
          "where-used of the group's text elements (container functionGroup)",
          testsLogger,
        );
        expectResult(
          await utils.getWhereUsed(
            {
              object_name: functionGroupName,
              object_type: 'PROG/PX',
              container: 'functionGroup',
            },
            {
              analyse: analyseException,
              headers: integrationHeadersOf(utils, 'getWhereUsed'),
            },
          ),
          `where-used of the text elements of ${functionGroupName}`,
        );
        logTestSuccess(testsLogger, GROUP_TITLE);
      } catch (error) {
        failed = { error };
        logTestError(testsLogger, GROUP_TITLE, error);
      }

      // Cleanup deletes only what this run created and reads the absence back.
      logTestStep(
        'delete the function group and read back (cleanup)',
        testsLogger,
      );
      const refusals: string[] = [];
      for (const failure of await client.unlockAll()) {
        refusals.push(
          `lock ${failure.key} still held after unlockAll: ${failure.error instanceof Error ? failure.error.message : String(failure.error)}`,
        );
      }
      if (created) {
        refusals.push(
          await removeAndReadBack(
            () =>
              group.delete(groupConfig, {
                analyse: judged(analyseDeletion),
                headers: integrationHeadersOf(group, 'delete'),
              }),
            () =>
              group.readMetadata(
                { functionGroupName },
                { analyse: analyseException },
              ),
            `function group ${functionGroupName}`,
          ),
        );
      }
      logTestEnd(testsLogger, GROUP_TITLE);
      raiseAfterCleanup(failed, refusals);
    },
    getTimeout('test'),
  );
});

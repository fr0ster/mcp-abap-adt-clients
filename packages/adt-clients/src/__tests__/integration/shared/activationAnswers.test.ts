/**
 * What an activation answers, and what the library and `analyseActivation`
 * make of it, on a live on-premise system (fr0ster/mcp-abap-adt#351; the D8
 * measurements of S/4HANA 2025, recorded in `corpus/adt/answers/` as
 * `activation-*-s4-2025`).
 *
 * - discovery lists `/sap/bc/adt/activation/runs`;
 * - a class written inactive: the default activation (`preauditRequested=true`)
 *   activates it; activating it again with `false` answers the silent
 *   checklist, the member reads the inactive list exactly once, and the
 *   answer is nothing to activate;
 * - a function group whose main program was changed, its reference alone:
 *   `true` answers `ioc:inactiveObjects`, not activated, the group in
 *   `stillInactive`; `false` answers the silent checklist, the list is read
 *   once, still not activated; the second step — `activateObjects` with the
 *   group and its main program, `false` — activates both.
 *
 * Each test creates its own object and deletes it, also when a step failed.
 * Every request is asserted on what the connection recorded.
 *
 * Run: npm test -- integration/shared/activationAnswers
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ACTIVATION_RUNS_COLLECTION,
  analyseActivation,
  analyseDeletion,
  analyseException,
  utilDiscoveryCollections,
} from '@mcp-abap-adt/adt-strategies';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../clients/AdtClient';
import { utilDocuments } from '../../../core/shared/utilResultSet';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import { integrationHeadersOf } from '../../helpers/adtHeaders';
import {
  configuredCase,
  gate,
  missingCaseMessage,
} from '../../helpers/caseGate';
import { CleanupSteps } from '../../helpers/cleanupSteps';
import { expectFailure, expectResult } from '../../helpers/contract';
import { judged } from '../../helpers/judged';
import { removeLeftover } from '../../helpers/objectPresence';
import {
  type RequestRecorder,
  recordRequests,
} from '../../helpers/requestRecorder';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
  resolveSystemContext,
  skipUnlessConfigured,
} from '../../helpers/sessionConfig';
import {
  createConnectionLogger,
  createTestsLogger,
} from '../../helpers/testLogger';

const {
  resolvePackageName,
  resolveTransportRequest,
  getTimeout,
  writeSource,
} = require('../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger: ILogger = createConnectionLogger();
const testsLogger: ILogger = createTestsLogger();

const HANDLER = 'activation_answers';
const CASE = 'adt_activation_answers';
const ACTIVATION = '/sap/bc/adt/activation?method=activate&preauditRequested=';
const INACTIVE = 'GET /sap/bc/adt/activation/inactiveobjects';

describe('Activation answers (fr0ster/mcp-abap-adt#351)', () => {
  let connection: IAbapConnection;
  let recorder: RequestRecorder<IAbapConnection>;
  let client: AdtClient;
  let params: Record<string, string> = {};
  let packageName = '';
  let transportRequest = '';

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
      recorder = recordRequests(connection);
      const isCloud = await isCloudEnvironment(connection);
      const systemContext = await resolveSystemContext(connection, isCloud);
      ({ client } = await createTestAdtClient(
        recorder.connection,
        testsLogger,
        systemContext,
      ));
      const testCase = configuredCase(HANDLER, CASE);
      if (!testCase) throw new Error(missingCaseMessage(HANDLER, CASE));
      params = testCase.params ?? {};
      packageName = resolvePackageName(params.package_name);
      transportRequest = resolveTransportRequest(params.transport_request);
    } catch (error) {
      skipUnlessConfigured(error, testsLogger);
    }
  }, getTimeout('connection') ?? 120000);

  afterAll(async () => {
    if (connection) await releaseTestConnection(connection);
  });

  /** The requests since `mark`, each as `METHOD url`. */
  const sentSince = (mark: number): string[] =>
    recorder.requests.slice(mark).map((r) => `${r.method} ${r.url}`);

  /** Whether the inactive list names `uri`. */
  const listed = async (uri: string): Promise<boolean> => {
    const list = expectResult(
      await client.getUtils().getInactiveObjects({ analyse: analyseException }),
      'getInactiveObjects',
    );
    return String(list).toLowerCase().includes(`"${uri}"`);
  };

  gate(HANDLER, CASE)(
    'discovery lists /sap/bc/adt/activation/runs',
    async () => {
      const collections = expectResult(
        await client
          .getUtils({ ...utilDocuments, discovery: utilDiscoveryCollections })
          .discovery({}, { analyse: analyseException }),
        'discovery',
      );
      expect(collections.has('/sap/bc/adt/activation')).toBe(true);
      expect(collections.has(ACTIVATION_RUNS_COLLECTION)).toBe(true);
    },
    getTimeout('read') ?? 120000,
  );

  gate(HANDLER, CASE)(
    'a class: the default activation activates; again with preauditRequested=false is nothing to activate, read once from the inactive list',
    async () => {
      const className = params.class_name;
      const config = { className, transportRequest };
      const uri = `/sap/bc/adt/oo/classes/${className.toLowerCase()}`;
      const cls = client.getClass();
      const remove = () =>
        cls.delete(config, {
          headers: integrationHeadersOf(cls, 'delete'),
          analyse: judged(analyseDeletion),
        });
      await removeLeftover(
        `leftover class ${className}`,
        () => cls.readMetadata({ className }, { analyse: analyseException }),
        remove,
      );

      const cleanup = new CleanupSteps();
      try {
        expectResult(
          await cls.create(
            {
              className,
              packageName,
              transportRequest,
              description: params.description,
            },
            {
              headers: integrationHeadersOf(cls, 'create'),
              analyse: analyseException,
            },
          ),
          'create class',
        );
        await writeSource(
          cls,
          config,
          {
            source: [
              `CLASS ${className.toLowerCase()} DEFINITION PUBLIC FINAL CREATE PUBLIC.`,
              '  PUBLIC SECTION.',
              '    METHODS probe RETURNING VALUE(result) TYPE i.',
              'ENDCLASS.',
              `CLASS ${className.toLowerCase()} IMPLEMENTATION.`,
              '  METHOD probe.',
              '    result = 751.',
              '  ENDMETHOD.',
              'ENDCLASS.',
            ].join('\n'),
          },
          testsLogger,
        );
        expect(await listed(uri)).toBe(true);

        let mark = recorder.requests.length;
        expectResult(
          await cls.activate(
            { className },
            {
              headers: integrationHeadersOf(cls, 'activate'),
              analyse: judged(analyseActivation),
            },
          ),
          'activate, default',
        );
        expect(sentSince(mark)).toEqual([`POST ${ACTIVATION}true`]);
        expect(await listed(uri)).toBe(false);

        mark = recorder.requests.length;
        expectResult(
          await cls.activate(
            { className },
            {
              headers: integrationHeadersOf(cls, 'activate'),
              preauditRequested: false,
              analyse: judged(analyseActivation),
            },
          ),
          're-activate with preauditRequested=false',
        );
        // The silent checklist, and the one read the member makes after it.
        expect(sentSince(mark)).toEqual([`POST ${ACTIVATION}false`, INACTIVE]);
      } catch (error) {
        cleanup.record('test', error);
      } finally {
        await cleanup.run(`delete class ${className}`, remove, {
          checkAnswer: true,
        });
      }
      cleanup.finish();
    },
    getTimeout('long') ?? 600000,
  );

  gate(HANDLER, CASE)(
    'a function group alone: true is not activated with stillInactive; false is the silent checklist, not activated; the second step through activateObjects activates',
    async () => {
      const group = params.function_group_name;
      const mainProgram = `SAPL${group.toUpperCase()}`;
      const uri = `/sap/bc/adt/functions/groups/${group.toLowerCase()}`;
      const config = { functionGroupName: group, transportRequest };
      const handler = client.getFunctionGroup();
      const utils = client.getUtils();
      const remove = () =>
        handler.delete(config, {
          headers: integrationHeadersOf(handler, 'delete'),
          analyse: judged(analyseDeletion),
        });
      await removeLeftover(
        `leftover function group ${group}`,
        () =>
          handler.readMetadata(
            { functionGroupName: group },
            { analyse: analyseException },
          ),
        remove,
      );

      const cleanup = new CleanupSteps();
      try {
        expectResult(
          await handler.create(
            {
              functionGroupName: group,
              packageName,
              transportRequest,
              description: params.description,
            },
            {
              headers: integrationHeadersOf(handler, 'create'),
              analyse: analyseException,
            },
          ),
          'create function group',
        );
        // A fresh group is created active: its main program is changed, so
        // the group and SAPL<group> are inactive (measured, D8).
        const main = expectResult(
          await handler.read({ functionGroupName: group }, 'active', {
            analyse: analyseException,
          }),
          'read the main program',
        );
        await writeSource(
          handler,
          config,
          {
            source: `${String(main)}\n* changed by the activation answers test`,
          },
          testsLogger,
        );
        expect(await listed(uri)).toBe(true);

        // The group's reference alone, preauditRequested=true.
        let mark = recorder.requests.length;
        const notActivated = expectFailure(
          await utils.activateObjects([{ type: 'FUGR/F', name: group }], true, {
            headers: integrationHeadersOf(utils, 'activateObjects'),
            analyse: judged(analyseActivation),
          }),
          'the group alone, preauditRequested=true',
        );
        expect(sentSince(mark)).toEqual([`POST ${ACTIVATION}true`]);
        expect(notActivated.message).toContain(
          'SAP answered the objects still inactive',
        );
        expect(stillInactiveUris(notActivated)).toContain(uri);
        expect(await listed(uri)).toBe(true);

        // The same reference, preauditRequested=false: the silent checklist.
        mark = recorder.requests.length;
        const silent = expectFailure(
          await utils.activateObjects(
            [{ type: 'FUGR/F', name: group }],
            false,
            {
              headers: integrationHeadersOf(utils, 'activateObjects'),
              analyse: judged(analyseActivation),
            },
          ),
          'the group alone, preauditRequested=false',
        );
        expect(sentSince(mark)).toEqual([`POST ${ACTIVATION}false`, INACTIVE]);
        expect(silent.message).toContain('the inactive list still names');
        expect(stillInactiveUris(silent)).toEqual(
          expect.arrayContaining([uri, `${uri}/source/main`]),
        );

        // The second step: the group and its main program, false.
        mark = recorder.requests.length;
        expectResult(
          await utils.activateObjects(
            [
              { type: 'FUGR/F', name: group },
              { type: 'FUGR/I', name: mainProgram, parentName: group },
            ],
            false,
            {
              headers: integrationHeadersOf(utils, 'activateObjects'),
              analyse: judged(analyseActivation),
            },
          ),
          'the second step',
        );
        expect(sentSince(mark)[0]).toBe(`POST ${ACTIVATION}false`);
        expect(await listed(uri)).toBe(false);
      } catch (error) {
        cleanup.record('test', error);
      } finally {
        await cleanup.run(`delete function group ${group}`, remove, {
          checkAnswer: true,
        });
      }
      cleanup.finish();
    },
    getTimeout('long') ?? 600000,
  );
});

/** The uris of a failure's `stillInactive`, when it carries one. */
function stillInactiveUris(failure: object): string[] {
  if (!('stillInactive' in failure) || !Array.isArray(failure.stillInactive))
    return [];
  return failure.stillInactive.flatMap((entry: unknown) =>
    typeof entry === 'object' &&
    entry !== null &&
    'uri' in entry &&
    typeof entry.uri === 'string'
      ? [entry.uri]
      : [],
  );
}

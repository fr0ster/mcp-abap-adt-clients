/**
 * The utils readers on SAP_BASIS 7.40 SP04 over RFC (spec §4), on a program
 * of the run's own.
 *
 * validate (name free) → create → `search` finds it → `getObjectStructure` of
 * it → `fetchNodeStructure('DEVC/K', '$TMP')` lists it → `discovery` (the
 * collections the cycles use) → lock → write without activating → unlock →
 * `getInactiveObjects` lists it → `activateObjectsGroup` activates it →
 * `getInactiveObjects` no longer lists it → lock → delete → unlock → read
 * `404`. Every step asserts the requests it sent, their statuses and its
 * effect read back.
 *
 * Records behind the answers: the program's own steps,
 * B4-cycles-20261026-2019 (p0–p9, r3-prog-validate). The readers were
 * measured on 7.40 SP04 only on other objects — `search`, `getObjectStructure`,
 * `discovery` and `getInactiveObjects` on B2-reads-20261023-1749 (s10-*),
 * `nodestructure` of `$TMP` as a raw request (B3-unmeasured-20261023-1631
 * b1-3), the collections in the RFC discovery (rfc-discovery.txt), the group
 * activation on a 7.40 system of unrecorded support package (docs/LEGACY.md,
 * "Measured on BASIS 7.40"). What each answers about an object of this run
 * is not measured — Task 6 measures every reader step here.
 *
 * The program is created by this run in `$TMP` (no transport) and deleted by
 * it — by its last steps, or by the cleanup when a step failed; nothing this
 * run did not create is touched.
 *
 * Runs on a legacy configuration over RFC with case
 * `legacy_740/legacy_utils_readers` enabled:
 * npm run test:live -- integration/legacy/cycles/UtilsReaders
 */

import {
  analyseActivation,
  analyseDeletion,
  analyseException,
} from '@mcp-abap-adt/adt-strategies';
import type { IProgramConfig } from '@mcp-abap-adt/interfaces-adt';
import { integrationHeadersOf } from '../../../../../../adt-clients/src/__tests__/helpers/adtHeaders';
import {
  expectFailure,
  expectResult,
} from '../../../../../../adt-clients/src/__tests__/helpers/contract';
import { judged } from '../../../../../../adt-clients/src/__tests__/helpers/judged';
import {
  cycleObject,
  expectSent,
  runCycle,
} from '../../../helpers/legacyCycle';
import { requireOwnNames } from '../../../helpers/legacyEnv';
import {
  closeLegacySession,
  type LegacySession,
  LOCAL_PACKAGE,
  openLegacySession,
  param,
  queryOf,
  withLegacyCase,
} from '../../../helpers/legacyLive';
import { describeLegacyRfc } from '../../../helpers/legacyRfc';

const CASE = 'legacy_utils_readers';
const DESCRIPTION = 'legacy live cycle: utils readers';

/** The collections the cycles use, advertised in the RFC discovery of 7.40 SP04. */
const COLLECTIONS = [
  '/sap/bc/adt/oo/classes',
  '/sap/bc/adt/oo/interfaces',
  '/sap/bc/adt/programs/programs',
  '/sap/bc/adt/programs/includes',
  '/sap/bc/adt/functions/groups',
  '/sap/bc/adt/ddic/ddl/sources',
  '/sap/bc/adt/messageclass',
  '/sap/bc/adt/activation',
  '/sap/bc/adt/activation/inactiveobjects',
  '/sap/bc/adt/checkruns',
  '/sap/bc/adt/repository/informationsystem/search',
  '/sap/bc/adt/repository/nodestructure',
  '/sap/bc/adt/repository/objectstructure',
];

describeLegacyRfc('Legacy 7.40 SP04 over RFC — utils readers', () => {
  withLegacyCase(CASE, (params) => {
    let session: LegacySession | undefined;

    beforeAll(async () => {
      session = await openLegacySession();
    }, 120000);

    afterAll(async () => {
      await closeLegacySession(session);
    });

    it('finds, lists and activates a program of its own through the utils readers', async () => {
      const { client, recorder } = session as LegacySession;
      const name = param(params, 'program_name');
      requireOwnNames(CASE, [['program', name]]);
      const config: IProgramConfig = { programName: name };
      const uri = `/sap/bc/adt/programs/programs/${name.toLowerCase()}`;
      const utils = client.getUtils();
      const prog = cycleObject({
        caseName: CASE,
        label: 'program',
        name,
        config,
        handler: () => client.getProgram(),
        validateConfig: {
          ...config,
          packageName: LOCAL_PACKAGE,
          description: DESCRIPTION,
        },
      });
      const at = () => recorder.requests.length;
      /** The inactive-objects list, and whether it names the program. */
      const inactive = async (): Promise<boolean> => {
        const before = at();
        const list = expectResult(
          await utils.getInactiveObjects({ analyse: analyseException }),
          'getInactiveObjects',
        );
        // B2 s10-inactive: 200, adtcore:objectReferences.
        expectSent(recorder, before, [
          ['GET /sap/bc/adt/activation/inactiveobjects', 200],
        ]);
        return String(list).toLowerCase().includes(`"${uri}"`);
      };

      await runCycle(CASE, [prog], async () => {
        let mark = at();
        await prog.requireFree();
        // B4 r3-prog-validate (200, a free name), p0-absent (404).
        expectSent(recorder, mark, [
          ['POST /sap/bc/adt/programs/validation', 200],
          [`GET ${uri}`, 404],
        ]);

        mark = at();
        prog.markCreated();
        expectResult(
          await prog.handler.create(
            {
              programName: name,
              packageName: LOCAL_PACKAGE,
              description: DESCRIPTION,
            },
            {
              headers: integrationHeadersOf(prog.handler, 'create'),
              analyse: analyseException,
            },
          ),
          'create',
        );
        // B4 p1-create: 200.
        expectSent(recorder, mark, [
          ['POST /sap/bc/adt/programs/programs', 200],
        ]);

        mark = at();
        const found = expectResult(
          await utils.search(
            { query: name, maxResults: 10 },
            { analyse: analyseException },
          ),
          'search',
        );
        // B2 s10-search: 200, adtcore:objectReferences.
        const [searched] = expectSent(recorder, mark, [
          ['GET /sap/bc/adt/repository/informationsystem/search', 200],
        ]);
        expect(queryOf(searched, 'query')).toBe(name);
        expect(String(found).toLowerCase()).toContain(`"${uri}"`);

        mark = at();
        const structure = expectResult(
          await utils.getObjectStructure('PROG/P', name, {
            analyse: analyseException,
          }),
          'getObjectStructure',
        );
        // B2 s10-objstruct: 200, projectexplorer:objectstructure.
        const [structured] = expectSent(recorder, mark, [
          ['GET /sap/bc/adt/repository/objectstructure', 200],
        ]);
        expect(queryOf(structured, 'objectname')).toBe(name);
        expect(String(structure)).toContain('objectstructure');

        mark = at();
        const node = expectResult(
          await utils.fetchNodeStructure('DEVC/K', LOCAL_PACKAGE, {
            headers: integrationHeadersOf(utils, 'fetchNodeStructure'),
            analyse: analyseException,
          }),
          'fetchNodeStructure',
        );
        // B3-unmeasured b1-3-raw-nodestructure (the raw request): 200, the
        // package's objects as SEU_ADT_REPOSITORY_OBJ_NODE.
        expectSent(recorder, mark, [
          ['POST /sap/bc/adt/repository/nodestructure', 200],
        ]);
        expect(String(node)).toContain(`<OBJECT_NAME>${name}</OBJECT_NAME>`);

        mark = at();
        const catalogue = String(
          expectResult(
            await utils.discovery({}, { analyse: analyseException }),
            'discovery',
          ),
        );
        // B2 s10-discovery: 200; the collections: rfc-discovery.txt.
        expectSent(recorder, mark, [['GET /sap/bc/adt/discovery', 200]]);
        for (const collection of COLLECTIONS)
          expect([
            collection,
            catalogue.includes(`href="${collection}"`),
          ]).toEqual([collection, true]);

        mark = at();
        expectResult(await prog.lock(), 'lock');
        expectResult(
          await prog.handler.update(config, {
            headers: integrationHeadersOf(prog.handler, 'update'),
            lockHandle: prog.handle(),
            source: `REPORT ${name.toLowerCase()}.\nWRITE / 'utils readers'.`,
            analyse: analyseException,
          }),
          'update, not activated',
        );
        expectResult(await prog.unlock(), 'unlock');
        // B4 p2-lock, p2-update, p2-unlock.
        expectSent(recorder, mark, [
          [`POST ${uri} LOCK`, 200],
          [`PUT ${uri}/source/main`, 200],
          [`POST ${uri} UNLOCK`, 200],
        ]);

        expect(await inactive()).toBe(true);

        mark = at();
        expectResult(
          await utils.activateObjectsGroup([{ name, type: 'PROG/P' }], false, {
            headers: integrationHeadersOf(utils, 'activateObjectsGroup'),
            analyse: judged(analyseActivation),
          }),
          'activateObjectsGroup',
        );
        // docs/LEGACY.md "Measured on BASIS 7.40" (support package not
        // recorded): 200, empty — Task 6 measures it on 7.40 SP04.
        const [activated] = expectSent(recorder, mark, [
          ['POST /sap/bc/adt/activation', 200],
        ]);
        expect(String(activated?.data).toLowerCase()).toContain(
          `adtcore:uri="${uri}"`,
        );

        expect(await inactive()).toBe(false);

        mark = at();
        expectResult(await prog.lock(), 'lock for delete');
        const handle = prog.handle();
        expectResult(
          await prog.handler.delete(config, {
            headers: integrationHeadersOf(prog.handler, 'delete'),
            lockHandle: handle,
            analyse: judged(analyseDeletion),
          }),
          'delete',
        );
        expectResult(await prog.unlock(), 'unlock after delete');
        // B4 p9-del-lock, p9-delete, p9-del-unlock.
        const [, deleted] = expectSent(recorder, mark, [
          [`POST ${uri} LOCK`, 200],
          [`DELETE ${uri}`, 200],
          [`POST ${uri} UNLOCK`, 200],
        ]);
        expect(queryOf(deleted, 'lockHandle')).toBe(handle);

        mark = at();
        const gone = expectFailure(
          await prog.handler.readMetadata(config, {
            analyse: analyseException,
          }),
          'read after delete',
        );
        // B4 p9-read404.
        expect(gone.response?.status).toBe(404);
        expectSent(recorder, mark, [[`GET ${uri}`, 404]]);
      });
    }, 900000);
  });
});

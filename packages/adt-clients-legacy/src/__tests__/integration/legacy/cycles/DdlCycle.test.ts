/**
 * The DDL source cycle on SAP_BASIS 7.40 SP04 over RFC (spec §4).
 *
 * validate (name free) → create → lock → update (a view over `T000`) →
 * unlock → activate → read → readMetadata → check → `getVersions` (and
 * `getVersionSource`) refused → lock → delete → unlock → read `404`. Every
 * step asserts the requests it sent, their statuses and its effect read back;
 * the record of each answer is B4-cycles-20261026-2019 (d0–d8,
 * r3-ddl-validate).
 *
 * The DDL source is created by this run in `$TMP` (no transport) and deleted
 * by it — by its last steps, or by the cleanup when a step failed; nothing
 * this run did not create is touched.
 *
 * Runs on a legacy configuration over RFC with case
 * `legacy_740/legacy_cycle_ddl` enabled:
 * npm run test:live -- integration/legacy/cycles/DdlCycle
 */

import {
  analyseActivation,
  analyseCheck,
  analyseDeletion,
  analyseException,
} from '@mcp-abap-adt/adt-strategies';
import type { IDdlConfig } from '@mcp-abap-adt/interfaces-adt';
import { integrationHeadersOf } from '../../../../../../adt-clients/src/__tests__/helpers/adtHeaders';
import {
  expectFailure,
  expectResult,
} from '../../../../../../adt-clients/src/__tests__/helpers/contract';
import { judged } from '../../../../../../adt-clients/src/__tests__/helpers/judged';
import {
  cycleObject,
  expectRefusedUnsent,
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

const CASE = 'legacy_cycle_ddl';
const DESCRIPTION = 'legacy live cycle: DDL source';

describeLegacyRfc('Legacy 7.40 SP04 over RFC — DDL source cycle', () => {
  withLegacyCase(CASE, (params) => {
    let session: LegacySession | undefined;

    beforeAll(async () => {
      session = await openLegacySession();
    }, 120000);

    afterAll(async () => {
      await closeLegacySession(session);
    });

    it('creates, writes, activates, reads, checks and deletes a DDL source; its versions are refused', async () => {
      const { client, recorder } = session as LegacySession;
      const name = param(params, 'ddl_name');
      const sqlViewName = param(params, 'sql_view_name');
      requireOwnNames(CASE, [
        ['DDL source', name],
        ['DDL source', sqlViewName],
      ]);
      const config: IDdlConfig = { ddlName: name };
      const uri = `/sap/bc/adt/ddic/ddl/sources/${name.toLowerCase()}`;
      const source = `@AbapCatalog.sqlViewName: '${sqlViewName}'\ndefine view ${name} as select from t000 { mandt }`;
      const ddl = cycleObject({
        caseName: CASE,
        label: 'DDL source',
        name,
        config,
        handler: () => client.getDdl(),
        validateConfig: {
          ...config,
          packageName: LOCAL_PACKAGE,
          description: DESCRIPTION,
        },
      });
      const at = () => recorder.requests.length;

      await runCycle(CASE, [ddl], async () => {
        let mark = at();
        await ddl.requireFree();
        // B4 r3-ddl-validate (200, a free name), d0-absent (404).
        expectSent(recorder, mark, [
          ['POST /sap/bc/adt/ddic/ddl/validation', 200],
          [`GET ${uri}`, 404],
        ]);

        mark = at();
        ddl.markCreated();
        expectResult(
          await ddl.handler.create(
            {
              ddlName: name,
              packageName: LOCAL_PACKAGE,
              description: DESCRIPTION,
            },
            {
              headers: integrationHeadersOf(ddl.handler, 'create'),
              analyse: analyseException,
            },
          ),
          'create',
        );
        // B4 d1-create: 201.
        expectSent(recorder, mark, [
          ['POST /sap/bc/adt/ddic/ddl/sources', 201],
        ]);

        mark = at();
        expectResult(await ddl.lock(), 'lock');
        // B4 d2-lock.
        expectSent(recorder, mark, [[`POST ${uri} LOCK`, 200]]);

        mark = at();
        expectResult(
          await ddl.handler.update(config, {
            headers: integrationHeadersOf(ddl.handler, 'update'),
            lockHandle: ddl.handle(),
            source,
            analyse: analyseException,
          }),
          'update',
        );
        // B4 d2-update.
        const [put] = expectSent(recorder, mark, [
          [`PUT ${uri}/source/main`, 200],
        ]);
        expect(queryOf(put, 'lockHandle')).toBe(ddl.handle());

        mark = at();
        expectResult(await ddl.unlock(), 'unlock');
        // B4 d2-unlock.
        expectSent(recorder, mark, [[`POST ${uri} UNLOCK`, 200]]);

        mark = at();
        expectResult(
          await ddl.handler.activate(config, {
            headers: integrationHeadersOf(ddl.handler, 'activate'),
            analyse: judged(analyseActivation),
          }),
          'activate',
        );
        // B4 d3-activate.
        expectSent(recorder, mark, [['POST /sap/bc/adt/activation', 200]]);

        mark = at();
        const read = expectResult(
          await ddl.handler.read(config, 'active', {
            analyse: analyseException,
          }),
          'read active',
        );
        // B4 d4-read.
        const [get] = expectSent(recorder, mark, [
          [`GET ${uri}/source/main`, 200],
        ]);
        expect(queryOf(get, 'version')).toBe('active');
        expect(String(read).toLowerCase()).toContain('select from t000');

        mark = at();
        const metadata = expectResult(
          await ddl.handler.readMetadata(config, {
            analyse: analyseException,
          }),
          'readMetadata',
        );
        // B4 d5-readMetadata.
        expectSent(recorder, mark, [[`GET ${uri}`, 200]]);
        expect(String(metadata).toUpperCase()).toContain(`"${name}"`);

        mark = at();
        expectResult(
          await ddl.handler.check(config, 'active', {
            headers: integrationHeadersOf(ddl.handler, 'check'),
            analyse: judged(analyseCheck),
          }),
          'check',
        );
        // B4 d6-check.
        expectSent(recorder, mark, [['POST /sap/bc/adt/checkruns', 200]]);

        mark = at();
        // B4 d7-getVersions: GET <source>/versions answered 404 — refused,
        // nothing sent; and so the version source (Task 2).
        expectRefusedUnsent(
          await ddl.handler.getVersions(config, { analyse: analyseException }),
          recorder,
          mark,
        );
        expectRefusedUnsent(
          await ddl.handler.getVersionSource(`${uri}/versions/0/content`, {
            analyse: analyseException,
          }),
          recorder,
          mark,
        );

        mark = at();
        expectResult(await ddl.lock(), 'lock for delete');
        const handle = ddl.handle();
        expectResult(
          await ddl.handler.delete(config, {
            headers: integrationHeadersOf(ddl.handler, 'delete'),
            lockHandle: ddl.handle(),
            analyse: judged(analyseDeletion),
          }),
          'delete',
        );
        expectResult(await ddl.unlock(), 'unlock after delete');
        // B4 d8-del-lock, d8-delete, d8-del-unlock.
        const [, deleted] = expectSent(recorder, mark, [
          [`POST ${uri} LOCK`, 200],
          [`DELETE ${uri}`, 200],
          [`POST ${uri} UNLOCK`, 200],
        ]);
        expect(queryOf(deleted, 'lockHandle')).toBe(handle);

        mark = at();
        const gone = expectFailure(
          await ddl.handler.readMetadata(config, {
            analyse: analyseException,
          }),
          'read after delete',
        );
        // B4 d8-read404.
        expect(gone.response?.status).toBe(404);
        expectSent(recorder, mark, [[`GET ${uri}`, 404]]);
      });
    }, 900000);
  });
});

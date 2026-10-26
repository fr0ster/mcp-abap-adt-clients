/**
 * The include cycle on SAP_BASIS 7.40 SP04 over RFC (spec §4).
 *
 * validate (name free) → create (the unversioned pair) → lock → update →
 * unlock → activate → read → readMetadata → lock → delete (one `DELETE`
 * under the caller's lock, spec §2) → unlock → read `404`. Every step asserts
 * the requests it sent, their statuses and its effect read back; the record
 * of each answer is B4-cycles-20261026-2019 (n0–n8, r3-incl-validate).
 *
 * The create passes `application/vnd.sap.adt.programs.includes+xml` both
 * ways, as a consumer must on 7.40 (v2 answers `400
 * ExceptionContentHandlerNotFound`, B4 n1-create); `integrationHeadersOf`
 * hands it out for `AdtIncludeLegacy.create` (legacyRegistrations.ts).
 *
 * The include is created by this run in `$TMP` (no transport) and deleted
 * by it — by its last steps, or by the cleanup when a step failed; nothing
 * this run did not create is touched.
 *
 * Runs on a legacy configuration over RFC with case
 * `legacy_740/legacy_cycle_include` enabled:
 * npm run test:live -- integration/legacy/cycles/IncludeCycle
 */

import {
  analyseActivation,
  analyseDeletion,
  analyseException,
} from '@mcp-abap-adt/adt-strategies';
import type { IIncludeConfig } from '@mcp-abap-adt/interfaces-adt';
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
  headerOf,
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

const CASE = 'legacy_cycle_include';
const DESCRIPTION = 'legacy live cycle: include';
const INCLUDE_TYPE = 'application/vnd.sap.adt.programs.includes+xml';

describeLegacyRfc('Legacy 7.40 SP04 over RFC — include cycle', () => {
  withLegacyCase(CASE, (params) => {
    let session: LegacySession | undefined;

    beforeAll(async () => {
      session = await openLegacySession();
    }, 120000);

    afterAll(async () => {
      await closeLegacySession(session);
    });

    it('creates with the unversioned pair, writes, activates, reads and deletes an include', async () => {
      const { client, recorder } = session as LegacySession;
      const name = param(params, 'include_name');
      requireOwnNames(CASE, [['include', name]]);
      const config: IIncludeConfig = { includeName: name };
      const uri = `/sap/bc/adt/programs/includes/${name.toLowerCase()}`;
      const source = '* Written by the legacy live cycle over RFC.';
      const incl = cycleObject({
        caseName: CASE,
        label: 'include',
        name,
        config,
        handler: () => client.getInclude(),
        validateConfig: {
          ...config,
          packageName: LOCAL_PACKAGE,
          description: DESCRIPTION,
        },
      });
      const at = () => recorder.requests.length;

      await runCycle(CASE, [incl], async () => {
        let mark = at();
        await incl.requireFree();
        // B4 r3-incl-validate (200, a free name), n0-absent (404).
        expectSent(recorder, mark, [
          ['POST /sap/bc/adt/includes/validation', 200],
          [`GET ${uri}`, 404],
        ]);

        mark = at();
        incl.markCreated();
        expectResult(
          await incl.handler.create(
            {
              includeName: name,
              packageName: LOCAL_PACKAGE,
              description: DESCRIPTION,
            },
            {
              headers: integrationHeadersOf(incl.handler, 'create'),
              analyse: analyseException,
            },
          ),
          'create',
        );
        // B4 n1-create-alt: the unversioned pair both ways, 200.
        const [created] = expectSent(recorder, mark, [
          ['POST /sap/bc/adt/programs/includes', 200],
        ]);
        expect(headerOf(created, 'Content-Type')).toBe(INCLUDE_TYPE);
        expect(headerOf(created, 'Accept')).toBe(INCLUDE_TYPE);

        mark = at();
        expectResult(await incl.lock(), 'lock');
        // B4 n2-lock.
        expectSent(recorder, mark, [[`POST ${uri} LOCK`, 200]]);

        mark = at();
        expectResult(
          await incl.handler.update(config, {
            headers: integrationHeadersOf(incl.handler, 'update'),
            lockHandle: incl.handle(),
            source,
            analyse: analyseException,
          }),
          'update',
        );
        // B4 n2-update.
        const [put] = expectSent(recorder, mark, [
          [`PUT ${uri}/source/main`, 200],
        ]);
        expect(queryOf(put, 'lockHandle')).toBe(incl.handle());

        mark = at();
        expectResult(await incl.unlock(), 'unlock');
        // B4 n2-unlock.
        expectSent(recorder, mark, [[`POST ${uri} UNLOCK`, 200]]);

        mark = at();
        expectResult(
          await incl.handler.activate(config, {
            headers: integrationHeadersOf(incl.handler, 'activate'),
            analyse: judged(analyseActivation),
          }),
          'activate',
        );
        // B4 n3-activate.
        expectSent(recorder, mark, [['POST /sap/bc/adt/activation', 200]]);

        mark = at();
        const read = expectResult(
          await incl.handler.read(config, 'active', {
            analyse: analyseException,
          }),
          'read active',
        );
        // B4 n4-read.
        const [get] = expectSent(recorder, mark, [
          [`GET ${uri}/source/main`, 200],
        ]);
        expect(queryOf(get, 'version')).toBe('active');
        expect(String(read)).toContain(source);

        mark = at();
        const metadata = expectResult(
          await incl.handler.readMetadata(config, {
            analyse: analyseException,
          }),
          'readMetadata',
        );
        // B4 n5-readMetadata.
        expectSent(recorder, mark, [[`GET ${uri}`, 200]]);
        expect(String(metadata).toUpperCase()).toContain(`"${name}"`);

        mark = at();
        expectResult(await incl.lock(), 'lock for delete');
        const handle = incl.handle();
        expectResult(
          await incl.handler.delete(config, {
            headers: integrationHeadersOf(incl.handler, 'delete'),
            lockHandle: incl.handle(),
            analyse: judged(analyseDeletion),
          }),
          'delete',
        );
        expectResult(await incl.unlock(), 'unlock after delete');
        // B4 n8-rawdel-lock, n8-rawDELETE (the library's delete sends that
        // request since Task 2), n8-rawdel-unlock.
        const [, deleted] = expectSent(recorder, mark, [
          [`POST ${uri} LOCK`, 200],
          [`DELETE ${uri}`, 200],
          [`POST ${uri} UNLOCK`, 200],
        ]);
        expect(queryOf(deleted, 'lockHandle')).toBe(handle);

        mark = at();
        const gone = expectFailure(
          await incl.handler.readMetadata(config, {
            analyse: analyseException,
          }),
          'read after delete',
        );
        // B4 n8-read404.
        expect(gone.response?.status).toBe(404);
        expectSent(recorder, mark, [[`GET ${uri}`, 404]]);
      });
    }, 900000);
  });
});

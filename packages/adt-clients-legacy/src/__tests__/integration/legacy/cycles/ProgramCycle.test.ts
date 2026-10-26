/**
 * The program cycle on SAP_BASIS 7.40 SP04 over RFC (spec §4).
 *
 * validate (name free) → create → lock → update → unlock → activate → read →
 * readMetadata → check → getVersions → getVersionSource → `readTransport`
 * refused → lock → delete → unlock → read `404`. Every step asserts the
 * requests it sent, their statuses and its effect read back; the record of
 * each answer is B4-cycles-20261026-2019 (p0–p9, r3-prog-validate), except
 * the read and readMetadata of a program this run wrote: B4 did not read
 * them back, B2-reads-20261023-1749 (s1) read a system program — Task 6
 * measures them here.
 *
 * The program is created by this run in `$TMP` (no transport) and deleted
 * by it — by its last steps, or by the cleanup when a step failed; nothing
 * this run did not create is touched.
 *
 * Runs on a legacy configuration over RFC with case
 * `legacy_740/legacy_cycle_program` enabled:
 * npm run test:live -- integration/legacy/cycles/ProgramCycle
 */

import { programDocuments } from '@mcp-abap-adt/adt-clients';
import {
  analyseActivation,
  analyseCheck,
  analyseDeletion,
  analyseException,
  objectVersions,
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

const CASE = 'legacy_cycle_program';
const DESCRIPTION = 'legacy live cycle: program';

describeLegacyRfc('Legacy 7.40 SP04 over RFC — program cycle', () => {
  withLegacyCase(CASE, (params) => {
    let session: LegacySession | undefined;

    beforeAll(async () => {
      session = await openLegacySession();
    }, 120000);

    afterAll(async () => {
      await closeLegacySession(session);
    });

    it('creates, writes, activates, reads, checks, lists versions and deletes a program', async () => {
      const { client, recorder } = session as LegacySession;
      const name = param(params, 'program_name');
      requireOwnNames(CASE, [['program', name]]);
      const config: IProgramConfig = { programName: name };
      const uri = `/sap/bc/adt/programs/programs/${name.toLowerCase()}`;
      const source = `REPORT ${name.toLowerCase()}.\nWRITE / 'legacy live cycle'.`;
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

      await runCycle(CASE, [prog], async () => {
        let mark = at();
        await prog.requireFree();
        // B4 r3-prog-validate (200, a free name), p0-absent (404).
        expectSent(recorder, mark, [
          ['POST /sap/bc/adt/programs/validation', 200],
          [`GET ${uri}`, 404],
        ]);

        mark = at();
        expectResult(
          await prog.createOwned(() =>
            prog.handler.create(
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
          ),
          'create',
        );
        // B4 p1-create: 200.
        expectSent(recorder, mark, [
          ['POST /sap/bc/adt/programs/programs', 200],
        ]);

        mark = at();
        expectResult(await prog.lock(), 'lock');
        // B4 p2-lock.
        expectSent(recorder, mark, [[`POST ${uri} LOCK`, 200]]);

        mark = at();
        expectResult(
          await prog.handler.update(config, {
            headers: integrationHeadersOf(prog.handler, 'update'),
            lockHandle: prog.handle(),
            source,
            analyse: analyseException,
          }),
          'update',
        );
        // B4 p2-update.
        const [put] = expectSent(recorder, mark, [
          [`PUT ${uri}/source/main`, 200],
        ]);
        expect(queryOf(put, 'lockHandle') === prog.handle()).toBe(true);

        mark = at();
        expectResult(await prog.unlock(), 'unlock');
        // B4 p2-unlock.
        expectSent(recorder, mark, [[`POST ${uri} UNLOCK`, 200]]);

        mark = at();
        expectResult(
          await prog.handler.activate(config, {
            headers: integrationHeadersOf(prog.handler, 'activate'),
            analyse: judged(analyseActivation),
          }),
          'activate',
        );
        // B4 p3-activate.
        expectSent(recorder, mark, [['POST /sap/bc/adt/activation', 200]]);

        mark = at();
        const read = expectResult(
          await prog.handler.read(config, 'active', {
            analyse: analyseException,
          }),
          'read active',
        );
        // Not measured on a program this run wrote (B2 s1-prog-read: a system
        // program, 200) — Task 6.
        const [get] = expectSent(recorder, mark, [
          [`GET ${uri}/source/main`, 200],
        ]);
        expect(queryOf(get, 'version')).toBe('active');
        expect(String(read)).toContain('legacy live cycle');

        mark = at();
        const metadata = expectResult(
          await prog.handler.readMetadata(config, {
            analyse: analyseException,
          }),
          'readMetadata',
        );
        // Not measured on a program this run wrote (B2 s1-prog-meta: a system
        // program, 200) — Task 6.
        expectSent(recorder, mark, [[`GET ${uri}`, 200]]);
        expect(String(metadata).toUpperCase()).toContain(`"${name}"`);

        mark = at();
        expectResult(
          await prog.handler.check(config, 'active', {
            headers: integrationHeadersOf(prog.handler, 'check'),
            analyse: judged(analyseCheck),
          }),
          'check',
        );
        // B4 p4-check.
        expectSent(recorder, mark, [['POST /sap/bc/adt/checkruns', 200]]);

        const versioned = client.getProgram({
          ...programDocuments,
          versions: objectVersions,
        });
        mark = at();
        const versions = expectResult(
          await versioned.getVersions(config, { analyse: analyseException }),
          'getVersions',
        );
        // B4 p5-getVersions.
        expectSent(recorder, mark, [[`GET ${uri}/source/main/versions`, 200]]);
        expect(versions.length).toBeGreaterThan(0);
        const contentUri = versions[0]?.contentUri ?? '';
        expect(contentUri).toContain(`${uri}/source/main/versions/`);

        mark = at();
        const versionSource = expectResult(
          await versioned.getVersionSource(contentUri, {
            analyse: analyseException,
          }),
          'getVersionSource',
        );
        // B4 p6-getVersionSource.
        expectSent(recorder, mark, [[`GET ${contentUri.split('?')[0]}`, 200]]);
        expect(String(versionSource).toUpperCase()).toContain('REPORT');

        mark = at();
        // B4 p8-readTransport: 404 for every type — refused, nothing sent.
        expectRefusedUnsent(
          await prog.handler.readTransport(config, {
            analyse: analyseException,
          }),
          recorder,
          mark,
        );

        mark = at();
        expectResult(await prog.lock(), 'lock for delete');
        const handle = prog.handle();
        expectResult(
          await prog.handler.delete(config, {
            headers: integrationHeadersOf(prog.handler, 'delete'),
            lockHandle: prog.handle(),
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
        expect(queryOf(deleted, 'lockHandle') === handle).toBe(true);

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

/**
 * Outside `$TMP`: a program in the transportable package `ZLG7_TEST`, on the
 * test environment's request, on SAP_BASIS 7.40 SP04 over RFC (spec §4.2,
 * §7.2 — the two not measured until this runs).
 *
 * The package and the request are the environment's: `npm run legacy:setup`
 * creates them (7.40's ADT cannot create a request), and `beforeAll` reads
 * them through the env's status run. Then, asserted on the recorder:
 *
 * - create in `ZLG7_TEST` with the request;
 * - lock → `PUT ?lockHandle=&corrNr=<request>` → unlock;
 * - the transport list and `readMetadata` name the request;
 * - lock → `DELETE ?lockHandle=&corrNr=<request>` → unlock, and the read
 *   answers `404`.
 *
 * A configured name that already exists fails the run before anything is
 * created; `afterAll` removes only what this run created and is still there.
 * Nothing is released; `npm run legacy:teardown` deletes the request.
 *
 * Runs on a legacy configuration over RFC with case
 * `legacy_740/legacy_transportable` enabled:
 * npm run test:detached -- integration/legacy/LegacyTransportable
 */

import { analyseException } from '@mcp-abap-adt/adt-strategies';
import { integrationHeadersOf } from '../../helpers/adtHeaders';
import { expectFailure, expectResult } from '../../helpers/contract';
import { ENV_PACKAGE, requireOwnNames, status } from '../../helpers/legacyEnv';
import {
  closeLegacySession,
  deleteLocked,
  type LegacyDeletable,
  type LegacyLockable,
  type LegacyObject,
  type LegacySession,
  lineOf,
  openLegacySession,
  param,
  queryOf,
  removeCreated,
  requireAbsent,
  sentSince,
  stepOf,
  withLegacyCase,
  withLock,
} from '../../helpers/legacyLive';
import { describeLegacyRfc } from '../../helpers/legacyRfc';

const DESCRIPTION = 'legacy live check: transportable';
const SOURCE = [
  '*&---------------------------------------------------------------------*',
  '*& Written by the legacy live check over RFC, on a transport request.',
  '*&---------------------------------------------------------------------*',
  'REPORT zlg7_tr_prog.',
  "WRITE / 'legacy live check'.",
].join('\n');

describeLegacyRfc('Legacy 7.40 SP04 over RFC — transportable package', () => {
  withLegacyCase('legacy_transportable', (params) => {
    let session: LegacySession | undefined;
    const current = () => session as LegacySession;
    let request = '';
    const programName = param(params, 'program_name');
    const config = () => ({ programName, transportRequest: request });
    const program: LegacyObject = {
      label: 'program',
      name: programName,
      handler: () =>
        current().client.getProgram() as unknown as LegacyDeletable<object>,
      get config() {
        return config();
      },
    };
    /** Set once this run created the program: the only thing it may delete. */
    let created = false;

    beforeAll(async () => {
      requireOwnNames('legacy_transportable', [['program', programName]]);
      session = await openLegacySession();
      const env = await status(current());
      if (!env.result.request || !env.result.packageExists)
        throw new Error(
          `legacy_740/legacy_transportable: no open environment request or no package ${ENV_PACKAGE} — run npm run legacy:setup first`,
        );
      request = env.result.request;
      await requireAbsent('legacy_transportable', [program]);
      const handler = current().client.getProgram();
      expectResult(
        await handler.create(
          {
            ...config(),
            packageName: ENV_PACKAGE,
            description: DESCRIPTION,
          },
          {
            headers: integrationHeadersOf(handler, 'create'),
            analyse: analyseException,
          },
        ),
        `create program ${programName} in ${ENV_PACKAGE}`,
      );
      created = true;
    }, 600000);

    afterAll(async () => {
      try {
        if (session && created)
          await removeCreated('legacy_transportable', [program]);
      } finally {
        await closeLegacySession(session);
      }
    }, 600000);

    it('writes under the lock with corrNr naming the request', async () => {
      const { recorder, client } = current();
      const handler = client.getProgram();
      const mark = recorder.requests.length;

      await withLock(
        handler as unknown as LegacyLockable<ReturnType<typeof config>>,
        config(),
        `program ${programName}`,
        async (lockHandle) =>
          expectResult(
            await handler.update(config(), {
              headers: integrationHeadersOf(handler, 'update'),
              lockHandle,
              source: SOURCE,
              analyse: analyseException,
            }),
            'write the program',
          ),
      );

      const sent = sentSince(recorder, mark);
      expect(sent.map(stepOf)).toEqual(['LOCK', 'PUT', 'UNLOCK']);
      expect(sent.map((r) => r.status)).toEqual([200, 200, 200]);
      const put = sent[1];
      expect(put && queryOf(put, 'corrNr')).toBe(request);
      expect(put && queryOf(put, 'lockHandle')).toBeTruthy();
    }, 120000);

    it('the transport list and readMetadata name the request', async () => {
      const { recorder, client } = current();
      const transports = client.getRequest();
      const mark = recorder.requests.length;

      const list = String(
        expectResult(
          await transports.list({ analyse: analyseException }),
          'list',
        ),
      );
      const metadata = String(
        expectResult(
          await transports.readMetadata({}, { analyse: analyseException }),
          'readMetadata',
        ),
      );

      const sent = sentSince(recorder, mark);
      expect(sent.map(lineOf)).toEqual([
        'GET /sap/bc/cts/transportrequests',
        'GET /sap/bc/cts/transportrequests',
      ]);
      expect(sent.map((r) => r.status)).toEqual([200, 200]);
      expect(list).toContain(request);
      expect(metadata).toContain(request);
    }, 120000);

    it('deletes with the lock handle and corrNr; the read answers 404', async () => {
      const { recorder, client } = current();
      const handler = client.getProgram();
      const mark = recorder.requests.length;

      expectResult(
        await deleteLocked(
          handler as unknown as LegacyDeletable<ReturnType<typeof config>>,
          config(),
          `program ${programName}`,
        ),
        `delete program ${programName}`,
      );

      const sent = sentSince(recorder, mark);
      expect(sent.map(stepOf)).toEqual(['LOCK', 'DELETE', 'UNLOCK']);
      expect(sent.map((r) => r.status)).toEqual([200, 200, 200]);
      const del = sent[1];
      expect(del && queryOf(del, 'corrNr')).toBe(request);
      expect(del && queryOf(del, 'lockHandle')).toBe(
        sent[2] && queryOf(sent[2], 'lockHandle'),
      );
      const read = expectFailure(
        await handler.readMetadata(
          { programName },
          { analyse: analyseException },
        ),
        'read after the delete',
      );
      expect(read.response?.status).toBe(404);
    }, 120000);
  });
});

/**
 * A function include on SAP_BASIS 7.40 SP04 over RFC (spec §10.4, §11.2).
 *
 * Measured: 7.40 SP04 refuses the v2 type for a function include create and
 * creates it with `application/vnd.sap.adt.functions.fincludes+xml` both ways;
 * the include is then written under its lock and activated. The library sends
 * the pair its caller passes, and `integrationHeadersOf` passes the v1 pair for
 * `AdtFunctionIncludeLegacy.create`: the recorder shows it on the wire.
 *
 * The include's own `delete` is refused on 7.40 (spec §4.3), so the test
 * creates a function group of its own in `$TMP` (no transport), creates the
 * include in it, and removes the group in `afterAll` — lock, `DELETE
 * ?lockHandle=`, unlock — which removes its includes with it.
 *
 * Runs on a legacy configuration over RFC with case
 * `legacy_740/legacy_function_include` enabled:
 * npm run test:detached -- integration/legacy/LegacyFunctionInclude
 */

import { integrationHeadersOf } from '../../helpers/adtHeaders';
import { expectResult } from '../../helpers/contract';
import {
  closeLegacySession,
  type LegacyDeletable,
  type LegacySession,
  LOCAL_PACKAGE,
  lineOf,
  openLegacySession,
  param,
  removeIfPresent,
  sentSince,
  stepOf,
  withLegacyCase,
} from '../../helpers/legacyLive';
import { describeLegacyRfc } from '../../helpers/legacyRfc';

const DESCRIPTION = 'legacy live check: function include';
const V1 = 'application/vnd.sap.adt.functions.fincludes+xml';
const SOURCE = '* Written by the legacy live check over RFC.';

/** A header's value, its name compared without case. */
function headerOf(
  headers: Record<string, string> | undefined,
  name: string,
): string | undefined {
  const key = Object.keys(headers ?? {}).find(
    (k) => k.toLowerCase() === name.toLowerCase(),
  );
  return key === undefined ? undefined : headers?.[key];
}

describeLegacyRfc('Legacy 7.40 SP04 over RFC — function include', () => {
  withLegacyCase('legacy_function_include', (params) => {
    let session: LegacySession | undefined;
    const current = () => session as LegacySession;
    const group = { functionGroupName: param(params, 'function_group_name') };
    const include = { ...group, includeName: param(params, 'include_name') };
    const groups = () =>
      current().client.getFunctionGroup() as unknown as LegacyDeletable<
        typeof group
      >;

    beforeAll(async () => {
      session = await openLegacySession();
      await removeIfPresent(groups(), group, 'function group');
      const handler = current().client.getFunctionGroup();
      expectResult(
        await handler.create(
          { ...group, packageName: LOCAL_PACKAGE, description: DESCRIPTION },
          { headers: integrationHeadersOf(handler, 'create') },
        ),
        'create the function group',
      );
    }, 600000);

    afterAll(async () => {
      try {
        if (session) await removeIfPresent(groups(), group, 'function group');
      } finally {
        await closeLegacySession(session);
      }
    }, 600000);

    it('creates the include with the v1 pair', async () => {
      const { recorder, client } = current();
      const finc = client.getFunctionInclude();
      const mark = recorder.requests.length;

      expectResult(
        await finc.create(
          { ...include, description: DESCRIPTION },
          { headers: integrationHeadersOf(finc, 'create') },
        ),
        'create the function include',
      );

      const sent = sentSince(recorder, mark);
      expect(sent.map((r) => r.method)).toEqual(['POST']);
      expect(headerOf(sent[0]?.headers, 'Content-Type')).toBe(V1);
      expect(headerOf(sent[0]?.headers, 'Accept')).toBe(V1);
      expect(sent[0]?.status).toBe(200);
    }, 120000);

    it('writes the include under its lock', async () => {
      const { recorder, client } = current();
      const finc = client.getFunctionInclude();
      const mark = recorder.requests.length;

      const lockHandle = String(
        expectResult(await finc.lock(include), 'lock the function include'),
      );
      try {
        expectResult(
          await finc.update(include, {
            headers: integrationHeadersOf(finc, 'update'),
            lockHandle,
            source: SOURCE,
          }),
          'write the function include',
        );
      } finally {
        await finc.unlock(include, lockHandle);
      }

      const sent = sentSince(recorder, mark);
      expect(sent.map(stepOf)).toEqual(['LOCK', 'PUT', 'UNLOCK']);
      expect(sent.map((r) => r.status)).toEqual([200, 200, 200]);
      expect(
        expectResult(
          await finc.read(include, 'inactive'),
          'read the function include (inactive)',
        ),
      ).toEqual(expect.stringContaining(SOURCE));
    }, 120000);

    it('activates the include', async () => {
      const { recorder, client } = current();
      const finc = client.getFunctionInclude();
      const mark = recorder.requests.length;

      expectResult(
        await finc.activate(include, {
          headers: integrationHeadersOf(finc, 'activate'),
        }),
        'activate the function include',
      );

      const sent = sentSince(recorder, mark);
      expect(sent.map(lineOf)).toEqual(['POST /sap/bc/adt/activation']);
      expect(sent[0]?.status).toBe(200);
    }, 120000);
  });
});

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
 * ?lockHandle=`, unlock — which removes its includes with it. A group of the
 * configured name that already exists fails the run and is left alone: only a
 * group this run created is deleted.
 *
 * Runs on a legacy configuration over RFC with case
 * `legacy_740/legacy_function_include` enabled:
 * npm run test:detached -- integration/legacy/LegacyFunctionInclude
 */

import {
  analyseActivation,
  analyseException,
} from '@mcp-abap-adt/adt-strategies';
import { integrationHeadersOf } from '../../../../../adt-clients/src/__tests__/helpers/adtHeaders';
import { expectResult } from '../../../../../adt-clients/src/__tests__/helpers/contract';
import { judged } from '../../../../../adt-clients/src/__tests__/helpers/judged';
import { requireOwnNames } from '../../helpers/legacyEnv';
import {
  closeLegacySession,
  type LegacyDeletable,
  type LegacyLockable,
  type LegacyObject,
  type LegacySession,
  LOCAL_PACKAGE,
  lineOf,
  openLegacySession,
  param,
  removeCreated,
  requireAbsent,
  sentSince,
  stepOf,
  withLegacyCase,
  withLock,
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
    const groupObject: LegacyObject = {
      label: 'function group',
      name: group.functionGroupName,
      handler: () =>
        current().client.getFunctionGroup() as unknown as LegacyDeletable<object>,
      config: group,
    };
    /** Set once this run created the group: the only thing it may delete. */
    let created = false;

    beforeAll(async () => {
      requireOwnNames('legacy_function_include', [
        ['function group', group.functionGroupName],
        ['function include', include.includeName],
      ]);
      session = await openLegacySession();
      await requireAbsent('legacy_function_include', [groupObject]);
      const handler = current().client.getFunctionGroup();
      expectResult(
        await handler.create(
          { ...group, packageName: LOCAL_PACKAGE, description: DESCRIPTION },
          {
            headers: integrationHeadersOf(handler, 'create'),
            analyse: analyseException,
          },
        ),
        `create function group ${group.functionGroupName}`,
      );
      created = true;
    }, 600000);

    afterAll(async () => {
      try {
        if (session && created)
          await removeCreated('legacy_function_include', [groupObject]);
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
          {
            headers: integrationHeadersOf(finc, 'create'),
            analyse: analyseException,
          },
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

      await withLock(
        finc as unknown as LegacyLockable<typeof include>,
        include,
        `function include ${include.includeName}`,
        async (lockHandle) =>
          expectResult(
            await finc.update(include, {
              headers: integrationHeadersOf(finc, 'update'),
              lockHandle,
              source: SOURCE,
              analyse: analyseException,
            }),
            'write the function include',
          ),
      );

      const sent = sentSince(recorder, mark);
      expect(sent.map(stepOf)).toEqual(['LOCK', 'PUT', 'UNLOCK']);
      expect(sent.map((r) => r.status)).toEqual([200, 200, 200]);
      expect(
        expectResult(
          await finc.read(include, 'inactive', { analyse: analyseException }),
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
          analyse: judged(analyseActivation),
        }),
        'activate the function include',
      );

      const sent = sentSince(recorder, mark);
      expect(sent.map(lineOf)).toEqual(['POST /sap/bc/adt/activation']);
      expect(sent[0]?.status).toBe(200);
    }, 120000);
  });
});

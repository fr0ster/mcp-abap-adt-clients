/**
 * The function include cycle on SAP_BASIS 7.40 SP04 over RFC (spec §4).
 *
 * In a function group of its own: validate the group's name free → create the
 * group → validate the include's name free → create the include (the v1
 * pair) → lock → update → unlock →
 * activate → read → readMetadata → check; then the group is removed (lock →
 * delete → unlock) and the include with it: its read answers `404`. Every
 * step asserts the requests it sent, their statuses and its effect read back.
 *
 * The record of each answer is B3-fugr-v1-20261023-1632 (the group's create
 * and delete, the include's create with
 * `application/vnd.sap.adt.functions.fincludes+xml`, its write under its
 * lock, its activation, its read `404` after the group's delete), with these
 * not measured there and measured by Task 6 here:
 * - the group's and the include's `validate` of a name that does not exist
 *   (the include's reads its group);
 * - the include's read and readMetadata of an include this run wrote
 *   (B2-reads-20261023-1749 s5-finc-read read a system include: `200`);
 * - the include's check.
 *
 * The include's own `delete` is refused on 7.40 (spec §4.3): it goes with its
 * group. Both are created by this run in `$TMP` (no transport); the cleanup,
 * when a step failed, releases a lock still held on the include and deletes
 * the group — nothing this run did not create is touched.
 *
 * Runs on a legacy configuration over RFC with case
 * `legacy_740/legacy_cycle_function_include` enabled:
 * npm run test:live -- integration/legacy/cycles/FunctionIncludeCycle
 */

import {
  analyseActivation,
  analyseCheck,
  analyseDeletion,
  analyseException,
} from '@mcp-abap-adt/adt-strategies';
import type {
  IFunctionGroupConfig,
  IFunctionIncludeConfig,
} from '@mcp-abap-adt/interfaces-adt';
import { integrationHeadersOf } from '../../../../../../adt-clients/src/__tests__/helpers/adtHeaders';
import {
  expectFailure,
  expectResult,
} from '../../../../../../adt-clients/src/__tests__/helpers/contract';
import { judged } from '../../../../../../adt-clients/src/__tests__/helpers/judged';
import {
  cycleObject,
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

const CASE = 'legacy_cycle_function_include';
const DESCRIPTION = 'legacy live cycle: function include';
const V1 = 'application/vnd.sap.adt.functions.fincludes+xml';
const SOURCE = '* Written by the legacy live cycle over RFC.';

describeLegacyRfc('Legacy 7.40 SP04 over RFC — function include cycle', () => {
  withLegacyCase(CASE, (params) => {
    let session: LegacySession | undefined;

    beforeAll(async () => {
      session = await openLegacySession();
    }, 120000);

    afterAll(async () => {
      await closeLegacySession(session);
    });

    it('creates an include in a group of its own, writes, activates, reads and checks it, and removes it with the group', async () => {
      const { client, recorder } = session as LegacySession;
      const groupName = param(params, 'function_group_name');
      const includeName = param(params, 'include_name');
      requireOwnNames(CASE, [
        ['function group', groupName],
        ['function include', includeName],
      ]);
      const groupConfig: IFunctionGroupConfig = {
        functionGroupName: groupName,
      };
      const includeConfig: IFunctionIncludeConfig = {
        functionGroupName: groupName,
        includeName,
      };
      const groupUri = `/sap/bc/adt/functions/groups/${groupName.toLowerCase()}`;
      const includeUri = `${groupUri}/includes/${includeName.toLowerCase()}`;
      const group = cycleObject({
        caseName: CASE,
        label: 'function group',
        name: groupName,
        config: groupConfig,
        handler: () => client.getFunctionGroup(),
        validateConfig: {
          ...groupConfig,
          packageName: LOCAL_PACKAGE,
          description: DESCRIPTION,
        },
      });
      const include = cycleObject({
        caseName: CASE,
        label: 'function include',
        name: includeName,
        config: includeConfig,
        handler: () => client.getFunctionInclude(),
        validateConfig: { ...includeConfig, description: DESCRIPTION },
        removedWith: 'function group',
      });
      const at = () => recorder.requests.length;

      // The include first: a lock still held on it is released before the
      // group is deleted.
      await runCycle(CASE, [include, group], async () => {
        let mark = at();
        await group.requireFree();
        // validate of a free name: not measured — Task 6; absent:
        // B3-fugr-v1 a2-0-read (404).
        expectSent(recorder, mark, [
          ['POST /sap/bc/adt/functions/validation', 200],
          [`GET ${groupUri}`, 404],
        ]);

        mark = at();
        expectResult(
          await group.createOwned(() =>
            group.handler.create(
              {
                functionGroupName: groupName,
                packageName: LOCAL_PACKAGE,
                description: DESCRIPTION,
              },
              {
                headers: integrationHeadersOf(group.handler, 'create'),
                analyse: analyseException,
              },
            ),
          ),
          'create group',
        );
        // B3-fugr-v1 a2-1-create-group: 200.
        expectSent(recorder, mark, [
          ['POST /sap/bc/adt/functions/groups', 200],
        ]);

        mark = at();
        await include.requireFree();
        // The include's validate reads its group (the library's
        // validateFunctionIncludeName), and the include reads absent: neither
        // measured on 7.40 — Task 6 (B3-fugr-v1 a2-9-include-read: an absent
        // include reads 404).
        expectSent(recorder, mark, [
          [`GET ${groupUri}`, 200],
          [`GET ${includeUri}`, 404],
        ]);

        mark = at();
        expectResult(
          await include.createOwned(() =>
            include.handler.create(
              {
                functionGroupName: groupName,
                includeName,
                description: DESCRIPTION,
              },
              {
                headers: integrationHeadersOf(include.handler, 'create'),
                analyse: analyseException,
              },
            ),
          ),
          'create include',
        );
        // B3-fugr-v1 a2-4-create-include: the v1 pair both ways, 200.
        const [created] = expectSent(recorder, mark, [
          [`POST ${groupUri}/includes`, 200],
        ]);
        expect(headerOf(created, 'Content-Type')).toBe(V1);
        expect(headerOf(created, 'Accept')).toBe(V1);

        mark = at();
        expectResult(await include.lock(), 'lock include');
        expectResult(
          await include.handler.update(includeConfig, {
            headers: integrationHeadersOf(include.handler, 'update'),
            lockHandle: include.handle(),
            source: SOURCE,
            analyse: analyseException,
          }),
          'update include',
        );
        const handle = include.handle();
        expectResult(await include.unlock(), 'unlock include');
        // B3-fugr-v1 a2-5-include-source-lock, -update, -unlock.
        const [, put, unlocked] = expectSent(recorder, mark, [
          [`POST ${includeUri} LOCK`, 200],
          [`PUT ${includeUri}/source/main`, 200],
          [`POST ${includeUri} UNLOCK`, 200],
        ]);
        expect(queryOf(put, 'lockHandle') === handle).toBe(true);
        expect(queryOf(unlocked, 'lockHandle') === handle).toBe(true);

        mark = at();
        expectResult(
          await include.handler.activate(includeConfig, {
            headers: integrationHeadersOf(include.handler, 'activate'),
            analyse: judged(analyseActivation),
          }),
          'activate include',
        );
        // B3-fugr-v1 a2-6-activate-include.
        expectSent(recorder, mark, [['POST /sap/bc/adt/activation', 200]]);

        mark = at();
        const read = expectResult(
          await include.handler.read(includeConfig, 'active', {
            analyse: analyseException,
          }),
          'read include (active)',
        );
        // Not measured on an include this run wrote (B2 s5-finc-read: a
        // system include, 200) — Task 6.
        const [get] = expectSent(recorder, mark, [
          [`GET ${includeUri}/source/main`, 200],
        ]);
        expect(queryOf(get, 'version')).toBe('active');
        expect(String(read)).toContain(SOURCE);

        mark = at();
        const metadata = expectResult(
          await include.handler.readMetadata(includeConfig, {
            analyse: analyseException,
          }),
          'readMetadata include',
        );
        // Not measured on an existing include (B3-fugr-v1 a2-9-include-read:
        // 404 once its group was deleted) — Task 6.
        expectSent(recorder, mark, [[`GET ${includeUri}`, 200]]);
        expect(String(metadata).toUpperCase()).toContain(`"${includeName}"`);

        mark = at();
        expectResult(
          await include.handler.check(
            { ...includeConfig, source: SOURCE },
            'active',
            {
              headers: integrationHeadersOf(include.handler, 'check'),
              analyse: judged(analyseCheck),
            },
          ),
          'check include',
        );
        // Not measured — Task 6.
        expectSent(recorder, mark, [['POST /sap/bc/adt/checkruns', 200]]);

        mark = at();
        expectResult(await group.lock(), 'lock group for delete');
        const groupHandle = group.handle();
        expectResult(
          await group.handler.delete(groupConfig, {
            headers: integrationHeadersOf(group.handler, 'delete'),
            lockHandle: groupHandle,
            analyse: judged(analyseDeletion),
          }),
          'delete group',
        );
        expectResult(await group.unlock(), 'unlock group after delete');
        // B3-fugr-v1 a2-9-fugr-lock, -delete, -unlock.
        const [, deleted] = expectSent(recorder, mark, [
          [`POST ${groupUri} LOCK`, 200],
          [`DELETE ${groupUri}`, 200],
          [`POST ${groupUri} UNLOCK`, 200],
        ]);
        expect(queryOf(deleted, 'lockHandle') === groupHandle).toBe(true);

        mark = at();
        const groupGone = expectFailure(
          await group.handler.readMetadata(groupConfig, {
            analyse: analyseException,
          }),
          'read group after delete',
        );
        const includeGone = expectFailure(
          await include.handler.readMetadata(includeConfig, {
            analyse: analyseException,
          }),
          'read include after the group was deleted',
        );
        // B3-fugr-v1 a2-9-fugr-read, a2-9-include-read: 404 both.
        expect(groupGone.response?.status).toBe(404);
        expect(includeGone.response?.status).toBe(404);
        expectSent(recorder, mark, [
          [`GET ${groupUri}`, 404],
          [`GET ${includeUri}`, 404],
        ]);
      });
    }, 900000);
  });
});

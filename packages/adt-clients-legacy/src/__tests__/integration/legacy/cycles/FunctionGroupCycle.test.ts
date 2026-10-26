/**
 * The function group and function module cycle on SAP_BASIS 7.40 SP04 over
 * RFC (spec §4).
 *
 * Group: validate (name free) → create → activate → check. Module: validate
 * (name free) → create → lock → update (a plain body) → unlock → activate →
 * read → readMetadata → check → getVersions → getVersionSource → validate →
 * lock → delete → unlock → read `404`. Then the group: lock → delete →
 * unlock → read `404`. Every step asserts the requests it sent, their
 * statuses and its effect read back; the record of each answer is
 * B4-cycles-20261026-2019 (g0–g9, f1–f9, r2-f*), with these not measured
 * there and measured by Task 6 here:
 * - the group's and the module's `validate` of a name that does not exist
 *   (B4 g7 and f7 asked of existing names: `200`);
 * - the group's activation before it holds a module (B4 activated the group
 *   after the module);
 * - the module's readMetadata (B2-reads-20261023-1749 s3-fm-meta read a
 *   system module: `200`).
 *
 * A function module's source on 7.40 is a plain `FUNCTION … ENDFUNCTION`
 * body: a parameter comment block is refused (`500`, B4 f2-update).
 *
 * Both objects are created by this run in `$TMP` (no transport) and deleted
 * by it — by its last steps, or by the cleanup (module before group) when a
 * step failed; nothing this run did not create is touched.
 *
 * Runs on a legacy configuration over RFC with case
 * `legacy_740/legacy_cycle_function_group` enabled:
 * npm run test:live -- integration/legacy/cycles/FunctionGroupCycle
 */

import { functionModuleDocuments } from '@mcp-abap-adt/adt-clients';
import {
  analyseActivation,
  analyseCheck,
  analyseDeletion,
  analyseException,
  objectVersions,
} from '@mcp-abap-adt/adt-strategies';
import type {
  IFunctionGroupConfig,
  IFunctionModuleConfig,
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

const CASE = 'legacy_cycle_function_group';
const DESCRIPTION = 'legacy live cycle: function group';
const VALIDATION = 'POST /sap/bc/adt/functions/validation';

describeLegacyRfc(
  'Legacy 7.40 SP04 over RFC — function group and module cycle',
  () => {
    withLegacyCase(CASE, (params) => {
      let session: LegacySession | undefined;

      beforeAll(async () => {
        session = await openLegacySession();
      }, 120000);

      afterAll(async () => {
        await closeLegacySession(session);
      });

      it('creates a group and a module in it, runs the module through its cycle, deletes both', async () => {
        const { client, recorder } = session as LegacySession;
        const groupName = param(params, 'function_group_name');
        const moduleName = param(params, 'function_module_name');
        requireOwnNames(CASE, [
          ['function group', groupName],
          ['function module', moduleName],
        ]);
        const groupConfig: IFunctionGroupConfig = {
          functionGroupName: groupName,
        };
        const moduleConfig: IFunctionModuleConfig = {
          functionGroupName: groupName,
          functionModuleName: moduleName,
        };
        const groupUri = `/sap/bc/adt/functions/groups/${groupName.toLowerCase()}`;
        const moduleUri = `${groupUri}/fmodules/${moduleName.toLowerCase()}`;
        const source = [
          `FUNCTION ${moduleName.toLowerCase()}.`,
          '  DATA lv_legacy_cycle TYPE i.',
          '  lv_legacy_cycle = 1.',
          'ENDFUNCTION.',
        ].join('\n');
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
        const module = cycleObject({
          caseName: CASE,
          label: 'function module',
          name: moduleName,
          config: moduleConfig,
          handler: () => client.getFunctionModule(),
          validateConfig: { ...moduleConfig, description: DESCRIPTION },
        });
        const at = () => recorder.requests.length;

        await runCycle(CASE, [module, group], async () => {
          // --- the group ---
          let mark = at();
          await group.requireFree();
          // validate of a free name: not measured (B4 g7-validate, an
          // existing name: 200) — Task 6; B4 g0-absent (404).
          expectSent(recorder, mark, [
            [VALIDATION, 200],
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
          // B4 g1-create: 200.
          expectSent(recorder, mark, [
            ['POST /sap/bc/adt/functions/groups', 200],
          ]);

          mark = at();
          expectResult(
            await group.handler.activate(groupConfig, {
              headers: integrationHeadersOf(group.handler, 'activate'),
              analyse: judged(analyseActivation),
            }),
            'activate group',
          );
          // B4 g3-activate (there after the module; an empty group: Task 6).
          expectSent(recorder, mark, [['POST /sap/bc/adt/activation', 200]]);

          mark = at();
          expectResult(
            await group.handler.check(groupConfig, 'active', {
              headers: integrationHeadersOf(group.handler, 'check'),
              analyse: judged(analyseCheck),
            }),
            'check group',
          );
          // B4 g4-check.
          expectSent(recorder, mark, [['POST /sap/bc/adt/checkruns', 200]]);

          // --- the module ---
          mark = at();
          await module.requireFree();
          // validate of a free name: not measured (B4 f7-validate, an
          // existing name: 200) — Task 6; absent: B3-fugr-v1 a2-2-read-fm
          // (404).
          expectSent(recorder, mark, [
            [VALIDATION, 200],
            [`GET ${moduleUri}`, 404],
          ]);

          mark = at();
          expectResult(
            await module.createOwned(() =>
              module.handler.create(
                {
                  functionGroupName: groupName,
                  functionModuleName: moduleName,
                  description: DESCRIPTION,
                },
                {
                  headers: integrationHeadersOf(module.handler, 'create'),
                  analyse: analyseException,
                },
              ),
            ),
            'create module',
          );
          // B4 f1-create: 201.
          expectSent(recorder, mark, [[`POST ${groupUri}/fmodules`, 201]]);

          mark = at();
          expectResult(await module.lock(), 'lock module');
          // B4 f2-lock.
          expectSent(recorder, mark, [[`POST ${moduleUri} LOCK`, 200]]);

          mark = at();
          expectResult(
            await module.handler.update(moduleConfig, {
              headers: integrationHeadersOf(module.handler, 'update'),
              lockHandle: module.handle(),
              source,
              analyse: analyseException,
            }),
            'update module',
          );
          // B4 r2-f2-update (a plain body).
          const [put] = expectSent(recorder, mark, [
            [`PUT ${moduleUri}/source/main`, 200],
          ]);
          expect(queryOf(put, 'lockHandle') === module.handle()).toBe(true);

          mark = at();
          expectResult(await module.unlock(), 'unlock module');
          // B4 f2-unlock.
          expectSent(recorder, mark, [[`POST ${moduleUri} UNLOCK`, 200]]);

          mark = at();
          expectResult(
            await module.handler.activate(moduleConfig, {
              headers: integrationHeadersOf(module.handler, 'activate'),
              analyse: judged(analyseActivation),
            }),
            'activate module',
          );
          // B4 f3-activate.
          expectSent(recorder, mark, [['POST /sap/bc/adt/activation', 200]]);

          mark = at();
          const read = expectResult(
            await module.handler.read(moduleConfig, 'active', {
              analyse: analyseException,
            }),
            'read module (active)',
          );
          // B4 r2-f3b-read.
          const [get] = expectSent(recorder, mark, [
            [`GET ${moduleUri}/source/main`, 200],
          ]);
          expect(queryOf(get, 'version')).toBe('active');
          expect(String(read)).toContain('lv_legacy_cycle = 1.');

          mark = at();
          const metadata = expectResult(
            await module.handler.readMetadata(moduleConfig, {
              analyse: analyseException,
            }),
            'readMetadata module',
          );
          // Not measured on a module this run wrote (B2 s3-fm-meta: a system
          // module, 200) — Task 6.
          expectSent(recorder, mark, [[`GET ${moduleUri}`, 200]]);
          expect(String(metadata).toUpperCase()).toContain(`"${moduleName}"`);

          mark = at();
          expectResult(
            await module.handler.check(moduleConfig, 'active', {
              headers: integrationHeadersOf(module.handler, 'check'),
              analyse: judged(analyseCheck),
            }),
            'check module',
          );
          // B4 r2-f4-check.
          expectSent(recorder, mark, [['POST /sap/bc/adt/checkruns', 200]]);

          const versioned = client.getFunctionModule({
            ...functionModuleDocuments,
            versions: objectVersions,
          });
          mark = at();
          const versions = expectResult(
            await versioned.getVersions(moduleConfig, {
              analyse: analyseException,
            }),
            'getVersions module',
          );
          // B4 r2-f5-getVersions.
          expectSent(recorder, mark, [
            [`GET ${moduleUri}/source/main/versions`, 200],
          ]);
          expect(versions.length).toBeGreaterThan(0);
          const contentUri = versions[0]?.contentUri ?? '';
          expect(contentUri).toContain(`${moduleUri}/source/main/versions/`);

          mark = at();
          const versionSource = expectResult(
            await versioned.getVersionSource(contentUri, {
              analyse: analyseException,
            }),
            'getVersionSource module',
          );
          // B4 r2-f6-getVersionSource.
          expectSent(recorder, mark, [
            [`GET ${contentUri.split('?')[0]}`, 200],
          ]);
          expect(String(versionSource)).toContain('lv_legacy_cycle');

          mark = at();
          expectResult(
            await module.handler.validate(
              { ...moduleConfig, description: DESCRIPTION },
              { analyse: analyseException },
            ),
            'validate the existing module',
          );
          // B4 r2-f7-validate: an existing module's name answers 200.
          expectSent(recorder, mark, [[VALIDATION, 200]]);

          mark = at();
          expectResult(await module.lock(), 'lock module for delete');
          const moduleHandle = module.handle();
          expectResult(
            await module.handler.delete(moduleConfig, {
              headers: integrationHeadersOf(module.handler, 'delete'),
              lockHandle: moduleHandle,
              analyse: judged(analyseDeletion),
            }),
            'delete module',
          );
          expectResult(await module.unlock(), 'unlock module after delete');
          // B4 r2-f9-del-lock, r2-f9-delete, r2-f9-del-unlock.
          const [, moduleDeleted] = expectSent(recorder, mark, [
            [`POST ${moduleUri} LOCK`, 200],
            [`DELETE ${moduleUri}`, 200],
            [`POST ${moduleUri} UNLOCK`, 200],
          ]);
          expect(queryOf(moduleDeleted, 'lockHandle') === moduleHandle).toBe(
            true,
          );

          mark = at();
          const moduleGone = expectFailure(
            await module.handler.readMetadata(moduleConfig, {
              analyse: analyseException,
            }),
            'read module after delete',
          );
          // B4 r2-f9-read404.
          expect(moduleGone.response?.status).toBe(404);
          expectSent(recorder, mark, [[`GET ${moduleUri}`, 404]]);

          // --- the group, removed ---
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
          // B4 r2-g9-del-lock, r2-g9-delete, r2-g9-del-unlock.
          const [, groupDeleted] = expectSent(recorder, mark, [
            [`POST ${groupUri} LOCK`, 200],
            [`DELETE ${groupUri}`, 200],
            [`POST ${groupUri} UNLOCK`, 200],
          ]);
          expect(queryOf(groupDeleted, 'lockHandle') === groupHandle).toBe(
            true,
          );

          mark = at();
          const groupGone = expectFailure(
            await group.handler.readMetadata(groupConfig, {
              analyse: analyseException,
            }),
            'read group after delete',
          );
          // B4 r2-g9-read404.
          expect(groupGone.response?.status).toBe(404);
          expectSent(recorder, mark, [[`GET ${groupUri}`, 404]]);
        });
      }, 900000);
    });
  },
);

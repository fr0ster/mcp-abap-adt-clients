/**
 * The class cycle on SAP_BASIS 7.40 SP04 over RFC (spec §4).
 *
 * validate (name free) → create → lock → update main + types + definitions +
 * macros + testclasses → unlock → activate → read main and each include
 * (active) → readMetadata (the unversioned Accept) → check main and each
 * include (with its source) → getVersions + getVersionSource of main and
 * each include → `readTransport` refused → lock → delete → unlock → read
 * `404`. Every step asserts the requests it sent, their statuses and its
 * effect read back; the record of each answer is B4-cycles-20261026-2019
 * (c0–c8, r2-c4-check-*, r3-class-validate), the class metadata Accept is
 * class-metadata-accept-2026-10-26. The reads of main and the includes of a
 * class this run wrote are not in B4 (B2-reads-20261023-1749 s7, s8 read a
 * system class) — Task 6 measures them here. The local includes'
 * `readTransport` is not measured on 7.40 and not asserted here.
 *
 * The local includes have no lock of their own: every write carries the
 * class's handle. The class is created by this run in `$TMP` (no transport)
 * and deleted by it — by its last steps, or by the cleanup when a step
 * failed; nothing this run did not create is touched.
 *
 * Runs on a legacy configuration over RFC with case
 * `legacy_740/legacy_cycle_class` enabled:
 * npm run test:live -- integration/legacy/cycles/ClassCycle
 */

import { classDocuments } from '@mcp-abap-adt/adt-clients';
import {
  analyseActivation,
  analyseCheck,
  analyseDeletion,
  analyseException,
  objectVersions,
} from '@mcp-abap-adt/adt-strategies';
import type { IClassConfig } from '@mcp-abap-adt/interfaces-adt';
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

const CASE = 'legacy_cycle_class';
const DESCRIPTION = 'legacy live cycle: class';

/**
 * The class metadata Accept 7.40 SP04 answers: only the unversioned type;
 * every list naming a version answers `400 ExceptionContentHandlerNotFound`
 * (class-metadata-accept-2026-10-26). Passed as a consumer passes it; the
 * class's `readMetadata` sends the caller's `accept` as given, its content
 * types' class Accept only when the caller gives none.
 */
const CLASS_METADATA = 'application/vnd.sap.adt.oo.classes+xml';

describeLegacyRfc('Legacy 7.40 SP04 over RFC — class cycle', () => {
  withLegacyCase(CASE, (params) => {
    let session: LegacySession | undefined;

    beforeAll(async () => {
      session = await openLegacySession();
    }, 120000);

    afterAll(async () => {
      await closeLegacySession(session);
    });

    it('creates a class, writes main and its four local includes, activates, reads, checks, lists versions and deletes it', async () => {
      const { client, recorder } = session as LegacySession;
      const name = param(params, 'class_name');
      requireOwnNames(CASE, [['class', name]]);
      const lower = name.toLowerCase();
      const config: IClassConfig = { className: name };
      const uri = `/sap/bc/adt/oo/classes/${lower}`;
      const mainSource = [
        `CLASS ${lower} DEFINITION PUBLIC FINAL CREATE PUBLIC.`,
        '  PUBLIC SECTION.',
        '    METHODS run RETURNING VALUE(result) TYPE i.',
        'ENDCLASS.',
        '',
        `CLASS ${lower} IMPLEMENTATION.`,
        '  METHOD run.',
        '    result = 1.',
        '  ENDMETHOD.',
        'ENDCLASS.',
      ].join('\n');
      const cls = cycleObject({
        caseName: CASE,
        label: 'class',
        name,
        config,
        handler: () => client.getClass(),
        validateConfig: {
          ...config,
          packageName: LOCAL_PACKAGE,
          description: DESCRIPTION,
        },
      });
      /** The four local includes: each one's handler, its path, its source. */
      const includes = [
        {
          label: 'types',
          path: 'implementations',
          handler: () =>
            client.getLocalTypes({
              ...classDocuments,
              versions: objectVersions,
            }),
        },
        {
          label: 'definitions',
          path: 'definitions',
          handler: () =>
            client.getLocalDefinitions({
              ...classDocuments,
              versions: objectVersions,
            }),
        },
        {
          label: 'macros',
          path: 'macros',
          handler: () =>
            client.getLocalMacros({
              ...classDocuments,
              versions: objectVersions,
            }),
        },
        {
          label: 'testclasses',
          path: 'testclasses',
          handler: () =>
            client.getLocalTestClass({
              ...classDocuments,
              versions: objectVersions,
            }),
        },
      ].map((include) => ({
        ...include,
        source: `* ${include.label}: written by the legacy live cycle over RFC.`,
      }));
      const at = () => recorder.requests.length;

      await runCycle(CASE, [cls], async () => {
        let mark = at();
        await cls.requireFree();
        // B4 r3-class-validate (200, a free name), c0-absent (404).
        expectSent(recorder, mark, [
          ['POST /sap/bc/adt/oo/validation/objectname', 200],
          [`GET ${uri}`, 404],
        ]);

        mark = at();
        expectResult(
          await cls.createOwned(() =>
            cls.handler.create(
              {
                className: name,
                packageName: LOCAL_PACKAGE,
                description: DESCRIPTION,
              },
              {
                headers: integrationHeadersOf(cls.handler, 'create'),
                analyse: analyseException,
              },
            ),
          ),
          'create',
        );
        // B4 c1-create: 200.
        expectSent(recorder, mark, [['POST /sap/bc/adt/oo/classes', 200]]);

        mark = at();
        expectResult(await cls.lock(), 'lock');
        // B4 c2-lock.
        expectSent(recorder, mark, [[`POST ${uri} LOCK`, 200]]);
        const handle = cls.handle();

        mark = at();
        expectResult(
          await cls.handler.update(config, {
            headers: integrationHeadersOf(cls.handler, 'update'),
            lockHandle: handle,
            source: mainSource,
            analyse: analyseException,
          }),
          'update main',
        );
        for (const include of includes) {
          const handler = include.handler();
          expectResult(
            await handler.update(
              { className: name },
              {
                headers: integrationHeadersOf(handler, 'update'),
                lockHandle: handle,
                source: include.source,
                analyse: analyseException,
              },
            ),
            `update ${include.label}`,
          );
        }
        // B4 c2-update-main, -types, -definitions, -macros, -testclasses:
        // every write under the class's handle.
        const writes = expectSent(recorder, mark, [
          [`PUT ${uri}/source/main`, 200],
          ...includes.map(
            (include) => [`PUT ${uri}/includes/${include.path}`, 200] as const,
          ),
        ]);
        for (const write of writes)
          expect(queryOf(write, 'lockHandle')).toBe(handle);

        mark = at();
        expectResult(await cls.unlock(), 'unlock');
        // B4 c2-unlock.
        expectSent(recorder, mark, [[`POST ${uri} UNLOCK`, 200]]);

        mark = at();
        expectResult(
          await cls.handler.activate(config, {
            headers: integrationHeadersOf(cls.handler, 'activate'),
            analyse: judged(analyseActivation),
          }),
          'activate',
        );
        // B4 c3-activate.
        expectSent(recorder, mark, [['POST /sap/bc/adt/activation', 200]]);

        mark = at();
        const main = expectResult(
          await cls.handler.read(config, 'active', {
            analyse: analyseException,
          }),
          'read main (active)',
        );
        expect(String(main)).toContain('METHODS run RETURNING VALUE(result)');
        for (const include of includes) {
          expect(
            String(
              expectResult(
                await include.handler().read({ className: name }, 'active', {
                  analyse: analyseException,
                }),
                `read ${include.label} (active)`,
              ),
            ),
          ).toContain(include.source);
        }
        // Not measured on a class this run wrote (B2 s8-class-read, s7-*: a
        // system class, 200) — Task 6.
        const reads = expectSent(recorder, mark, [
          [`GET ${uri}/source/main`, 200],
          ...includes.map(
            (include) => [`GET ${uri}/includes/${include.path}`, 200] as const,
          ),
        ]);
        for (const read of reads)
          expect(queryOf(read, 'version')).toBe('active');

        mark = at();
        const metadata = expectResult(
          await cls.handler.readMetadata(config, {
            accept: CLASS_METADATA,
            analyse: analyseException,
          }),
          'readMetadata',
        );
        // class-metadata-accept-2026-10-26: the unversioned Accept, 200.
        const [metadataRead] = expectSent(recorder, mark, [
          [`GET ${uri}`, 200],
        ]);
        expect(headerOf(metadataRead, 'Accept')).toBe(CLASS_METADATA);
        expect(String(metadata).toUpperCase()).toContain(`"${name}"`);

        mark = at();
        expectResult(
          await cls.handler.check(config, 'active', {
            headers: integrationHeadersOf(cls.handler, 'check'),
            analyse: judged(analyseCheck),
          }),
          'check main',
        );
        for (const include of includes) {
          const handler = include.handler();
          expectResult(
            await handler.check(
              { className: name, source: include.source },
              'active',
              {
                headers: integrationHeadersOf(handler, 'check'),
                analyse: judged(analyseCheck),
              },
            ),
            `check ${include.label}`,
          );
        }
        // B4 c4-check-main, r2-c4-check-types, -definitions, -macros,
        // -testclasses (with the include's source).
        expectSent(recorder, mark, [
          ['POST /sap/bc/adt/checkruns', 200],
          ...includes.map(() => ['POST /sap/bc/adt/checkruns', 200] as const),
        ]);

        const versionedClass = client.getClass({
          ...classDocuments,
          versions: objectVersions,
        });
        const histories = [
          {
            label: 'main',
            path: 'main',
            list: () =>
              versionedClass.getVersions(config, { analyse: analyseException }),
            fetch: (contentUri: string) =>
              versionedClass.getVersionSource(contentUri, {
                analyse: analyseException,
              }),
            marker: 'METHODS run RETURNING VALUE(result)',
          },
          ...includes.map((include) => ({
            label: include.label,
            path: include.path,
            list: () =>
              include
                .handler()
                .getVersions(
                  { className: name },
                  { analyse: analyseException },
                ),
            fetch: (contentUri: string) =>
              include
                .handler()
                .getVersionSource(contentUri, { analyse: analyseException }),
            marker: include.source,
          })),
        ];
        for (const history of histories) {
          mark = at();
          const versions = expectResult(
            await history.list(),
            `getVersions ${history.label}`,
          );
          // B4 c5-versions-<include>.
          expectSent(recorder, mark, [
            [`GET ${uri}/includes/${history.path}/versions`, 200],
          ]);
          expect(versions.length).toBeGreaterThan(0);
          const contentUri = versions[0]?.contentUri ?? '';
          expect(contentUri).toContain(
            `${uri}/includes/${history.path}/versions/`,
          );

          mark = at();
          const versionSource = expectResult(
            await history.fetch(contentUri),
            `getVersionSource ${history.label}`,
          );
          // B4 c5b-versionSource-<include>.
          expectSent(recorder, mark, [
            [`GET ${contentUri.split('?')[0]}`, 200],
          ]);
          expect(String(versionSource)).toContain(history.marker);
        }

        mark = at();
        // B4 c6-readTransport: 404 for every type — refused, nothing sent.
        expectRefusedUnsent(
          await cls.handler.readTransport(config, {
            analyse: analyseException,
          }),
          recorder,
          mark,
        );

        mark = at();
        expectResult(await cls.lock(), 'lock for delete');
        const deleteHandle = cls.handle();
        expectResult(
          await cls.handler.delete(config, {
            headers: integrationHeadersOf(cls.handler, 'delete'),
            lockHandle: deleteHandle,
            analyse: judged(analyseDeletion),
          }),
          'delete',
        );
        expectResult(await cls.unlock(), 'unlock after delete');
        // B4 c8-del-lock, c8-delete, c8-del-unlock.
        const [, deleted] = expectSent(recorder, mark, [
          [`POST ${uri} LOCK`, 200],
          [`DELETE ${uri}`, 200],
          [`POST ${uri} UNLOCK`, 200],
        ]);
        expect(queryOf(deleted, 'lockHandle')).toBe(deleteHandle);

        mark = at();
        const gone = expectFailure(
          await cls.handler.readMetadata(config, {
            accept: CLASS_METADATA,
            analyse: analyseException,
          }),
          'read after delete',
        );
        // B4 c8-read404.
        expect(gone.response?.status).toBe(404);
        expectSent(recorder, mark, [[`GET ${uri}`, 404]]);
      });
    }, 900000);
  });
});

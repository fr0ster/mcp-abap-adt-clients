/**
 * The six legacy deletes on SAP_BASIS 7.40 SP04 over RFC (spec §4, §11.2).
 *
 * Measured: `LOCK` → `DELETE <object>?lockHandle=` → `UNLOCK` deletes a class,
 * a program, an interface, a function group, a function module and a DDL
 * source, and the read afterwards answers `404`; without a handle the DELETE
 * answers `400` for the first four. This re-asserts both on the wire the
 * recorder saw: the handle-less DELETE is one request with no `lockHandle`,
 * the locked one carries the handle the `lock` returned.
 *
 * Every object is created in `$TMP` (no transport). A configured name that
 * already exists fails the run before anything is created, and nothing is
 * deleted that this run did not create: `afterAll` removes, module before
 * group, only what was created here and is still there, attempts every one,
 * and names every object it left behind.
 *
 * Runs on a legacy configuration over RFC with case `legacy_740/legacy_deletes`
 * enabled: npm run test:detached -- integration/legacy/LegacyDelete
 */

import { analyseException } from '@mcp-abap-adt/adt-strategies';
import type { IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import { integrationHeadersOf } from '../../../../../adt-clients/src/__tests__/helpers/adtHeaders';
import {
  expectFailure,
  expectResult,
} from '../../../../../adt-clients/src/__tests__/helpers/contract';
import { requireOwnNames } from '../../helpers/legacyEnv';
import {
  type CaseParams,
  closeLegacySession,
  deleteLocked,
  type LegacyDeletable,
  type LegacyObject,
  type LegacySession,
  LOCAL_PACKAGE,
  lineOf,
  openLegacySession,
  param,
  queryOf,
  removeCreated,
  requireAbsent,
  sentSince,
  stepOf,
  withLegacyCase,
} from '../../helpers/legacyLive';
import { describeLegacyRfc } from '../../helpers/legacyRfc';

const DESCRIPTION = 'legacy live check: delete';

/** One type: the object, and `make`, which creates it. */
interface Subject extends LegacyObject {
  readonly make: () => Promise<IAdtResponse<unknown>>;
  /** SAP answers a DELETE without a handle with `400` (measured). */
  readonly refusesWithoutHandle: boolean;
}

function subjects(session: () => LegacySession, params: CaseParams) {
  const client = () => session().client;
  const cls = { className: param(params, 'class_name') };
  const prog = { programName: param(params, 'program_name') };
  const intf = { interfaceName: param(params, 'interface_name') };
  const group = { functionGroupName: param(params, 'function_group_name') };
  const module = {
    ...group,
    functionModuleName: param(params, 'function_module_name'),
  };
  const ddl = { ddlName: param(params, 'ddl_name') };
  const local = { packageName: LOCAL_PACKAGE, description: DESCRIPTION };
  const as = (h: unknown) => h as LegacyDeletable<object>;

  // Created in this order; deleted module before group.
  const list: Subject[] = [
    {
      label: 'class',
      handler: () => as(client().getClass()),
      config: cls,
      name: cls.className,
      make: () =>
        client()
          .getClass()
          .create(
            { ...cls, ...local },
            {
              headers: integrationHeadersOf(client().getClass(), 'create'),
              analyse: analyseException,
            },
          ),
      refusesWithoutHandle: true,
    },
    {
      label: 'program',
      handler: () => as(client().getProgram()),
      config: prog,
      name: prog.programName,
      make: () =>
        client()
          .getProgram()
          .create(
            { ...prog, ...local },
            {
              headers: integrationHeadersOf(client().getProgram(), 'create'),
              analyse: analyseException,
            },
          ),
      refusesWithoutHandle: true,
    },
    {
      label: 'interface',
      handler: () => as(client().getInterface()),
      config: intf,
      name: intf.interfaceName,
      make: () =>
        client()
          .getInterface()
          .create(
            { ...intf, ...local },
            {
              headers: integrationHeadersOf(client().getInterface(), 'create'),
              analyse: analyseException,
            },
          ),
      refusesWithoutHandle: true,
    },
    {
      label: 'function group',
      handler: () => as(client().getFunctionGroup()),
      config: group,
      name: group.functionGroupName,
      make: () =>
        client()
          .getFunctionGroup()
          .create(
            { ...group, ...local },
            {
              headers: integrationHeadersOf(
                client().getFunctionGroup(),
                'create',
              ),
              analyse: analyseException,
            },
          ),
      refusesWithoutHandle: true,
    },
    {
      label: 'function module',
      handler: () => as(client().getFunctionModule()),
      config: module,
      name: module.functionModuleName,
      make: () =>
        client()
          .getFunctionModule()
          .create(
            { ...module, description: DESCRIPTION },
            {
              headers: integrationHeadersOf(
                client().getFunctionModule(),
                'create',
              ),
              analyse: analyseException,
            },
          ),
      refusesWithoutHandle: false,
    },
    {
      label: 'DDL source',
      handler: () => as(client().getDdl()),
      config: ddl,
      name: ddl.ddlName,
      make: () =>
        client()
          .getDdl()
          .create(
            { ...ddl, ...local },
            {
              headers: integrationHeadersOf(client().getDdl(), 'create'),
              analyse: analyseException,
            },
          ),
      refusesWithoutHandle: false,
    },
  ];
  const byLabel = (label: string) =>
    list.find((s) => s.label === label) as Subject;
  const deletionOrder = [
    'class',
    'program',
    'interface',
    'DDL source',
    'function module',
    'function group',
  ].map(byLabel);
  return { creationOrder: list, deletionOrder };
}

describeLegacyRfc('Legacy 7.40 SP04 over RFC — delete', () => {
  withLegacyCase('legacy_deletes', (params) => {
    let session: LegacySession | undefined;
    const current = () => session as LegacySession;
    const { creationOrder, deletionOrder } = subjects(current, params);

    /** Created by this run: the only objects it may delete. */
    const created = new Set<Subject>();

    beforeAll(async () => {
      requireOwnNames('legacy_deletes', [
        ['class', param(params, 'class_name')],
        ['program', param(params, 'program_name')],
        ['interface', param(params, 'interface_name')],
        ['function group', param(params, 'function_group_name')],
        ['function module', param(params, 'function_module_name')],
        ['DDL source', param(params, 'ddl_name')],
      ]);
      session = await openLegacySession();
      await requireAbsent('legacy_deletes', creationOrder);
      for (const s of creationOrder) {
        expectResult(await s.make(), `create ${s.label} ${s.name}`);
        created.add(s);
      }
    }, 600000);

    afterAll(async () => {
      try {
        if (session)
          await removeCreated(
            'legacy_deletes',
            deletionOrder.filter((s) => created.has(s)),
          );
      } finally {
        await closeLegacySession(session);
      }
    }, 600000);

    for (const s of creationOrder.filter((x) => x.refusesWithoutHandle)) {
      it(`a ${s.label} delete without a lock handle answers 400 and deletes nothing`, async () => {
        const { recorder } = current();
        const mark = recorder.requests.length;

        const failure = expectFailure(
          await s.handler().delete(s.config, {
            headers: integrationHeadersOf(s.handler(), 'delete'),
            analyse: analyseException,
          }),
          `delete ${s.label} without a handle`,
        );

        expect(failure.response?.status).toBe(400);
        const sent = sentSince(recorder, mark);
        expect(sent.map(lineOf)).toEqual([expect.stringMatching(/^DELETE /)]);
        expect(queryOf(sent[0], 'lockHandle')).toBeUndefined();
        expectResult(
          await s.handler().readMetadata(s.config, {
            analyse: analyseException,
          }),
          `read ${s.label} after the refused delete`,
        );
      }, 120000);
    }

    for (const s of deletionOrder) {
      it(`a ${s.label}: lock, delete with the handle, unlock; the read answers 404`, async () => {
        const { recorder } = current();
        const mark = recorder.requests.length;

        expectResult(
          await deleteLocked(s.handler(), s.config, s.label),
          `delete ${s.label} with its lock handle`,
        );

        // LOCK, one DELETE carrying the handle, UNLOCK — each answered 200
        // (the UNLOCK after a successful delete too, as measured).
        const sent = sentSince(recorder, mark);
        expect(sent.map(stepOf)).toEqual(['LOCK', 'DELETE', 'UNLOCK']);
        // All three address the object itself.
        expect(
          new Set(sent.map((r) => r.url.split('?')[0].toLowerCase())).size,
        ).toBe(1);
        const [, deleted, unlocked] = sent;
        const handle = queryOf(deleted, 'lockHandle');
        expect(handle).toEqual(expect.any(String));
        expect(handle).not.toBe('');
        expect(handle).toBe(queryOf(unlocked, 'lockHandle'));
        expect(sent.map((r) => r.status)).toEqual([200, 200, 200]);

        const after = expectFailure(
          await s.handler().readMetadata(s.config, {
            analyse: analyseException,
          }),
          `read ${s.label} after the delete`,
        );
        expect(after.response?.status).toBe(404);
      }, 120000);
    }
  });
});

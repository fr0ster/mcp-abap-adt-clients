/**
 * The variant gates hold through the legacy overrides (review focus 2 of the
 * ADT type codes plan): `AdtClientLegacy` is `AdtClient<'basis740'>`, every
 * override keeps the base's gate, and the handlers it answers are fixed to
 * `'basis740'`. Each `@ts-expect-error` is a call ADT_TYPES_BASIS_740
 * refuses; `npm run test:check` fails when one compiles. The overrides still
 * refuse at run time, for callers outside the type system.
 *
 * Type-level: the checks sit in a function nothing calls.
 */
import type { AdtClient } from '@mcp-abap-adt/adt-clients';
import type { AdtClientLegacy } from '../../../clients/AdtClientLegacy';
import type { AdtExecutorLegacy } from '../../../clients/AdtExecutorLegacy';

async function legacyVariantGates(
  legacy: AdtClientLegacy,
  executor: AdtExecutorLegacy,
): Promise<void> {
  // The client is the 7.40 variant's.
  const asBase: AdtClient<'basis740'> = legacy;
  void asBase;
  // …and no modern one, so no upcast reopens the gates its overrides keep.
  // @ts-expect-error -- AdtClientLegacy is not AdtClient of the modern variant
  const asModern: AdtClient = legacy;
  void asModern;

  // A factory the variant lacks, through an override that refuses it.
  // @ts-expect-error -- ADT_TYPES_BASIS_740 serves no `table` API
  legacy.getTable();
  // @ts-expect-error -- ADT_TYPES_BASIS_740 serves no `package` API
  legacy.getPackage();
  legacy.getClass();

  // An operation the API lacks on 7.40, through the handler's override.
  await legacy.getClass().read({ className: 'ZCL_GATE' });
  // @ts-expect-error -- 7.40's `CLAS/OC` lists no `deletionCheck`
  await legacy.getClass().checkDeletion(
    { className: 'ZCL_GATE' },
    {
      headers: { accept: 'application/xml', contentType: 'application/xml' },
    },
  );
  // @ts-expect-error -- 7.40's `CLAS/OC` lists no `transport`
  await legacy.getClass().readTransport({ className: 'ZCL_GATE' });
  // @ts-expect-error -- 7.40's `DDLS/DF` lists no `versions`
  await legacy.getDdl().getVersions({ ddlName: 'ZI_GATE' });
  // @ts-expect-error -- 7.40's transport request lists no `createTask`
  await legacy.getRequest().createTask('TRKORR01', {
    headers: { accept: 'application/xml', contentType: 'application/xml' },
    targetUser: 'USER_GATE',
  });

  // The transport request's create, update and delete, which 7.40's table
  // does not list: the overrides keep the base's gates (review fix 5).
  // @ts-expect-error -- 7.40's transport request lists no `create`
  await legacy.getRequest().create();
  // @ts-expect-error -- 7.40's transport request lists no `updateMetadata`
  await legacy.getRequest().updateMetadata();
  // @ts-expect-error -- 7.40's transport request lists no `delete`
  await legacy.getRequest().delete();
  await legacy.getRequest().list({});

  // The function group's source: 7.40's `FUGR/F` lists `read`, `source` and
  // `update` (interfaces-adt 23.1.1, measured on 7.40 SP04), so the
  // inherited members compile on the legacy client.
  const group = { functionGroupName: 'ZFG_GATE' };
  await legacy.getFunctionGroup().read(group);
  await legacy.getFunctionGroup().read(group, 'inactive');
  await legacy.getFunctionGroup().update(group, {
    headers: { accept: 'text/plain', contentType: 'text/plain; charset=utf-8' },
    lockHandle: 'LOCK_GATE',
    source: '* gate',
  });

  // A function include is not deleted on 7.40 (review fix 8).
  const include = {
    functionGroupName: 'ZFG_GATE',
    includeName: 'LZFG_GATETOP',
  };
  const headers = { accept: 'application/xml', contentType: 'application/xml' };
  await legacy.getFunctionInclude().read(include);
  // @ts-expect-error -- 7.40's `FUGR/I` lists no `delete`
  await legacy.getFunctionInclude().delete(include, { headers });

  // The executors and the ABAP Unit runners (review fix 4): 7.40 runs and
  // profiles nothing, polls and fetches no run, and runs a function module's
  // tests only synchronously.
  const cls = { className: 'ZCL_GATE' };
  // @ts-expect-error -- 7.40's `CLAS/OC` lists no `run`
  await executor.getClassExecutor().run(cls);
  // @ts-expect-error -- 7.40's `CLAS/OC` lists no `profile`
  await executor.getClassExecutor().runWithProfiler(cls, { profilerId: 'P' });
  // @ts-expect-error -- 7.40's `PROG/P` lists no `run`
  await executor.getProgramExecutor().run({ programName: 'ZGATE' });
  await executor.getClassTestRunner().run('ZCL_GATE');
  // @ts-expect-error -- 7.40's `CLAS/OC` lists no `unitTestStatus`
  await executor.getClassTestRunner().getStatus();
  // @ts-expect-error -- 7.40's `PROG/P` lists no `unitTestResult`
  await executor.getProgramTestRunner().getResult();
  // @ts-expect-error -- 7.40's `FUGR/FF` lists no `unitTestRun`
  await executor.getFunctionModuleTestRunner().run();
  await executor.getFunctionModuleTestRunner().runSync({
    functionGroupName: 'ZFG_GATE',
    functionModuleName: 'Z_FM_GATE',
  });
  // The generic runner: 7.40 has no /abapunit/runs, so no target run, poll
  // or result; the URI run on /abapunit/testruns stays.
  // @ts-expect-error -- 7.40 has no /abapunit/runs
  await executor.getAbapUnitTestRunner().run();
  // @ts-expect-error -- 7.40 has no run to poll
  await executor.getAbapUnitTestRunner().getStatus();
  // @ts-expect-error -- 7.40 has no result to fetch
  await executor.getAbapUnitTestRunner().getResult();
  await executor
    .getAbapUnitTestRunner()
    .runSync(['/sap/bc/adt/oo/classes/zcl_gate'], { headers });

  // A missing parent, through the legacy function module.
  await legacy
    .getFunctionModule()
    .read({ functionGroupName: 'ZFG_GATE', functionModuleName: 'Z_FM_GATE' });
  // @ts-expect-error -- a function module's config names its group
  await legacy.getFunctionModule().read({ functionModuleName: 'Z_FM_GATE' });
}

it('the legacy variant gates are type-checked by npm run test:check', () => {
  expect(typeof legacyVariantGates).toBe('function');
});

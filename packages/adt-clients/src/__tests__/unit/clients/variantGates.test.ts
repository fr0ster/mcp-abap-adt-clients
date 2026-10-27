/**
 * A call the variant does not serve does not compile (review focus 2 of the
 * ADT type codes plan). Each `@ts-expect-error` is a call the ADT type tables
 * refuse for the receiver's variant; `npm run test:check` fails when one of
 * them compiles, and the call beside it that the tables serve must compile.
 * The legacy override's checks are in `adt-clients-legacy`.
 *
 * Type-level: the checks sit in a function nothing calls. The one runtime
 * assertion keeps Jest from reporting an empty file.
 */
import type { AdtApiWithIn, AdtOperation } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { AdtClient } from '../../../clients/AdtClient';
import type {
  AdtClientCloud,
  AdtClientOnPrem,
} from '../../../clients/AdtClientVariants';
import type { AdtExecutor } from '../../../clients/AdtExecutor';
import { createAdtClient } from '../../../clients/createAdtClient';
import type {
  AdtModernVariant,
  AdtPerformingVariantsIn,
  IAdtServedOn,
} from '../../../clients/variant';
import { buildObjectUri } from '../../../utils/activationUtils';

async function variantGates(
  onprem: AdtClientOnPrem,
  cloud: AdtClientCloud,
  modern: AdtClient,
  basis740: AdtClient<'basis740'>,
  connection: IAbapConnection,
  fromConfig: AdtModernVariant,
  executor: AdtExecutor,
  executor740: AdtExecutor<'basis740'>,
): Promise<void> {
  // The executors and runners are gated by `run`, `profile` and the unit-test
  // operations: the modern variant runs, profiles and polls…
  await executor.getClassExecutor().run({ className: 'ZCL_GATE' });
  await executor.getClassTestRunner().getStatus('RUN');
  await executor.getFunctionModuleTestRunner().run('Z_FM_GATE');
  // …and 7.40 does none of it.
  // @ts-expect-error -- ADT_TYPES_BASIS_740's `CLAS/OC` lists no `run`
  await executor740.getClassExecutor().run({ className: 'ZCL_GATE' });
  // @ts-expect-error -- ADT_TYPES_BASIS_740's `CLAS/OC` lists no `unitTestStatus`
  await executor740.getClassTestRunner().getStatus('RUN');
  // @ts-expect-error -- ADT_TYPES_BASIS_740's `FUGR/FF` lists no `unitTestRun`
  await executor740.getFunctionModuleTestRunner().run('Z_FM_GATE');

  // A factory the variant lacks: 7.40's table has no `table`.
  onprem.getTable();
  cloud.getTable();
  modern.getTable();
  // @ts-expect-error -- ADT_TYPES_BASIS_740 serves no `table` API
  basis740.getTable();
  // @ts-expect-error -- ADT_TYPES_BASIS_740 serves no `package` API
  basis740.getPackage();

  // An operation the API lacks: a function group has no source to read, and
  // a program include no check — on any variant.
  // @ts-expect-error -- `functionGroup` lists no `read`
  onprem.getFunctionGroup().read;
  // @ts-expect-error -- `include` lists no `check`
  onprem.getInclude().check;
  // …and one the API lacks on one variant: 7.40's `ddl` lists no `versions`.
  await onprem.getDdl().getVersions({ ddlName: 'ZI_GATE' });
  // @ts-expect-error -- ADT_TYPES_BASIS_740's `ddl` lists no `versions`
  await basis740.getDdl().getVersions({ ddlName: 'ZI_GATE' });

  // An operation one code of the API lacks: only `ENHO/XHH` reads source.
  await onprem
    .getEnhancement()
    .read({ enhancementName: 'ZENH_GATE', enhancementType: 'enhoxhh' });
  await onprem.getEnhancement().read({
    enhancementName: 'ZENH_GATE',
    // @ts-expect-error -- `ENHO/XHB` lists no `read`
    enhancementType: 'enhoxhb',
  });

  // A missing parent: a function module is addressed under its group.
  await onprem
    .getFunctionModule()
    .read({ functionGroupName: 'ZFG_GATE', functionModuleName: 'Z_FM_GATE' });
  // @ts-expect-error -- a function module's config names its group
  await onprem.getFunctionModule().read({ functionModuleName: 'Z_FM_GATE' });
  buildObjectUri('Z_FM_GATE', 'FUGR/FF', 'ZFG_GATE');
  // @ts-expect-error -- FUGR/FF is addressed under its parent
  buildObjectUri('Z_FM_GATE', 'FUGR/FF');

  // A 7.40 client is no modern one, so no upcast reopens a gate.
  // @ts-expect-error -- AdtClient<'basis740'> is not an AdtClient of the modern variant
  const upcast: AdtClient = basis740;
  void upcast;
  const narrowed: AdtClient = onprem;
  void narrowed;

  // `createAdtClient` answers the declared variant's client…
  const declared: AdtClientCloud = await createAdtClient(connection, {
    variant: 'cloud',
  });
  void declared;
  // …and, for a variant known only as modern, the default client.
  const configured: AdtClient = await createAdtClient(connection, {
    variant: fromConfig,
  });
  configured.getClass();
  // @ts-expect-error -- the default client is no 7.40 one
  const configuredAs740: AdtClient<'basis740'> = configured;
  void configuredAs740;

  // Both modern clients are the default client; the default is served what
  // both serve, and a generic modern client is held to the same.
  const both: AdtClient[] = [onprem, cloud];
  void both;
  const readsSource = <V extends AdtModernVariant>(client: AdtClient<V>) =>
    client.getClass().getVersions({ className: 'ZCL_GATE' });
  await readsSource(onprem);
  await readsSource(cloud);
  await readsSource(modern);
}

/**
 * The default variant's gates are the intersection of the two modern tables,
 * not their union. The real tables serve the same, so two synthetic ones show
 * it: `one` lists `check` for the class, `two` does not.
 */
interface ISyntheticCode<Ops extends readonly AdtOperation[]> {
  readonly parent: null;
  readonly nameMaxLength: 30;
  readonly operations: Ops;
  readonly evidence: 'system-description-synthetic--07-typestructure';
}
interface ISyntheticTables {
  one: {
    class: {
      kind: 'class';
      collection: '/sap/bc/adt/oo/classes';
      codes: { 'CLAS/OC': ISyntheticCode<readonly ['read', 'check']> };
    };
  };
  two: {
    class: {
      kind: 'class';
      collection: '/sap/bc/adt/oo/classes';
      codes: { 'CLAS/OC': ISyntheticCode<readonly ['read']> };
    };
  };
}

function intersection(
  ofBoth: IAdtServedOn<'one' | 'two'>,
  ofOne: IAdtServedOn<'one'>,
): void {
  const reads: IAdtServedOn<
    AdtPerformingVariantsIn<ISyntheticTables, 'class', 'read'>
  > = ofBoth;
  void reads;
  // @ts-expect-error -- `two` lists no `check`, so a receiver of both is refused
  const checksBoth: IAdtServedOn<
    AdtPerformingVariantsIn<ISyntheticTables, 'class', 'check'>
  > = ofBoth;
  void checksBoth;
  const checksOne: IAdtServedOn<
    AdtPerformingVariantsIn<ISyntheticTables, 'class', 'check'>
  > = ofOne;
  void checksOne;
  // interfaces-adt's own helper distributes over a union of tables: it would
  // answer `check` as served by both (listed for interfaces-adt 21.1.0).
  const distributes: AdtApiWithIn<
    ISyntheticTables['one'] | ISyntheticTables['two'],
    'check'
  > = 'class';
  void distributes;
}

it('the variant gates are type-checked by npm run test:check', () => {
  expect(typeof variantGates).toBe('function');
  expect(typeof intersection).toBe('function');
});

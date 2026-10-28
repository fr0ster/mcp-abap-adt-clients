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

  // A metadata write: on premise only for a program, on both modern variants
  // for the other four, and on no 7.40 client, whose table lists none.
  const write = {
    headers: { accept: 'a', contentType: 'c' },
    lockHandle: 'L',
    source: '<x/>',
  };
  const program = { programName: 'ZGATE' };
  await onprem.getProgram().updateMetadata(program, write);
  const cloudProgram = cloud.getProgram();
  // @ts-expect-error -- ADT_TYPES_CLOUD's `PROG/P` lists no `updateMetadata`
  await cloudProgram.updateMetadata(program, write);
  const modernProgram = modern.getProgram();
  // @ts-expect-error -- the default variant is served what both tables list
  await modernProgram.updateMetadata(program, write);
  const fm = { functionGroupName: 'ZFG_GATE', functionModuleName: 'Z_FM' };
  await modern.getClass().updateMetadata({ className: 'ZCL_GATE' }, write);
  await modern.getInterface().updateMetadata({ interfaceName: 'ZIF' }, write);
  await modern.getFunctionModule().updateMetadata(fm, write);
  await modern.getDdl().updateMetadata({ ddlName: 'ZI_GATE' }, write);
  // The function group's is gated too, and every table lists it.
  const group = { functionGroupName: 'ZFG_GATE' };
  await modern.getFunctionGroup().updateMetadata(group, write);
  await cloud.getFunctionGroup().updateMetadata(group, write);
  await basis740.getFunctionGroup().updateMetadata(group, write);
  const class740 = basis740.getClass();
  // @ts-expect-error -- ADT_TYPES_BASIS_740's `CLAS/OC` lists no updateMetadata
  await class740.updateMetadata({ className: 'ZCL_GATE' }, write);
  const interface740 = basis740.getInterface();
  // @ts-expect-error -- ADT_TYPES_BASIS_740's `INTF/OI` lists no updateMetadata
  await interface740.updateMetadata({ interfaceName: 'ZIF' }, write);
  const fm740 = basis740.getFunctionModule();
  // @ts-expect-error -- ADT_TYPES_BASIS_740's `FUGR/FF` lists no updateMetadata
  await fm740.updateMetadata(fm, write);
  const ddl740 = basis740.getDdl();
  // @ts-expect-error -- ADT_TYPES_BASIS_740's `DDLS/DF` lists no updateMetadata
  await ddl740.updateMetadata({ ddlName: 'ZI_GATE' }, write);

  // The second batch: the eight on both modern variants, the include on
  // premise only, none on 7.40 — and the append structure, which shares
  // `TABL/DS` with the structure and has no `updateMetadata` of its own.
  await onprem
    .getAccessControl()
    .updateMetadata({ accessControlName: 'ZGATE' }, write);
  await cloud
    .getAccessControl()
    .updateMetadata({ accessControlName: 'ZGATE' }, write);
  await modern
    .getAccessControl()
    .updateMetadata({ accessControlName: 'ZGATE' }, write);
  // @ts-expect-error -- ADT_TYPES_BASIS_740 serves no `accessControl`: the factory is refused, so no member is reached
  basis740.getAccessControl();
  await onprem.getMetadataExtension().updateMetadata({ name: 'ZGATE' }, write);
  await cloud.getMetadataExtension().updateMetadata({ name: 'ZGATE' }, write);
  await modern.getMetadataExtension().updateMetadata({ name: 'ZGATE' }, write);
  // @ts-expect-error -- ADT_TYPES_BASIS_740 serves no `metadataExtension`: the factory is refused, so no member is reached
  basis740.getMetadataExtension();
  await onprem.getBehaviorDefinition().updateMetadata({ name: 'ZGATE' }, write);
  await cloud.getBehaviorDefinition().updateMetadata({ name: 'ZGATE' }, write);
  await modern.getBehaviorDefinition().updateMetadata({ name: 'ZGATE' }, write);
  // @ts-expect-error -- ADT_TYPES_BASIS_740 serves no `behaviorDefinition`: the factory is refused, so no member is reached
  basis740.getBehaviorDefinition();
  await onprem
    .getServiceDefinition()
    .updateMetadata({ serviceDefinitionName: 'ZGATE' }, write);
  await cloud
    .getServiceDefinition()
    .updateMetadata({ serviceDefinitionName: 'ZGATE' }, write);
  await modern
    .getServiceDefinition()
    .updateMetadata({ serviceDefinitionName: 'ZGATE' }, write);
  // @ts-expect-error -- ADT_TYPES_BASIS_740 serves no `serviceDefinition`: the factory is refused, so no member is reached
  basis740.getServiceDefinition();
  await onprem
    .getScalarFunction()
    .updateMetadata({ scalarFunctionName: 'ZGATE' }, write);
  await cloud
    .getScalarFunction()
    .updateMetadata({ scalarFunctionName: 'ZGATE' }, write);
  await modern
    .getScalarFunction()
    .updateMetadata({ scalarFunctionName: 'ZGATE' }, write);
  // @ts-expect-error -- ADT_TYPES_BASIS_740 serves no `scalarFunction`: the factory is refused, so no member is reached
  basis740.getScalarFunction();
  await onprem
    .getTransformation()
    .updateMetadata({ transformationName: 'ZGATE' }, write);
  await cloud
    .getTransformation()
    .updateMetadata({ transformationName: 'ZGATE' }, write);
  await modern
    .getTransformation()
    .updateMetadata({ transformationName: 'ZGATE' }, write);
  // @ts-expect-error -- ADT_TYPES_BASIS_740 serves no `transformation`: the factory is refused, so no member is reached
  basis740.getTransformation();
  await onprem.getTable().updateMetadata({ tableName: 'ZGATE' }, write);
  await cloud.getTable().updateMetadata({ tableName: 'ZGATE' }, write);
  await modern.getTable().updateMetadata({ tableName: 'ZGATE' }, write);
  // @ts-expect-error -- ADT_TYPES_BASIS_740 serves no `table`: the factory is refused, so no member is reached
  basis740.getTable();
  await onprem.getStructure().updateMetadata({ structureName: 'ZGATE' }, write);
  await cloud.getStructure().updateMetadata({ structureName: 'ZGATE' }, write);
  await modern.getStructure().updateMetadata({ structureName: 'ZGATE' }, write);
  // @ts-expect-error -- ADT_TYPES_BASIS_740 serves no `structure`: the factory is refused, so no member is reached
  basis740.getStructure();
  await onprem.getInclude().updateMetadata({ includeName: 'ZGATE' }, write);
  const cloudInclude = cloud.getInclude();
  // @ts-expect-error -- ADT_TYPES_CLOUD lists no `updateMetadata` for the include
  await cloudInclude.updateMetadata({ includeName: 'ZGATE' }, write);
  const modernInclude = modern.getInclude();
  // @ts-expect-error -- the default variant is served what both tables list
  await modernInclude.updateMetadata({ includeName: 'ZGATE' }, write);
  const include740 = basis740.getInclude();
  // @ts-expect-error -- ADT_TYPES_BASIS_740 lists no `updateMetadata` for its include
  await include740.updateMetadata({ includeName: 'ZGATE' }, write);
  // @ts-expect-error -- the append structure has no `updateMetadata`
  await onprem.getAppendStructure().updateMetadata({ name: 'ZGATE' }, write);
  // The service binding: both modern variants, no 7.40 factory.
  const binding = { bindingName: 'ZGATE' };
  await onprem.getServiceBinding().updateMetadata(binding, write);
  await cloud.getServiceBinding().updateMetadata(binding, write);
  await modern.getServiceBinding().updateMetadata(binding, write);
  // @ts-expect-error -- ADT_TYPES_BASIS_740 serves no `serviceBinding`: the factory is refused
  basis740.getServiceBinding();

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

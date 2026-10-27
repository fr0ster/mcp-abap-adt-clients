/**
 * The members the legacy classes override for the first time in 37.3 keep the
 * base's public type — since 38.0.0 the base fixed to `'basis740'`, and the
 * gate a member's `this` carries kept as the base's.
 *
 * 37.3.0 is a minor: a consumer's code that compiled against 37.2 must compile
 * against it. Where a legacy class overrides a member it inherited in 37.2,
 * the override's declared type has to be the type the member had — the base's
 * — or the published `.d.ts` changes under the consumer: a getter answering
 * the concrete legacy class instead of the contract, a refusal declaring
 * `_config?: unknown` where the base requires a typed config.
 *
 * Type-level only. Each line is a compile-time check that the two member types
 * are the same type (see `Same`); `npm run test:check` fails on a mismatch, and the
 * one runtime assertion below only keeps Jest from reporting an empty file.
 *
 * The members the legacy classes already overrode in 37.2 are not listed:
 * their types are the ones 37.2 published, unchanged here.
 */
import type {
  AdtClass,
  AdtClient,
  AdtDdl,
  AdtExecutor,
  AdtFunctionGroup,
  AdtFunctionModule,
  AdtInterface,
  AdtPackage,
  AdtProgram,
  AdtRequest,
  AdtUtils,
  classDocuments,
  ddlDocuments,
  functionGroupDocuments,
  functionModuleDocuments,
  IAdtNotServed,
  interfaceDocuments,
  programDocuments,
  transportDocuments,
} from '@mcp-abap-adt/adt-clients';
import type { AdtClientLegacy } from '../../../clients/AdtClientLegacy';
import type { AdtExecutorLegacy } from '../../../clients/AdtExecutorLegacy';
import type { AdtClassLegacy } from '../../../core/class/AdtClassLegacy';
import type { AdtDdlLegacy } from '../../../core/ddl/AdtDdlLegacy';
import type { AdtFunctionGroupLegacy } from '../../../core/functionGroup/AdtFunctionGroupLegacy';
import type { AdtFunctionModuleLegacy } from '../../../core/functionModule/AdtFunctionModuleLegacy';
import type { AdtInterfaceLegacy } from '../../../core/interface/AdtInterfaceLegacy';
import type { AdtPackageLegacy } from '../../../core/package/AdtPackageLegacy';
import type { AdtProgramLegacy } from '../../../core/program/AdtProgramLegacy';
import type { AdtUtilsLegacy } from '../../../core/shared/AdtUtilsLegacy';
import type { AdtRequestLegacy } from '../../../core/transport/AdtRequestLegacy';

/**
 * `true` only when the two types are identical.
 *
 * Mutual assignability is not enough for methods: their parameters are
 * compared bivariantly, so `(_n?: string) => X` and `(n: string) => X` are
 * assignable both ways while a consumer's `readObjects()` compiles against one
 * and not the other. The deferred conditional types below compare the types
 * themselves.
 */
type Same<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

/**
 * What a member's gate refuses (`IAdtNotServed<What>`), or `'served'`.
 * Since 38.0.0 a gated member's receiver is `this & gate`, so the receiver
 * names each class; the gate, not the class, is what an override must keep.
 */
type GateOf<F> =
  ThisParameterType<F> extends IAdtNotServed<infer W> ? W : 'served';

/**
 * `true` when the two members take and answer the same types and keep the
 * same gate. The receiver is compared through its gate alone: it is `this`,
 * the legacy class on one side and its base on the other.
 */
type SameMember<A, B> = [
  Same<OmitThisParameter<A>, OmitThisParameter<B>>,
  Same<GateOf<A>, GateOf<B>>,
] extends [true, true]
  ? true
  : false;

/** Every listed member of `L` has the type it has on `B`. */
type SameMembers<L, B, K extends keyof L & keyof B> = {
  [M in K]: SameMember<L[M], B[M]>;
};

/** Fails to compile unless every entry is `true`. */
type AllTrue<T extends Record<string, true>> = T;

type LegacyClientGetters = AllTrue<
  SameMembers<
    AdtClientLegacy,
    AdtClient<'basis740'>,
    | 'getInclude'
    | 'getFunctionInclude'
    | 'getMessageClass'
    | 'getTransformation'
    | 'getScalarFunction'
    | 'getScalarFunctionImplementation'
    | 'getAppendStructure'
  >
>;

type LegacyExecutorGetters = AllTrue<
  SameMembers<
    AdtExecutorLegacy,
    AdtExecutor,
    'getClassExecutor' | 'getProgramExecutor'
  >
>;

type LegacyCheckDeletion = AllTrue<{
  class: SameMember<
    AdtClassLegacy['checkDeletion'],
    AdtClass<typeof classDocuments, 'basis740'>['checkDeletion']
  >;
  ddl: SameMember<
    AdtDdlLegacy['checkDeletion'],
    AdtDdl<typeof ddlDocuments, 'basis740'>['checkDeletion']
  >;
  functionGroup: SameMember<
    AdtFunctionGroupLegacy['checkDeletion'],
    AdtFunctionGroup<typeof functionGroupDocuments, 'basis740'>['checkDeletion']
  >;
  functionModule: SameMember<
    AdtFunctionModuleLegacy['checkDeletion'],
    AdtFunctionModule<
      typeof functionModuleDocuments,
      'basis740'
    >['checkDeletion']
  >;
  interface: SameMember<
    AdtInterfaceLegacy['checkDeletion'],
    AdtInterface<typeof interfaceDocuments, 'basis740'>['checkDeletion']
  >;
  program: SameMember<
    AdtProgramLegacy['checkDeletion'],
    AdtProgram<typeof programDocuments, 'basis740'>['checkDeletion']
  >;
}>;

type LegacyPackageRefusals = AllTrue<
  SameMembers<
    AdtPackageLegacy,
    AdtPackage,
    'checkDeletion' | 'lock' | 'unlock' | 'readTransport' | 'check'
  >
>;

type LegacyRequestRefusals = AllTrue<
  SameMembers<
    AdtRequestLegacy,
    AdtRequest<typeof transportDocuments, 'basis740'>,
    | 'searchConfigurations'
    | 'checkDeletion'
    | 'readObjects'
    | 'readActionLog'
    | 'addObject'
    | 'removeObject'
    | 'moveObjects'
    | 'sortAndCompress'
    | 'createTask'
    | 'changeTaskType'
  >
>;

type LegacyUtilsOverrides = AllTrue<
  SameMembers<
    AdtUtilsLegacy,
    AdtUtils,
    | 'checkDeletionGroup'
    | 'deleteObjectsGroup'
    | 'getWhereUsed'
    | 'getWhereUsedScope'
    | 'getVirtualFoldersContents'
    | 'getAllTypes'
    | 'getActivationRun'
    | 'getActivationResults'
    | 'readObjectMetadata'
    | 'readObjectSource'
  >
>;

/** The checks above, named once so the compiler evaluates every one. */
type Checked = [
  LegacyClientGetters,
  LegacyExecutorGetters,
  LegacyCheckDeletion,
  LegacyPackageRefusals,
  LegacyRequestRefusals,
  LegacyUtilsOverrides,
];

it('the legacy overrides new in 37.3 type-check as the base members', () => {
  const checked: Checked | undefined = undefined;
  expect(checked).toBeUndefined();
});

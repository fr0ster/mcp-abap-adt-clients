/**
 * The members the legacy classes override for the first time in 37.3 keep the
 * base's public type.
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
import type { AdtClient } from '../../../clients/AdtClient';
import type { AdtClientLegacy } from '../../../clients/AdtClientLegacy';
import type { AdtExecutor } from '../../../clients/AdtExecutor';
import type { AdtExecutorLegacy } from '../../../clients/AdtExecutorLegacy';
import type { AdtClass } from '../../../core/class/AdtClass';
import type { AdtClassLegacy } from '../../../core/class/AdtClassLegacy';
import type { AdtDdl } from '../../../core/ddl/AdtDdl';
import type { AdtDdlLegacy } from '../../../core/ddl/AdtDdlLegacy';
import type { AdtFunctionGroup } from '../../../core/functionGroup/AdtFunctionGroup';
import type { AdtFunctionGroupLegacy } from '../../../core/functionGroup/AdtFunctionGroupLegacy';
import type { AdtFunctionModule } from '../../../core/functionModule/AdtFunctionModule';
import type { AdtFunctionModuleLegacy } from '../../../core/functionModule/AdtFunctionModuleLegacy';
import type { AdtInterface } from '../../../core/interface/AdtInterface';
import type { AdtInterfaceLegacy } from '../../../core/interface/AdtInterfaceLegacy';
import type { AdtPackage } from '../../../core/package/AdtPackage';
import type { AdtPackageLegacy } from '../../../core/package/AdtPackageLegacy';
import type { AdtProgram } from '../../../core/program/AdtProgram';
import type { AdtProgramLegacy } from '../../../core/program/AdtProgramLegacy';
import type { AdtUtils } from '../../../core/shared/AdtUtils';
import type { AdtUtilsLegacy } from '../../../core/shared/AdtUtilsLegacy';
import type { AdtRequest } from '../../../core/transport/AdtRequest';
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

/** Every listed member of `L` has the type it has on `B`. */
type SameMembers<L, B, K extends keyof L & keyof B> = {
  [M in K]: Same<L[M], B[M]>;
};

/** Fails to compile unless every entry is `true`. */
type AllTrue<T extends Record<string, true>> = T;

type LegacyClientGetters = AllTrue<
  SameMembers<
    AdtClientLegacy,
    AdtClient,
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
  class: Same<AdtClassLegacy['checkDeletion'], AdtClass['checkDeletion']>;
  ddl: Same<AdtDdlLegacy['checkDeletion'], AdtDdl['checkDeletion']>;
  functionGroup: Same<
    AdtFunctionGroupLegacy['checkDeletion'],
    AdtFunctionGroup['checkDeletion']
  >;
  functionModule: Same<
    AdtFunctionModuleLegacy['checkDeletion'],
    AdtFunctionModule['checkDeletion']
  >;
  interface: Same<
    AdtInterfaceLegacy['checkDeletion'],
    AdtInterface['checkDeletion']
  >;
  program: Same<AdtProgramLegacy['checkDeletion'], AdtProgram['checkDeletion']>;
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
    AdtRequest,
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

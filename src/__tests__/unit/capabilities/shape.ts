/**
 * Check 1 — the declared type of every factory against what the manifest says
 * it can do, **in both directions**, at compile time.
 *
 * Not one assertion per pair: 37 factories × 10 atoms, and a forgotten line is
 * a silent hole in the check that exists to close silent holes. This is a
 * mapped type over the full product whose `as` clause drops every pair that
 * agrees — so a disagreeing factory keeps its key, and the assertion at the
 * bottom fails naming it.
 *
 * Both directions matter and for different reasons:
 *
 * - **claimed but not offered** — the manifest says ADT gives this object the
 *   capability and the handed-out type does not have it, so a consumer cannot
 *   reach a method that works. That is how `run` was unreachable before
 *   interfaces 13.1.0.
 * - **offered but not claimed** — the type promises what ADT does not give, and
 *   the method behind it either throws or lies. That is the whole subject of
 *   this plan.
 *
 * This file is never imported at runtime. `npm run test:check` type-checks it,
 * which is the test.
 */

import type {
  IAdtActivatable,
  IAdtCheckable,
  IAdtCreatable,
  IAdtDeletable,
  IAdtLockable,
  IAdtReadable,
  IAdtTransportAware,
  IAdtUpdatable,
  IAdtValidatable,
  IAdtVersionable,
} from '@mcp-abap-adt/interfaces';
import type { AdtClient } from '../../../clients/AdtClient';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** The contract a consumer receives — the factory's return type, not the class. */
type Contract<K extends keyof AdtClient> = AdtClient[K] extends (
  ...args: never[]
) => infer R
  ? R
  : never;

/**
 * Does `T` offer the atom?
 *
 * The atoms are generic over a config type this check does not know per
 * factory, so `any` stands in: the question here is whether the **method** is
 * offered at all, not whether it is typed over the right config — which tsc
 * already settles inside each handler.
 */
type Offers<T, Atom> = T extends Atom ? true : false;

type OffersAtom<T, A extends string> = A extends 'creatable'
  ? Offers<T, IAdtCreatable<any, any>>
  : A extends 'readable'
    ? Offers<T, IAdtReadable<any, any>>
    : A extends 'updatable'
      ? Offers<T, IAdtUpdatable<any, any>>
      : A extends 'deletable'
        ? Offers<T, IAdtDeletable<any, any>>
        : A extends 'validatable'
          ? Offers<T, IAdtValidatable<any, any>>
          : A extends 'checkable'
            ? Offers<T, IAdtCheckable<any, any>>
            : A extends 'activatable'
              ? Offers<T, IAdtActivatable<any, any>>
              : A extends 'lockable'
                ? Offers<T, IAdtLockable<any, any>>
                : A extends 'versionable'
                  ? Offers<T, IAdtVersionable<any>>
                  : A extends 'transportAware'
                    ? Offers<T, IAdtTransportAware<any, any>>
                    : never;

/**
 * The manifest, restated as types.
 *
 * `manifest.ts` is the runtime source of truth and this is the same claim in
 * the type system — the two are kept together by `manifestAgreesWithTypes` in
 * `behaviour.test.ts`, which fails if a factory's claims differ between them.
 */
export interface Claims {
  class: FullSet;
  interface: FullSet;
  program: FullSet;
  ddl: FullSet;
  table: FullSet;
  structure: FullSet;
  tableType: FullSet;
  accessControl: FullSet;
  appendStructure: FullSet;
  behaviorDefinition: FullSet;
  behaviorImplementation: FullSet;
  metadataExtension: FullSet;
  enhancement: FullSet;
  serviceDefinition: FullSet;
  functionModule: FullSet;
  scalarFunction: FullSet;
  scalarFunctionImplementation: FullSet;
  transformation: FullSet;
  service: Exclude<FullSet, 'versionable' | 'lockable'>;

  domain: Exclude<FullSet, 'versionable'>;
  dataElement: Exclude<FullSet, 'versionable'>;
  functionGroup: Exclude<FullSet, 'versionable'>;
  package: Exclude<FullSet, 'versionable' | 'activatable'>;
  functionInclude: Exclude<FullSet, 'transportAware'>;
  authorizationField: Exclude<FullSet, 'versionable' | 'transportAware'>;
  featureToggle: Exclude<FullSet, 'versionable' | 'transportAware'>;
  serviceBinding: Exclude<FullSet, 'versionable' | 'lockable'>;

  localTestClass: Exclude<FullSet, 'creatable'>;
  localTypes: Exclude<FullSet, 'creatable'>;
  localDefinitions: Exclude<FullSet, 'creatable'>;
  localMacros: Exclude<FullSet, 'creatable'>;

  messageClass:
    | 'creatable'
    | 'readable'
    | 'updatable'
    | 'deletable'
    | 'validatable'
    | 'lockable';
  messageClassMessage: 'creatable' | 'readable' | 'updatable' | 'deletable';
  transport: 'creatable' | 'readable' | 'updatable' | 'deletable';
  unitTest:
    | 'creatable'
    | 'readable'
    | 'updatable'
    | 'deletable'
    | 'validatable'
    | 'lockable';
  cdsUnitTest:
    | 'creatable'
    | 'readable'
    | 'updatable'
    | 'deletable'
    | 'validatable'
    | 'lockable';
}

type FullSet =
  | 'creatable'
  | 'readable'
  | 'updatable'
  | 'deletable'
  | 'validatable'
  | 'checkable'
  | 'activatable'
  | 'lockable'
  | 'versionable'
  | 'transportAware';

/** Which factory each claim is about. */
interface Factories {
  class: 'getClass';
  interface: 'getInterface';
  program: 'getProgram';
  ddl: 'getDdl';
  table: 'getTable';
  structure: 'getStructure';
  tableType: 'getTableType';
  accessControl: 'getAccessControl';
  appendStructure: 'getAppendStructure';
  behaviorDefinition: 'getBehaviorDefinition';
  behaviorImplementation: 'getBehaviorImplementation';
  metadataExtension: 'getMetadataExtension';
  enhancement: 'getEnhancement';
  serviceDefinition: 'getServiceDefinition';
  functionModule: 'getFunctionModule';
  scalarFunction: 'getScalarFunction';
  scalarFunctionImplementation: 'getScalarFunctionImplementation';
  transformation: 'getTransformation';
  service: 'getService';
  domain: 'getDomain';
  dataElement: 'getDataElement';
  functionGroup: 'getFunctionGroup';
  package: 'getPackage';
  functionInclude: 'getFunctionInclude';
  authorizationField: 'getAuthorizationField';
  featureToggle: 'getFeatureToggle';
  serviceBinding: 'getServiceBinding';
  localTestClass: 'getLocalTestClass';
  localTypes: 'getLocalTypes';
  localDefinitions: 'getLocalDefinitions';
  localMacros: 'getLocalMacros';
  messageClass: 'getMessageClass';
  messageClassMessage: 'getMessageClassMessage';
  transport: 'getRequest';
  unitTest: 'getUnitTest';
  cdsUnitTest: 'getCdsUnitTest';
}

/** Every (factory, atom) pair whose type and claim disagree. */
type Disagreements = {
  [H in keyof Claims]: {
    [A in FullSet as OffersAtom<
      Contract<Factories[H] & keyof AdtClient>,
      A
    > extends (A extends Claims[H] ? true : false)
      ? never
      : A]: OffersAtom<Contract<Factories[H] & keyof AdtClient>, A> extends true
      ? 'offered but not claimed'
      : 'claimed but not offered';
  };
};

/** A handler with no disagreements contributes `{}`. */
type Offenders = {
  [H in keyof Disagreements as keyof Disagreements[H] extends never
    ? never
    : H]: Disagreements[H];
};

/**
 * Nothing disagrees.
 *
 * This held three entries until 2026-08-14 — `featureToggle`, `serviceBinding`
 * and `service`, each offering version history and either a transport or a lock
 * that ADT does not give them. All three were the same cause: their composites
 * lived in `@mcp-abap-adt/interfaces` and extended the fat `IAdtObject`, so
 * they could not be fixed from here. They were narrowed there, the handlers
 * followed, and the list is empty.
 *
 * It stays as a named type rather than being deleted: a disagreement that
 * cannot be fixed in this package is a fact worth recording rather than
 * tolerating silently, and the next one will have somewhere to go — with the
 * assertion below failing until someone writes down why.
 */
export type KnownDisagreements = {};

/**
 * The assertion.
 *
 * When this fails, the error names every factory that disagrees and, per atom,
 * which way round. Fix the manifest or the handler — never the check.
 */
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

export type _EveryFactoryMatchesItsClaim =
  Equal<Offenders, KnownDisagreements> extends true ? true : Offenders;

export const everyFactoryMatchesItsClaim: _EveryFactoryMatchesItsClaim = true;

/**
 * The three factories whose classes carry members beyond the lifecycle atoms
 * the manifest checks — `getUtils`, `getFeatureToggle` and `getServiceBinding`
 * — answer their classes (38.0.0). A consumer reaches a member only through a
 * contract it composes from `@mcp-abap-adt/interfaces-adt`, so every public
 * method of what the factory answers must be declared by an atom there: a
 * method no atom declares is on the object and unreachable through any
 * consumer's contract.
 *
 * So this fails compiling when one of these classes gains a method no atom
 * of its object declares, naming the method. Never imported at runtime;
 * `npm run test:check` is the test.
 */

import type {
  IAdtActivatable,
  IAdtCheckable,
  IAdtCreatable,
  IAdtDataPreview,
  IAdtDeletable,
  IAdtDiscovery,
  IAdtGroupLifecycle,
  IAdtInformationSystem,
  IAdtLockable,
  IAdtMetadataReadable,
  IAdtMetadataUpdatable,
  IAdtObjectAccess,
  IAdtObjectProperties,
  IAdtReadable,
  IAdtRepositoryStructure,
  IAdtServiceBindingTypes,
  IAdtServiceGroupReadable,
  IAdtTransportAware,
  IAdtUpdatable,
  IAdtValidatable,
  IFeatureToggleObject,
} from '@mcp-abap-adt/interfaces-adt';
import type { AdtClient } from '../../../clients/AdtClient';

type Assert<T extends true> = T;

/**
 * The public methods of `C` that `T` does not declare; `never` when none.
 * Methods, not every key: a data member like `objectType` is the handler's
 * label, not something a caller invokes, and no atom carries it. `-?` keeps an
 * optional data member (`variant`, the gates' type-only marker) from leaving
 * `undefined` among the keys.
 */
type Methods<C> = {
  [K in keyof C]-?: C[K] extends (...args: never[]) => unknown ? K : never;
}[keyof C];
type Uncovered<C, T> = Exclude<Methods<C>, keyof T>;

/** What a call answers — the class over its shipped default. */
declare const client: AdtClient;
const utils = client.getUtils();
const featureToggle = client.getFeatureToggle();
const serviceBinding = client.getServiceBinding();

// Only the keys matter here; tsc checks each member's types in its class.
type U = unknown;

type LifecycleAtoms = IAdtCreatable<U, U> &
  IAdtReadable<U, U> &
  IAdtMetadataReadable<U, U> &
  IAdtUpdatable<U, U> &
  IAdtDeletable<U, U, U> &
  IAdtValidatable<U, U> &
  IAdtCheckable<U, U> &
  IAdtActivatable<U, U> &
  IAdtLockable<U>;

type UtilsAtoms = IAdtInformationSystem<U, U, U, U, U> &
  IAdtRepositoryStructure<U, U> &
  IAdtGroupLifecycle<U, U, U, U, U, U> &
  IAdtDataPreview<U, U, U> &
  IAdtDiscovery<U> &
  IAdtObjectAccess<U, U, U> &
  IAdtObjectProperties<U>;

type FeatureToggleAtoms = LifecycleAtoms &
  IAdtMetadataUpdatable<U, U> &
  IFeatureToggleObject<{
    switched: U;
    runtimeState: U;
    checkState: U;
    source: U;
  }>;

type ServiceBindingAtoms = LifecycleAtoms &
  IAdtMetadataUpdatable<U, U> &
  IAdtTransportAware<U, U> &
  IAdtServiceBindingTypes<U> &
  IAdtServiceGroupReadable<U>;

/**
 * The one member of `AdtUtils` no atom of interfaces-adt 21.0.0 declares:
 * `getTypeStructure`, added for the conformance check of the ADT type tables,
 * which calls it on the class. Named here, not hidden: until the contract
 * package carries its atom, a consumer's composed contract cannot reach it.
 * Any other uncovered method still fails below.
 */
type AwaitingItsAtom = 'getTypeStructure';

export type _UtilsCovered = Assert<
  [Exclude<Uncovered<typeof utils, UtilsAtoms>, AwaitingItsAtom>] extends [
    never,
  ]
    ? true
    : false
>;

/** And the exception names a member that exists, so it cannot go stale. */
export type _AwaitingItsAtomExists = Assert<
  AwaitingItsAtom extends Uncovered<typeof utils, UtilsAtoms> ? true : false
>;

export type _FeatureToggleCovered = Assert<
  [Uncovered<typeof featureToggle, FeatureToggleAtoms>] extends [never]
    ? true
    : false
>;

export type _ServiceBindingCovered = Assert<
  [Uncovered<typeof serviceBinding, ServiceBindingAtoms>] extends [never]
    ? true
    : false
>;

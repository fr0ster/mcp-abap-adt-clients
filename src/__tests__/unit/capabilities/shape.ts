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
import type { Atom, HANDLERS } from './manifest';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * The claims, **derived** from the manifest rather than restated.
 *
 * An earlier version of this file hand-maintained a second copy of the same
 * 36-entry list, and a comment claiming a check kept the two together. That
 * check did not exist — a grep for its name found nothing — so the two lists
 * could drift indefinitely, which is the exact class of silent regression this
 * guard is for. Caught in review, 2026-08-14.
 *
 * Both halves now come from `HANDLERS`: the capability set from its
 * `capabilities` tuple, and the contract from the **return type of its own
 * factory closure**, which is the type a consumer receives. There is nothing
 * left to keep in step.
 */
type Claims = {
  [H in keyof typeof HANDLERS]: (typeof HANDLERS)[H]['capabilities'][number];
};

/** The contract a consumer receives — the factory's return type, not the class. */
type Contract<H extends keyof typeof HANDLERS> = ReturnType<
  (typeof HANDLERS)[H]['factory']
>;

/**
 * Does `T` offer the atom?
 *
 * The atoms are generic over a config type this check does not know per
 * factory, so `any` stands in: the question here is whether the **method** is
 * offered at all, not whether it is typed over the right config — which tsc
 * already settles inside each handler.
 */
type Offers<T, A> = T extends A ? true : false;

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

/** Every (factory, atom) pair whose type and claim disagree. */
type Disagreements = {
  [H in keyof Claims]: {
    [A in Atom as OffersAtom<Contract<H>, A> extends (
      A extends Claims[H]
        ? true
        : false
    )
      ? never
      : A]: OffersAtom<Contract<H>, A> extends true
      ? 'offered but not claimed'
      : 'claimed but not offered';
  };
};

/**
 * Every disagreement, flattened to `handler.atom: which way round`.
 *
 * A union of strings rather than a nested type on purpose: `tsc` prints a type
 * alias by **name** in CLI output and expands a union of literals, so this is
 * the difference between a CI log that says `Type 'boolean' is not assignable
 * to type 'Offenders'` and one that says exactly which factory and which atom.
 * The earlier version claimed the first was the second — caught in review,
 * 2026-08-14, by running the failure and reading the log.
 */
type Offenders = {
  [H in keyof Disagreements]: {
    [A in keyof Disagreements[H]]: `${H & string}.${A & string} — ${Disagreements[H][A] & string}`;
  }[keyof Disagreements[H]];
}[keyof Disagreements];

/**
 * Nothing disagrees.
 *
 * This held three entries until 2026-08-14 — `featureToggle`, `serviceBinding`
 * and `service`, each offering version history and either a transport or a lock
 * that ADT does not give them. All three were the same cause: their composites
 * lived in `@mcp-abap-adt/interfaces` and extended the fat `IAdtObject`, so
 * they could not be fixed from here. They were narrowed there, the handlers
 * followed, and nothing is left.
 *
 * It stays as a named type rather than being deleted: a disagreement that
 * cannot be fixed in this package is a fact worth recording rather than
 * tolerating silently, and the next one has somewhere to go — with the
 * assertion below failing until someone writes down why.
 */
export type KnownDisagreements = never;

/**
 * The assertion.
 *
 * When this fails, the error names every disagreeing factory and atom, and
 * which way round — verified by reading the `npm run test:check` output, not
 * by assuming. Fix the manifest or the handler; never the check.
 */
export type _EveryFactoryMatchesItsClaim = [Offenders] extends [
  KnownDisagreements,
]
  ? true
  : Offenders;

export const everyFactoryMatchesItsClaim: _EveryFactoryMatchesItsClaim = true;

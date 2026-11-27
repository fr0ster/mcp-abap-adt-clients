/**
 * The result strategies an abapGit client is constructed with.
 *
 * One per member, given once, so every call through the client answers the
 * shape its strategy makes (decision 22 in the interfaces repository). The
 * shipped default reads nothing: each legacy member answers the document ADT
 * sent, and `unlink` — a DELETE with nothing to read — answers nothing. The
 * readings that used to be applied here (`IAbapGitRepoStatus` and the rest)
 * are `abapGitRepos`, `abapGitErrorLog` and `abapGitExternalRepo` in
 * `@mcp-abap-adt/adt-strategies`, for a caller who wants those shapes.
 *
 * **The new forms (46.2.0) have slots of their own**, each optional: a facts
 * reader (`IAbapGitFactsResultStrategy`), handed the facts `abapGitFacts`
 * reduced the answer to, never the document. A slot left out answers those
 * facts as they are (`IAbapGitFactsResponse<F>`). The legacy slots keep their
 * names and their `abapGitDocuments` defaults.
 */
import type {
  IAbapGitBranchInfoFacts,
  IAbapGitExternalRepoFacts,
  IAbapGitFileFacts,
  IAbapGitModifiedObjectsFacts,
  IAbapGitNoFacts,
  IAbapGitObjectsFacts,
  IAbapGitReposFacts,
  IAbapGitStagingFacts,
  IAbapGitStatusFacts,
} from '@mcp-abap-adt/adt-strategies';
import type {
  IAbapGitFactsResponse,
  IAbapGitFactsResultStrategy,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import { nothing, rawDocument } from '../../utils/resultStrategy';

/** What each new-form slot's facts are: the route's kept fields (spec §5.3). */
export interface IAbapGitFactsOf {
  /** R1 `listReposQuiet`. */
  readonly reposFacts: IAbapGitReposFacts;
  /** R2, the new form of `link`. */
  readonly linkedFacts: IAbapGitObjectsFacts;
  /** R13, the new form of `checkExternalRepo`. */
  readonly externalRepoFacts: IAbapGitExternalRepoFacts;
  /** R4 `pullRepo`. */
  readonly repoPulled: IAbapGitObjectsFacts;
  /** R5 `pullRepoInDialog`. */
  readonly repoPulledInDialog: IAbapGitNoFacts;
  /** R8 `getRunLog`. */
  readonly runLog: IAbapGitObjectsFacts;
  /** R6 `getModifiedObjects`. */
  readonly modifiedObjects: IAbapGitModifiedObjectsFacts;
  /** R7 `getStatus`. */
  readonly status: IAbapGitStatusFacts;
  /** R9 `getStaging`. */
  readonly staging: IAbapGitStagingFacts;
  /** R10 `push`. */
  readonly pushed: IAbapGitNoFacts;
  /** R11 `checkRepo`. */
  readonly checked: IAbapGitNoFacts;
  /** R12 `getFile`. */
  readonly file: IAbapGitFileFacts;
  /** R14 `getBranchInfo`. */
  readonly branchInfo: IAbapGitBranchInfoFacts;
  /** R15 `switchBranch`. */
  readonly switched: IAbapGitNoFacts;
}

/** A new form's slot. */
export type AbapGitFactsSlot = keyof IAbapGitFactsOf;

/** What a new-form slot answers when the result set leaves it out. */
export type AbapGitDefaultFacts<K extends AbapGitFactsSlot> =
  IAbapGitFactsResponse<IAbapGitFactsOf[K]>;

/** The new-form slots: each a facts reader, each optional. */
export type IAbapGitFactsResults = {
  readonly [K in AbapGitFactsSlot]?: IAbapGitFactsResultStrategy<
    unknown,
    IAbapGitFactsOf[K]
  >;
};

export interface IAbapGitResults extends IAbapGitFactsResults {
  readonly pulled: IResultStrategy<unknown>;
  readonly unlinked: IResultStrategy<unknown>;
  readonly repos: IResultStrategy<unknown>;
  readonly errorLog: IResultStrategy<unknown>;
}

/**
 * The shipped default: documents as they arrived. The new-form slots are left
 * out, so they answer the facts.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const abapGitDocuments = {
  pulled: rawDocument,
  unlinked: nothing,
  repos: rawDocument,
  errorLog: rawDocument,
} satisfies IAbapGitResults;

/** What each slot of an abapGit client's result set answers. */
export type AbapGitValues = {
  readonly [K in keyof IAbapGitResults]: unknown;
};

/**
 * Whether `K` is an optional key of `R` — by the key, not by `undefined` in
 * its type (`{} extends Pick<R, K>`; `Record<never, never>` is that `{}`).
 */
type IsOptional<R, K extends keyof R> =
  Record<never, never> extends Pick<R, K> ? true : false;

/** The value a facts reader answers. */
type FactsReaderValue<S> =
  S extends IAbapGitFactsResultStrategy<infer X, never> ? X : never;

declare const factsValue: unique symbol;

/**
 * A new-form slot's value in a values map: the reader's value `X`, boxed, so
 * the `undefined` an optional key adds (with `exactOptionalPropertyTypes` off)
 * never mixes with an `undefined` the reader itself answers. A type only:
 * nothing of this shape is ever built.
 */
export interface AbapGitFactsSlotValue<X> {
  readonly [factsValue]: X;
}

/** The reader's value a slot's box holds; an absent slot's `undefined` is none. */
type Unboxed<V> = V extends AbapGitFactsSlotValue<infer X> ? X : never;

/**
 * The values a result set answers, slot by slot — `ResultValuesOf` for the
 * legacy slots, and for a new-form slot its reader's value. Homomorphic, so a
 * slot keeps its optionality; `FactsValue` reads an optional one as its
 * reader's value or the default facts.
 */
export type AbapGitValuesOf<R> = {
  readonly [K in keyof R]: K extends AbapGitFactsSlot
    ? AbapGitFactsSlotValue<FactsReaderValue<Exclude<R[K], undefined>>>
    : R[K] extends IResultStrategy<infer X>
      ? X
      : never;
};

/**
 * The result strategies that answer the values `T`, slot by slot: a facts
 * reader for a new-form slot, an `IResultStrategy` for every other one.
 * Homomorphic over `T`, so a slot optional in `T` is optional here.
 */
export type AbapGitStrategiesOf<T> = {
  readonly [K in keyof T]: K extends AbapGitFactsSlot
    ? IAbapGitFactsResultStrategy<Unboxed<T[K]>, IAbapGitFactsOf[K]>
    : IResultStrategy<T[K]>;
};

/**
 * What a new member answers for the values `T`: the slot's value when `T`
 * names it (with the default facts too when the slot is optional — it may be
 * absent at run time), else the default facts. Decided by the key's
 * optionality, and the reader's value is read out of its box, so the answer is
 * the same with `exactOptionalPropertyTypes` on and off and keeps a reader's
 * own `undefined`.
 */
export type FactsValue<T, K extends AbapGitFactsSlot> = K extends keyof T
  ? IsOptional<T, K> extends true
    ? Unboxed<T[K]> | AbapGitDefaultFacts<K>
    : Unboxed<T[K]>
  : AbapGitDefaultFacts<K>;

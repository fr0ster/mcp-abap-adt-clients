/**
 * Class module type definitions.
 *
 * `IClassState` is gone with the other 31 state bags in
 * `@mcp-abap-adt/interfaces` 29.0.0. It was ten optional transport frames from
 * which a caller could type nothing out; a member now answers what its own
 * endpoint produced, and a failure carries the request that produced it.
 *
 * What each member answers is declared here, beside the implementation that
 * produces it, because a result is the implementation's to name — the contract
 * says only that it is answered.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces';
import { nothing, rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type {
  IClassConfig,
  ICreateClassParams,
  IDeleteClassParams,
} from '@mcp-abap-adt/interfaces';

/**
 * What ADT answers when a class is created.
 *
 * `POST /sap/bc/adt/oo/classes` returns the created class's metadata document.
 * Handed over as it arrived: decision 5 leaves parsing to whoever wants a shape
 * out of it, and this library does not know which fields a caller needs.
 */
export type ClassCreated = string;

/**
 * The class's ABAP source, from `/source/main`.
 *
 * Empty is a legitimate answer and is not, on its own, "the class is not there":
 * ADT answers a read for a missing object with 200 and no body rather than 404.
 * A caller who needs those told apart supplies `analyse` in the operation
 * options — for a read-modify-write it is a failure, since writing back what it
 * read would erase the class, and for a listing it is nothing.
 */
export type ClassSource = string;

/** The class's metadata document, from the object resource itself. */
export type ClassMetadata = string;

/**
 * What a check run answers: `chkl:messages`, whose `<msg type="E">` entries are
 * the verdict. The status is not — ADT answers a refusal inside a 200.
 */
export type ClassCheckResult = string;

/**
 * What activation answers: `chkl:messages` again.
 *
 * `activationExecuted="false"` means no work was done, not that work failed: a
 * class that is already active reports it with an empty message list. Only an
 * `E` message is a failure.
 */
export type ClassActivationResult = string;

/** What name validation answers. */
export type ClassValidationResult = string;

/**
 * What a deletion answers: `del:deletionResult`, whose `del:isDeleted="false"`
 * with a reason means the class is still there. That arrives inside a 200, which
 * is why the document rather than the status decides.
 */
export type ClassDeletionResult = string;

/** An update writes; ADT answers it with nothing worth reading. */
export type ClassUpdated = undefined;

/**
 * One strategy per member of a class implementation.
 *
 * An implementation is given a whole set when it is constructed, not a strategy
 * per call: a consumer that wants documents whole wants them for every member it
 * touches, and none of them changes its mind between `create` and `read` of the
 * same object.
 *
 * **The set carries no type parameters.** `ReturnType<R['created']>` reads the
 * type out of the strategy a consumer passed, so a positional parameter per slot
 * would only restate what is already derivable — and every constraint naming the
 * interface would have to repeat them. It did, and adding a slot then left the
 * new parameter at its default in every constraint that still listed the old
 * count: legal TypeScript, silently un-injectable. Twice. The shipped defaults
 * live in the `…Documents` constant below instead, which is what the handlers
 * default their `R` to.
 */
export interface IClassResults {
  readonly created: IResultStrategy<unknown>;
  readonly source: IResultStrategy<unknown>;
  readonly metadata: IResultStrategy<unknown>;
  readonly check: IResultStrategy<unknown>;
  readonly activation: IResultStrategy<unknown>;
  readonly validation: IResultStrategy<unknown>;
  readonly deletion: IResultStrategy<unknown>;
  readonly updated: IResultStrategy<unknown>;
  /** What a deletion check answers: `del:checkResponse`. */
  readonly deletionCheck: IResultStrategy<unknown>;
}

/**
 * The shipped default: every member answers its document as it arrived.
 *
 * `satisfies`, never a `: IClassResults` annotation, and it matters more now
 * than it did: the interface types every field as `IResultStrategy<unknown>`,
 * so annotating this constant with it would widen all of them to `unknown` and
 * `ReturnType<R['created']>` would answer `unknown` for the default set. With
 * `satisfies` the shape is checked and the types are kept, which is what makes
 * the positional parameters unnecessary. The rule is the same everywhere.
 */
export const classDocuments = {
  created: rawDocument,
  source: rawDocument,
  metadata: rawDocument,
  check: rawDocument,
  activation: rawDocument,
  validation: rawDocument,
  deletion: rawDocument,
  updated: nothing,
  deletionCheck: rawDocument,
} satisfies IClassResults;

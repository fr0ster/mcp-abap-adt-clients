/**
 * Include module type definitions.
 *
 * `IIncludeState` is gone with the other state bags: a member now answers what
 * its own endpoint produced, and a failure carries the request that produced it.
 * What each member answers is declared here, beside the implementation that
 * produces it, because a result is the implementation's to name — the contract
 * says only that it is answered.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces';
import { nothing, rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type { IIncludeConfig } from '@mcp-abap-adt/interfaces';

/**
 * What ADT answers when a `PROG/I` include is created: the created object's
 * metadata document, as it arrived.
 */
export type IncludeCreated = string;

/**
 * The include's ABAP source, from `/source/main`.
 *
 * Empty is a legitimate answer and a legitimate include — an empty include is a
 * real object here — so an empty body is not, on its own, absence. A caller who
 * needs those told apart supplies `analyse`.
 */
export type IncludeSource = string;

/**
 * The include's metadata document, from the object resource itself.
 */
export type IncludeMetadata = string;

/**
 * What activation answers: `chkl:messages`.
 *
 * `activationExecuted="false"` means no work was done, not that work failed.
 */
export type IncludeActivationResult = string;

/**
 * What `/sap/bc/adt/includes/validation` answers.
 *
 * Measured: it does **not** police `objtype` — posting `PROG/P` to the includes
 * validation also answers `200 X`. So a success says the name is free, not that
 * the type was understood.
 */
export type IncludeValidationResult = string;

/**
 * What the DELETE answers.
 *
 * Measured : a successful DELETE does **not** release the
 * lock with the object. The editing registration on the name stays, and the next
 * create for that name is answered 403 `ExceptionResourceNoAuthorization`. So the
 * unlock still has to run afterwards.
 */
export type IncludeDeletionResult = string;

/**
 * A source upload writes; ADT answers it with nothing worth reading.
 */
export type IncludeUpdated = undefined;

/** One strategy per member of a include implementation. See `IClassResults`. */
export interface IIncludeResults {
  readonly created: IResultStrategy<unknown>;
  readonly source: IResultStrategy<unknown>;
  readonly metadata: IResultStrategy<unknown>;
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
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const includeDocuments = {
  created: rawDocument,
  source: rawDocument,
  metadata: rawDocument,
  activation: rawDocument,
  validation: rawDocument,
  deletion: rawDocument,
  updated: nothing,
  deletionCheck: rawDocument,
} satisfies IIncludeResults;

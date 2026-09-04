/**
 * Program module type definitions.
 *
 * `IProgramState` is gone with the other state bags: a member now answers what
 * its own endpoint produced, and a failure carries the request that produced it.
 * What each member answers is declared here, beside the implementation that
 * produces it, because a result is the implementation's to name — the contract
 * says only that it is answered.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces';
import { nothing, rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type {
  ICreateProgramParams,
  IDeleteProgramParams,
  IProgramConfig,
  IUpdateProgramSourceParams,
} from '@mcp-abap-adt/interfaces';

/**
 * What ADT answers when a program is created.
 *
 * `POST /sap/bc/adt/programs/programs` answers with the created program's
 * metadata document. Handed over as it arrived: decision 5 leaves parsing to
 * whoever wants a shape out of it.
 */
export type ProgramCreated = string;

/**
 * The program's ABAP source, from `/source/main`.
 *
 * Empty is a legitimate answer and is not, on its own, "the program is not
 * there": ADT answers a read for a missing object with 200 and no body rather
 * than 404. A caller who needs those told apart supplies `analyse`.
 */
export type ProgramSource = string;

/** The program's metadata document, from the object resource itself. */
export type ProgramMetadata = string;

/**
 * What a check run answers: `chkl:messages`, whose `<msg type="E">` entries are
 * the verdict. The status is not — ADT answers a refusal inside a 200.
 */
export type ProgramCheckResult = string;

/**
 * What activation answers: `chkl:messages` again.
 *
 * `activationExecuted="false"` means no work was done, not that work failed.
 */
export type ProgramActivationResult = string;

/** What name validation answers. */
export type ProgramValidationResult = string;

/**
 * What a deletion answers: `del:deletionResult`, whose `del:isDeleted="false"`
 * with a reason means the program is still there — inside a 200.
 */
export type ProgramDeletionResult = string;

/** An update writes; ADT answers it with nothing worth reading. */
export type ProgramUpdated = void;

/** The transport document for the program, from its `objectstates` resource. */
export type ProgramTransport = string;

/** One strategy per member of a program implementation. See `IClassResults`. */
export interface IProgramResults<
  TCreated = ProgramCreated,
  TSource = ProgramSource,
  TMetadata = ProgramMetadata,
  TCheck = ProgramCheckResult,
  TActivation = ProgramActivationResult,
  TValidation = ProgramValidationResult,
  TDeletion = ProgramDeletionResult,
  TUpdated = ProgramUpdated,
  TTransport = ProgramTransport,
> {
  readonly created: IResultStrategy<TCreated>;
  readonly source: IResultStrategy<TSource>;
  readonly metadata: IResultStrategy<TMetadata>;
  readonly check: IResultStrategy<TCheck>;
  readonly activation: IResultStrategy<TActivation>;
  readonly validation: IResultStrategy<TValidation>;
  readonly deletion: IResultStrategy<TDeletion>;
  readonly updated: IResultStrategy<TUpdated>;
  readonly transport: IResultStrategy<TTransport>;
}

/**
 * The shipped default: every member answers its document as it arrived.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const programDocuments = {
  created: rawDocument,
  source: rawDocument,
  metadata: rawDocument,
  check: rawDocument,
  activation: rawDocument,
  validation: rawDocument,
  deletion: rawDocument,
  updated: nothing,
  transport: rawDocument,
} satisfies IProgramResults;

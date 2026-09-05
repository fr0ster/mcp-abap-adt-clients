/**
 * Interface module type definitions.
 *
 * `IInterfaceState` is gone with the other state bags: a member now answers what
 * its own endpoint produced, and a failure carries the request that produced it.
 * What each member answers is declared here, beside the implementation that
 * produces it, because a result is the implementation's to name — the contract
 * says only that it is answered.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces';
import { nothing, rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type {
  ICreateInterfaceParams,
  IDeleteInterfaceParams,
  IInterfaceConfig,
  IUpdateInterfaceSourceParams,
} from '@mcp-abap-adt/interfaces';

/**
 * What ADT answers when the object is created: the created object's
 * metadata document, handed over as it arrived. Decision 5 leaves parsing to
 * whoever wants a shape out of it.
 */
export type InterfaceCreated = string;

/**
 * The ABAP source, from `/source/main`.
 *
 * Empty is a legitimate answer and is not, on its own, "it is not there": ADT
 * answers a read for a missing object with 200 and no body rather than 404. A
 * caller who needs those told apart supplies `analyse`.
 */
export type InterfaceSource = string;

/**
 * The object's metadata document, from the object resource itself.
 */
export type InterfaceMetadata = string;

/**
 * What a check run answers: `chkl:messages`, whose `<msg type="E">` entries
 * are the verdict. The status is not — ADT answers a refusal inside a 200.
 */
export type InterfaceCheckResult = string;

/**
 * What activation answers: `chkl:messages` again.
 *
 * `activationExecuted="false"` means no work was done, not that work failed.
 */
export type InterfaceActivationResult = string;

/**
 * What name validation answers.
 */
export type InterfaceValidationResult = string;

/**
 * What a deletion answers: `del:deletionResult`, whose `del:isDeleted="false"`
 * with a reason means the object is still there — inside a 200.
 */
export type InterfaceDeletionResult = string;

/**
 * A source upload writes; ADT answers it with nothing worth reading.
 */
export type InterfaceUpdated = void;

/**
 * The transport document for the object, from its `objectstates` resource.
 */
export type InterfaceTransport = string;

/** One strategy per member of a interface implementation. See `IClassResults`. */
export interface IInterfaceResults<
  TCreated = InterfaceCreated,
  TSource = InterfaceSource,
  TMetadata = InterfaceMetadata,
  TCheck = InterfaceCheckResult,
  TActivation = InterfaceActivationResult,
  TValidation = InterfaceValidationResult,
  TDeletion = InterfaceDeletionResult,
  TUpdated = InterfaceUpdated,
  TTransport = InterfaceTransport,
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
export const interfaceDocuments = {
  created: rawDocument,
  source: rawDocument,
  metadata: rawDocument,
  check: rawDocument,
  activation: rawDocument,
  validation: rawDocument,
  deletion: rawDocument,
  updated: nothing,
  transport: rawDocument,
} satisfies IInterfaceResults;

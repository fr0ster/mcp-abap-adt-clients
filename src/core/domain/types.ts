/**
 * Domain module type definitions.
 *
 * `IDomainState` is gone with the other state bags: a member now answers what
 * its own endpoint produced, and a failure carries the request that produced it.
 * What each member answers is declared here, beside the implementation that
 * produces it, because a result is the implementation's to name — the contract
 * says only that it is answered.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces';
import { rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type {
  ICreateDomainParams,
  IDeleteDomainParams,
  IDomainConfig,
  IUpdateDomainParams,
} from '@mcp-abap-adt/interfaces';

/**
 * What the create answers: the domain's XML document.
 */
export type DomainCreated = string;

/**
 * What `read` answers: the object's XML document.
 *
 * This type has no source — `read` and `readMetadata` fetch the same resource,
 * and the `version` argument is accepted and ignored.
 *
 * Measured: a read of an object that is not ready answers 200 with an **empty**
 * body, which silently corrupts a read-modify-write. A caller doing one supplies
 * an `analyse` that calls an empty body a failure.
 */
export type DomainSource = string;

/**
 * The domain's XML document — the same resource `read` fetches.
 */
export type DomainMetadata = string;

/**
 * What a check run answers: `chkl:messages`, whose `<msg type="E">` entries are
 * the verdict. The status is not — ADT answers a refusal inside a 200.
 */
export type DomainCheckResult = string;

/**
 * What activation answers: `chkl:messages` again.
 */
export type DomainActivationResult = string;

/**
 * What name validation answers. The endpoint refuses an empty description.
 */
export type DomainValidationResult = string;

/**
 * What the deletion answers.
 */
export type DomainDeletionResult = string;

/**
 * What the XML write answers.
 *
 * The write is a read-modify-write: `updateDomain` GETs the current document,
 * patches the changed fields and PUTs it back.
 */
export type DomainUpdated = string;

/**
 * The transport document for the domain.
 */
export type DomainTransport = string;

/** One strategy per member of a domain implementation. See `IClassResults`. */
export interface IDomainResults<
  TCreated = DomainCreated,
  TSource = DomainSource,
  TMetadata = DomainMetadata,
  TCheck = DomainCheckResult,
  TActivation = DomainActivationResult,
  TValidation = DomainValidationResult,
  TDeletion = DomainDeletionResult,
  TUpdated = DomainUpdated,
  TTransport = DomainTransport,
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
export const domainDocuments = {
  created: rawDocument,
  source: rawDocument,
  metadata: rawDocument,
  check: rawDocument,
  activation: rawDocument,
  validation: rawDocument,
  deletion: rawDocument,
  updated: rawDocument,
  transport: rawDocument,
} satisfies IDomainResults;

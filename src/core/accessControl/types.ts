/**
 * AccessControl module type definitions.
 *
 * `IAccessControlState` is gone with the other state bags: a member now answers what
 * its own endpoint produced, and a failure carries the request that produced it.
 * What each member answers is declared here, beside the implementation that
 * produces it, because a result is the implementation's to name — the contract
 * says only that it is answered.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces';
import { rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type {
  IAccessControlConfig,
  ICreateAccessControlParams,
  IDeleteAccessControlParams,
  IUpdateAccessControlParams,
} from '@mcp-abap-adt/interfaces';

/**
 * What the create answers: the object's metadata document.
 */
export type AccessControlCreated = string;

/**
 * The object's source, from `/source/main`.
 *
 * Empty is a legitimate answer and is not, on its own, absence: ADT answers a
 * read for a missing object with 200 and no body rather than 404.
 */
export type AccessControlSource = string;

/**
 * The object's metadata document.
 */
export type AccessControlMetadata = string;

/**
 * What a check run answers: `chkl:messages`, whose `<msg type="E">` entries are
 * the verdict. The status is not — ADT answers a refusal inside a 200.
 */
export type AccessControlCheckResult = string;

/**
 * What activation answers: `chkl:messages` again.
 */
export type AccessControlActivationResult = string;

/**
 * What name validation answers.
 */
export type AccessControlValidationResult = string;

/**
 * What the deletion answers.
 */
export type AccessControlDeletionResult = string;

/**
 * What the source write answers.
 */
export type AccessControlUpdated = string;

/**
 * The transport document for the object.
 */
export type AccessControlTransport = string;

/** One strategy per member of a accessControl implementation. See `IClassResults`. */
export interface IAccessControlResults<
  TCreated = AccessControlCreated,
  TSource = AccessControlSource,
  TMetadata = AccessControlMetadata,
  TCheck = AccessControlCheckResult,
  TActivation = AccessControlActivationResult,
  TValidation = AccessControlValidationResult,
  TDeletion = AccessControlDeletionResult,
  TUpdated = AccessControlUpdated,
  TTransport = AccessControlTransport,
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
export const accessControlDocuments = {
  created: rawDocument,
  source: rawDocument,
  metadata: rawDocument,
  check: rawDocument,
  activation: rawDocument,
  validation: rawDocument,
  deletion: rawDocument,
  updated: rawDocument,
  transport: rawDocument,
} satisfies IAccessControlResults;

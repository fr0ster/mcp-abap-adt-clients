/**
 * AuthorizationField module type definitions.
 *
 * `IAuthorizationFieldState` is gone with the other state bags: a member now answers what
 * its own endpoint produced, and a failure carries the request that produced it.
 * What each member answers is declared here, beside the implementation that
 * produces it, because a result is the implementation's to name — the contract
 * says only that it is answered.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces';

export type { IDeleteAuthorizationFieldParams } from './delete';

import { rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type {
  IAuthorizationFieldConfig,
  ICreateAuthorizationFieldParams,
} from '@mcp-abap-adt/interfaces';

/**
 * What the create answers: the field's document.
 */
export type AuthorizationFieldCreated = string;

/**
 * What `read` answers: the field's XML document.
 *
 * An authorization field has no source — `read` and `readMetadata` fetch the
 * same resource.
 */
export type AuthorizationFieldSource = string;

/**
 * The same document `read` fetches.
 */
export type AuthorizationFieldMetadata = string;

/**
 * What a check run answers: `chkl:messages`, whose `<msg type="E">` entries are
 * the verdict. The status is not — ADT answers a refusal inside a 200.
 */
export type AuthorizationFieldCheckResult = string;

/**
 * What activation answers: `chkl:messages` again.
 */
export type AuthorizationFieldActivationResult = string;

/**
 * What name validation answers. The endpoint refuses an empty description.
 */
export type AuthorizationFieldValidationResult = string;

/**
 * What the deletion answers.
 */
export type AuthorizationFieldDeletionResult = string;

/**
 * What the XML write answers.
 */
export type AuthorizationFieldUpdated = string;

/** One strategy per member of a authorizationField implementation. See `IClassResults`. */
export interface IAuthorizationFieldResults<
  TCreated = AuthorizationFieldCreated,
  TSource = AuthorizationFieldSource,
  TMetadata = AuthorizationFieldMetadata,
  TCheck = AuthorizationFieldCheckResult,
  TActivation = AuthorizationFieldActivationResult,
  TValidation = AuthorizationFieldValidationResult,
  TDeletion = AuthorizationFieldDeletionResult,
  TUpdated = AuthorizationFieldUpdated,
> {
  readonly created: IResultStrategy<TCreated>;
  readonly source: IResultStrategy<TSource>;
  readonly metadata: IResultStrategy<TMetadata>;
  readonly check: IResultStrategy<TCheck>;
  readonly activation: IResultStrategy<TActivation>;
  readonly validation: IResultStrategy<TValidation>;
  readonly deletion: IResultStrategy<TDeletion>;
  readonly updated: IResultStrategy<TUpdated>;
}

/**
 * The shipped default: every member answers its document as it arrived.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const authorizationFieldDocuments = {
  created: rawDocument,
  source: rawDocument,
  metadata: rawDocument,
  check: rawDocument,
  activation: rawDocument,
  validation: rawDocument,
  deletion: rawDocument,
  updated: rawDocument,
} satisfies IAuthorizationFieldResults;

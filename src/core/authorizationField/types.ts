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
import type { DeletionCheckResult } from '../shared/results';

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
export interface IAuthorizationFieldResults {
  readonly created: IResultStrategy<unknown>;
  readonly source: IResultStrategy<unknown>;
  readonly metadata: IResultStrategy<unknown>;
  readonly check: IResultStrategy<unknown>;
  readonly activation: IResultStrategy<unknown>;
  readonly validation: IResultStrategy<unknown>;
  readonly deletion: IResultStrategy<unknown>;
  readonly metadataUpdated: IResultStrategy<unknown>;
  /** What a deletion check answers: `del:checkResponse`. */
  readonly deletionCheck: IResultStrategy<unknown>;
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
  metadataUpdated: rawDocument,
  deletionCheck: rawDocument,
} satisfies IAuthorizationFieldResults;

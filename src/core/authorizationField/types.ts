/**
 * AuthorizationField module type definitions.
 *
 * `IAuthorizationFieldState` is gone with the other state bags: a member now answers what
 * its own endpoint produced, and a failure carries the request that produced it.
 * What each member answers is declared here, beside the implementation that
 * produces it, because a result is the implementation's to name — the contract
 * says only that it is answered.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces-adt';

export type { IDeleteAuthorizationFieldParams } from './delete';

import { rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type { IAuthorizationFieldConfig } from '@mcp-abap-adt/interfaces-adt';

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

/**
 * The shapes below describe the argument of the request builders in this
 * module, and they used to be declared in `@mcp-abap-adt/interfaces`. Nobody
 * outside this package ever accepted them — no parameter, field or return
 * anywhere else was typed by one — and being nobody's contract is how 85 of
 * their fields came to be ignored by the very code that took them, for
 * releases, unnoticed. They live here now, beside the function that reads
 * them, which is the only place that can keep them honest. See decision 30 in
 * the interfaces repository.
 */

export interface ICreateAuthorizationFieldParams {
  authorization_field_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  master_system?: string;
  responsible?: string;

  field_name?: string;
  roll_name?: string;
  check_table?: string;
  exit_fb?: string;
  abap_language_version?: string;
  search?: string;
  objexit?: string;
  domname?: string;
  outputlen?: string;
  convexit?: string;
  orglvlinfo?: string;
  col_searchhelp?: string;
  col_searchhelp_name?: string;
  col_searchhelp_descr?: string;
}

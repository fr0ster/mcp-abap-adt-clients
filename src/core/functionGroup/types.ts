/**
 * FunctionGroup module type definitions.
 *
 * `IFunctionGroupState` is gone with the other state bags: a member now answers what
 * its own endpoint produced, and a failure carries the request that produced it.
 * What each member answers is declared here, beside the implementation that
 * produces it, because a result is the implementation's to name — the contract
 * says only that it is answered.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces';
import { rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type {
  ICreateFunctionGroupParams,
  IDeleteFunctionGroupParams,
  IFunctionGroupConfig,
  IUpdateFunctionGroupParams,
} from '@mcp-abap-adt/interfaces';

/**
 * What `POST /sap/bc/adt/functions/groups` answers: the created group's
 * metadata document.
 *
 * Until this migration `create` answered a *read* performed afterwards, and the
 * create's own response was discarded. What the create answered is what a create
 * returns.
 */
export type FunctionGroupCreated = string;

/**
 * A function group has no source of its own — it is a container, and `read`
 * fetches its metadata document. The `version` argument is accepted and ignored
 * for the same reason.
 */
export type FunctionGroupSource = string;

/**
 * The group's metadata document. The same resource `read` fetches, since there
 * is no source to tell it apart from.
 */
export type FunctionGroupMetadata = string;

/**
 * What a check run answers: `chkl:messages`, whose `<msg type="E">` entries are
 * the verdict. The status is not — ADT answers a refusal inside a 200.
 */
export type FunctionGroupCheckResult = string;

/**
 * What activation answers: `chkl:messages` again.
 */
export type FunctionGroupActivationResult = string;

/**
 * What validation answers.
 *
 * Measured: a *failure* arrives inside a 200 as `<SEVERITY>ERROR</SEVERITY>`
 * with the reason in `<SHORT_TEXT>`, which is why {@link validationSeverity}
 * reads the document rather than the status.
 */
export type FunctionGroupValidationResult = string;

/**
 * What the deletion answers.
 */
export type FunctionGroupDeletionResult = string;

/**
 * What the metadata update answers. A function group is a container: the only
 * thing `update` changes is its description.
 */
export type FunctionGroupUpdated = string;

/**
 * The transport document for the group, from its `objectstates` resource.
 */
export type FunctionGroupTransport = string;

/** One strategy per member of a functionGroup implementation. See `IClassResults`. */
export interface IFunctionGroupResults<
  TCreated = FunctionGroupCreated,
  TSource = FunctionGroupSource,
  TMetadata = FunctionGroupMetadata,
  TCheck = FunctionGroupCheckResult,
  TActivation = FunctionGroupActivationResult,
  TValidation = FunctionGroupValidationResult,
  TDeletion = FunctionGroupDeletionResult,
  TUpdated = FunctionGroupUpdated,
  TTransport = FunctionGroupTransport,
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
export const functionGroupDocuments = {
  created: rawDocument,
  source: rawDocument,
  metadata: rawDocument,
  check: rawDocument,
  activation: rawDocument,
  validation: rawDocument,
  deletion: rawDocument,
  updated: rawDocument,
  transport: rawDocument,
} satisfies IFunctionGroupResults;

/**
 * FunctionModule module type definitions.
 *
 * `IFunctionModuleState` is gone with the other state bags: a member now answers what
 * its own endpoint produced, and a failure carries the request that produced it.
 * What each member answers is declared here, beside the implementation that
 * produces it, because a result is the implementation's to name — the contract
 * says only that it is answered.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces-adt';
import { rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type {
  ICreateFunctionModuleParams,
  IFunctionModuleConfig,
} from '@mcp-abap-adt/interfaces-adt';

/**
 * What the create answers: the module's metadata document.
 */
export type FunctionModuleCreated = string;

/**
 * The module's ABAP source, from its `/source/main` under the group.
 *
 * Empty is a legitimate answer and is not, on its own, absence: ADT answers a
 * read for a missing object with 200 and no body rather than 404.
 */
export type FunctionModuleSource = string;

/**
 * The module's metadata document.
 */
export type FunctionModuleMetadata = string;

/**
 * What a check run answers: `chkl:messages`, whose `<msg type="E">` entries are
 * the verdict. The status is not — ADT answers a refusal inside a 200.
 */
export type FunctionModuleCheckResult = string;

/**
 * What activation answers: `chkl:messages` again.
 */
export type FunctionModuleActivationResult = string;

/**
 * What name validation answers.
 */
export type FunctionModuleValidationResult = string;

/**
 * What the deletion answers.
 */
export type FunctionModuleDeletionResult = string;

/**
 * What the source write answers.
 *
 * Until this migration `update` answered a *read* performed afterwards, or the
 * activation when one was asked for. What the write answered is what an update
 * returns.
 */
export type FunctionModuleUpdated = string;

/**
 * The transport document for the module, from its `objectstates` resource.
 */
export type FunctionModuleTransport = string;

/** One strategy per member of a functionModule implementation. See `IClassResults`. */
export interface IFunctionModuleResults {
  readonly created: IResultStrategy<unknown>;
  readonly source: IResultStrategy<unknown>;
  readonly metadata: IResultStrategy<unknown>;
  readonly check: IResultStrategy<unknown>;
  readonly activation: IResultStrategy<unknown>;
  readonly validation: IResultStrategy<unknown>;
  readonly deletion: IResultStrategy<unknown>;
  readonly updated: IResultStrategy<unknown>;
  readonly transport: IResultStrategy<unknown>;
  /** What a deletion check answers: `del:checkResponse`. */
  readonly deletionCheck: IResultStrategy<unknown>;
}

/**
 * The shipped default: every member answers its document as it arrived.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const functionModuleDocuments = {
  created: rawDocument,
  source: rawDocument,
  metadata: rawDocument,
  check: rawDocument,
  activation: rawDocument,
  validation: rawDocument,
  deletion: rawDocument,
  updated: rawDocument,
  transport: rawDocument,
  deletionCheck: rawDocument,
} satisfies IFunctionModuleResults;

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

export interface IDeleteFunctionModuleParams {
  function_module_name: string;
  function_group_name: string;
  transport_request?: string;
}

export interface IUpdateFunctionModuleParams {
  functionGroupName: string;
  functionModuleName: string;
  lockHandle: string;
  sourceCode: string;
  transportRequest?: string;
}

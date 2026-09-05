/**
 * FunctionInclude module type definitions.
 *
 * `IFunctionIncludeState` is gone with the other state bags: a member now answers what
 * its own endpoint produced, and a failure carries the request that produced it.
 * What each member answers is declared here, beside the implementation that
 * produces it, because a result is the implementation's to name — the contract
 * says only that it is answered.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces';

export type { IDeleteFunctionIncludeParams } from './delete';

import { rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type {
  ICreateFunctionIncludeParams,
  IFunctionIncludeConfig,
} from '@mcp-abap-adt/interfaces';

/**
 * What the create answers: the include's `finclude` metadata document.
 */
export type FunctionIncludeCreated = string;

/**
 * The include's ABAP source, from its `/source/main` under the group.
 *
 * Empty is a legitimate answer and is not, on its own, absence.
 */
export type FunctionIncludeSource = string;

/**
 * The include's `finclude` metadata document.
 *
 * A separate resource from the source, and the only one that takes
 * `withLongPolling` — which is why the readiness polls after a write read this
 * rather than the source.
 */
export type FunctionIncludeMetadata = string;

/**
 * What a check run answers: `chkl:messages`, whose `<msg type="E">` entries are
 * the verdict. The status is not — ADT answers a refusal inside a 200.
 */
export type FunctionIncludeCheckResult = string;

/**
 * What activation answers: `chkl:messages` again.
 */
export type FunctionIncludeActivationResult = string;

/**
 * What validation answers.
 *
 * There is no validation resource for a function include: this probes the parent
 * function group's existence instead, which is the only thing that can be
 * checked before the POST.
 */
export type FunctionIncludeValidationResult = string;

/**
 * What the deletion answers.
 */
export type FunctionIncludeDeletionResult = string;

/**
 * What the metadata update answers.
 *
 * An update writes metadata and, when source was given, the source after it. The
 * answer is the metadata write's: it is the request `update` is named for, and
 * the source upload's answer is reachable through the same set's `source` when a
 * consumer asks for one.
 */
export type FunctionIncludeUpdated = string;

/** One strategy per member of a functionInclude implementation. See `IClassResults`. */
export interface IFunctionIncludeResults<
  TCreated = FunctionIncludeCreated,
  TSource = FunctionIncludeSource,
  TMetadata = FunctionIncludeMetadata,
  TCheck = FunctionIncludeCheckResult,
  TActivation = FunctionIncludeActivationResult,
  TValidation = FunctionIncludeValidationResult,
  TDeletion = FunctionIncludeDeletionResult,
  TUpdated = FunctionIncludeUpdated,
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
export const functionIncludeDocuments = {
  created: rawDocument,
  source: rawDocument,
  metadata: rawDocument,
  check: rawDocument,
  activation: rawDocument,
  validation: rawDocument,
  deletion: rawDocument,
  updated: rawDocument,
} satisfies IFunctionIncludeResults;

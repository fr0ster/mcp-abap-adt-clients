/**
 * ScalarFunction module type definitions.
 *
 * `IScalarFunctionState` is gone with the other state bags: a member now answers what
 * its own endpoint produced, and a failure carries the request that produced it.
 * What each member answers is declared here, beside the implementation that
 * produces it, because a result is the implementation's to name — the contract
 * says only that it is answered.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces-adt';
import { rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type { IScalarFunctionConfig } from '@mcp-abap-adt/interfaces-adt';

/**
 * What the create answers: the function's metadata document.
 */
export type ScalarFunctionCreated = string;

/**
 * The function's DDL source, from `/source/main`.
 *
 * Empty is a legitimate answer and is not, on its own, absence.
 */
export type ScalarFunctionSource = string;

/**
 * The function's metadata document.
 */
export type ScalarFunctionMetadata = string;

/**
 * What a check run answers: `chkl:messages`, whose `<msg type="E">` entries are
 * the verdict. The status is not — ADT answers a refusal inside a 200.
 */
export type ScalarFunctionCheckResult = string;

/**
 * What activation answers: `chkl:messages` again.
 *
 * Measured: activating a scalar function needs a companion AMDP method to exist,
 * so an activation refused for that reason is the system stating a real
 * dependency, not a defect here.
 */
export type ScalarFunctionActivationResult = string;

/**
 * What name validation answers, where the system has the resource.
 *
 * Some systems answer 404, 405 or 501 for it — see
 * {@link validationUnsupported}.
 */
export type ScalarFunctionValidationResult = string;

/**
 * What the deletion answers.
 */
export type ScalarFunctionDeletionResult = string;

/**
 * What the source write answers.
 */
export type ScalarFunctionUpdated = string;

/**
 * The transport document for the function.
 */
export type ScalarFunctionTransport = string;

/** One strategy per member of a scalarFunction implementation. See `IClassResults`. */
export interface IScalarFunctionResults {
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
export const scalarFunctionDocuments = {
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
} satisfies IScalarFunctionResults;

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

export interface ICreateScalarFunctionParams {
  scalar_function_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  masterSystem?: string;
  responsible?: string;
  masterLanguage?: string;
}

export interface IDeleteScalarFunctionParams {
  scalar_function_name: string;
  transport_request?: string;
}

export interface IUpdateScalarFunctionParams {
  scalar_function_name: string;
  source_code: string;
  transport_request?: string;
}

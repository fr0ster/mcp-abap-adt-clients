/**
 * ScalarFunctionImplementation module type definitions.
 *
 * `IScalarFunctionImplementationState` is gone with the other state bags: a member now answers what
 * its own endpoint produced, and a failure carries the request that produced it.
 * What each member answers is declared here, beside the implementation that
 * produces it, because a result is the implementation's to name — the contract
 * says only that it is answered.
 */

import type {
  IResultStrategy,
  ScalarFunctionEngine,
} from '@mcp-abap-adt/interfaces-adt';
import { rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type {
  IScalarFunctionImplementationConfig,
  ScalarFunctionEngine,
} from '@mcp-abap-adt/interfaces-adt';

/**
 * What the create answers: the implementation's metadata document.
 */
export type ScalarFunctionImplementationCreated = string;

/**
 * What `/source/main` answers — **JSON**, not DDL.
 *
 * This object is asymmetric: the source is read and written as JSON while the
 * metadata is blues v2 XML on a different resource. That is the endpoint's
 * shape, not a choice made here.
 */
export type ScalarFunctionImplementationSource = string;

/**
 * The implementation's metadata document (blues v2 XML), from `/dsfi/{name}`.
 */
export type ScalarFunctionImplementationMetadata = string;

/**
 * What a check run answers: `chkl:messages`, whose `<msg type="E">` entries are
 * the verdict. The status is not — ADT answers a refusal inside a 200.
 */
export type ScalarFunctionImplementationCheckResult = string;

/**
 * What activation answers.
 *
 * Measured: the trio — definition, AMDP class and implementation — activates
 * together, and activating this alone is refused. Group activation is the
 * consumer's to orchestrate.
 */
export type ScalarFunctionImplementationActivationResult = string;

/**
 * What name validation answers, where the system has the resource.
 */
export type ScalarFunctionImplementationValidationResult = string;

/**
 * What the deletion answers.
 */
export type ScalarFunctionImplementationDeletionResult = string;

/**
 * What the source write answers.
 */
export type ScalarFunctionImplementationUpdated = string;

/**
 * The transport document for the implementation.
 */
export type ScalarFunctionImplementationTransport = string;

/** One strategy per member of a scalarFunctionImplementation implementation. See `IClassResults`. */
export interface IScalarFunctionImplementationResults {
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
  /** What the object's own document answers when written. */
  readonly metadataUpdated: IResultStrategy<unknown>;
}

/**
 * The shipped default: every member answers its document as it arrived.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const scalarFunctionImplementationDocuments = {
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
  metadataUpdated: rawDocument,
} satisfies IScalarFunctionImplementationResults;

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

export interface ICreateScalarFunctionImplementationParams {
  implementation_name: string;
  scalar_function_name: string;
  engine_value?: ScalarFunctionEngine;
  description?: string;
  package_name: string;
  transport_request?: string;
  masterSystem?: string;
  responsible?: string;
  masterLanguage?: string;
}

export interface IDeleteScalarFunctionImplementationParams {
  implementation_name: string;
  transport_request?: string;
}

export interface IUpdateScalarFunctionImplementationParams {
  implementation_name: string;
  source_code: string;
  transport_request?: string;
}

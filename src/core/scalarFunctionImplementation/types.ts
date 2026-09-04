/**
 * ScalarFunctionImplementation module type definitions.
 *
 * `IScalarFunctionImplementationState` is gone with the other state bags: a member now answers what
 * its own endpoint produced, and a failure carries the request that produced it.
 * What each member answers is declared here, beside the implementation that
 * produces it, because a result is the implementation's to name — the contract
 * says only that it is answered.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces';
import { rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type {
  ICreateScalarFunctionImplementationParams,
  IDeleteScalarFunctionImplementationParams,
  IScalarFunctionImplementationConfig,
  IUpdateScalarFunctionImplementationParams,
  ScalarFunctionEngine,
} from '@mcp-abap-adt/interfaces';

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
export interface IScalarFunctionImplementationResults<
  TCreated = ScalarFunctionImplementationCreated,
  TSource = ScalarFunctionImplementationSource,
  TMetadata = ScalarFunctionImplementationMetadata,
  TCheck = ScalarFunctionImplementationCheckResult,
  TActivation = ScalarFunctionImplementationActivationResult,
  TValidation = ScalarFunctionImplementationValidationResult,
  TDeletion = ScalarFunctionImplementationDeletionResult,
  TUpdated = ScalarFunctionImplementationUpdated,
  TTransport = ScalarFunctionImplementationTransport,
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
} satisfies IScalarFunctionImplementationResults;

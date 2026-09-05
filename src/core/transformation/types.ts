/**
 * Transformation module type definitions.
 *
 * `ITransformationState` is gone with the other state bags: a member now answers what
 * its own endpoint produced, and a failure carries the request that produced it.
 * What each member answers is declared here, beside the implementation that
 * produces it, because a result is the implementation's to name — the contract
 * says only that it is answered.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces';
import { rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type {
  ICreateTransformationParams,
  IDeleteTransformationParams,
  ITransformationConfig,
  IUpdateTransformationParams,
  TransformationType,
} from '@mcp-abap-adt/interfaces';

/**
 * What the create answers: the transformation's metadata document.
 */
export type TransformationCreated = string;

/**
 * The object's source, from `/source/main`.
 *
 * Empty is a legitimate answer and is not, on its own, absence.
 */
export type TransformationSource = string;

/**
 * The transformation's metadata document.
 */
export type TransformationMetadata = string;

/**
 * What a check run answers: `chkl:messages`, whose `<msg type="E">` entries are
 * the verdict. The status is not — ADT answers a refusal inside a 200.
 */
export type TransformationCheckResult = string;

/**
 * What activation answers: `chkl:messages` again.
 */
export type TransformationActivationResult = string;

/**
 * What name validation answers, where the system has the resource.
 *
 * Measured: a cloud trial answers 404 for it — see {@link validationUnavailable},
 * which is why a missing resource is not reported as a rejected name.
 */
export type TransformationValidationResult = string;

/**
 * What the deletion answers.
 */
export type TransformationDeletionResult = string;

/**
 * What the source write answers.
 */
export type TransformationUpdated = string;

/**
 * The transport document for the transformation.
 */
export type TransformationTransport = string;

/** One strategy per member of a transformation implementation. See `IClassResults`. */
export interface ITransformationResults<
  TCreated = TransformationCreated,
  TSource = TransformationSource,
  TMetadata = TransformationMetadata,
  TCheck = TransformationCheckResult,
  TActivation = TransformationActivationResult,
  TValidation = TransformationValidationResult,
  TDeletion = TransformationDeletionResult,
  TUpdated = TransformationUpdated,
  TTransport = TransformationTransport,
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
export const transformationDocuments = {
  created: rawDocument,
  source: rawDocument,
  metadata: rawDocument,
  check: rawDocument,
  activation: rawDocument,
  validation: rawDocument,
  deletion: rawDocument,
  updated: rawDocument,
  transport: rawDocument,
} satisfies ITransformationResults;

/**
 * MetadataExtension module type definitions.
 *
 * `IMetadataExtensionState` is gone with the other state bags: a member now answers what
 * its own endpoint produced, and a failure carries the request that produced it.
 * What each member answers is declared here, beside the implementation that
 * produces it, because a result is the implementation's to name — the contract
 * says only that it is answered.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces';
import { rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type {
  IMetadataExtensionConfig,
  IMetadataExtensionCreateParams,
  IMetadataExtensionValidationParams,
} from '@mcp-abap-adt/interfaces';

/**
 * What the create answers: the object's metadata document.
 */
export type MetadataExtensionCreated = string;

/**
 * The object's source, from `/source/main`.
 *
 * Empty is a legitimate answer and is not, on its own, absence: ADT answers a
 * read for a missing object with 200 and no body rather than 404.
 */
export type MetadataExtensionSource = string;

/**
 * The object's metadata document.
 */
export type MetadataExtensionMetadata = string;

/**
 * What a check run answers: `chkl:messages`, whose `<msg type="E">` entries are
 * the verdict. The status is not — ADT answers a refusal inside a 200.
 */
export type MetadataExtensionCheckResult = string;

/**
 * What activation answers: `chkl:messages` again.
 */
export type MetadataExtensionActivationResult = string;

/**
 * What name validation answers.
 */
export type MetadataExtensionValidationResult = string;

/**
 * What the DELETE answers.
 *
 * There is no deletion-check resource for a DDLX source: the DELETE is the only
 * request, and its own answer is the verdict.
 */
export type MetadataExtensionDeletionResult = string;

/**
 * What the source write answers.
 */
export type MetadataExtensionUpdated = string;

/**
 * The transport document for the object.
 */
export type MetadataExtensionTransport = string;

/** One strategy per member of a metadataExtension implementation. See `IClassResults`. */
export interface IMetadataExtensionResults<
  TCreated = MetadataExtensionCreated,
  TSource = MetadataExtensionSource,
  TMetadata = MetadataExtensionMetadata,
  TCheck = MetadataExtensionCheckResult,
  TActivation = MetadataExtensionActivationResult,
  TValidation = MetadataExtensionValidationResult,
  TDeletion = MetadataExtensionDeletionResult,
  TUpdated = MetadataExtensionUpdated,
  TTransport = MetadataExtensionTransport,
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
export const metadataExtensionDocuments = {
  created: rawDocument,
  source: rawDocument,
  metadata: rawDocument,
  check: rawDocument,
  activation: rawDocument,
  validation: rawDocument,
  deletion: rawDocument,
  updated: rawDocument,
  transport: rawDocument,
} satisfies IMetadataExtensionResults;

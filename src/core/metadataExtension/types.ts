/**
 * MetadataExtension module type definitions.
 *
 * `IMetadataExtensionState` is gone with the other state bags: a member now answers what
 * its own endpoint produced, and a failure carries the request that produced it.
 * What each member answers is declared here, beside the implementation that
 * produces it, because a result is the implementation's to name — the contract
 * says only that it is answered.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces-adt';
import { rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type { IMetadataExtensionConfig } from '@mcp-abap-adt/interfaces-adt';

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
export interface IMetadataExtensionResults {
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
  deletionCheck: rawDocument,
} satisfies IMetadataExtensionResults;

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

export interface IMetadataExtensionCreateParams {
  name: string;
  description: string;
  packageName: string;
  transportRequest?: string;
  masterLanguage?: string;
  masterSystem?: string;
  responsible?: string;
}

export interface IMetadataExtensionValidationParams {
  name: string;
  description: string;
  packageName: string;
}

/**
 * AppendStructure module type definitions.
 *
 * `IAppendStructureState` is gone with the other state bags: a member now answers what
 * its own endpoint produced, and a failure carries the request that produced it.
 * What each member answers is declared here, beside the implementation that
 * produces it, because a result is the implementation's to name — the contract
 * says only that it is answered.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces';
import { rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type {
  IAppendStructureConfig,
  ICreateAppendStructureParams,
  IDeleteAppendStructureParams,
  IUpdateAppendStructureParams,
} from '@mcp-abap-adt/interfaces';

/**
 * What the create answers: the append structure's metadata document.
 *
 * The create is metadata-only — it needs `baseObject`, and the fields come
 * through `update`.
 */
export type AppendStructureCreated = string;

/**
 * The append structure's DDL source, from `/source/main`.
 *
 * Empty is a legitimate answer and is not, on its own, absence.
 */
export type AppendStructureSource = string;

/**
 * The append structure's metadata document.
 */
export type AppendStructureMetadata = string;

/**
 * What a check run answers: `chkl:messages`, whose `<msg type="E">` entries are
 * the verdict. The status is not — ADT answers a refusal inside a 200.
 */
export type AppendStructureCheckResult = string;

/**
 * What activation answers: `chkl:messages` again.
 */
export type AppendStructureActivationResult = string;

/**
 * What name validation answers, where the system has the resource at all.
 *
 * Measured: some systems answer 404, 405 or 501 for it. That is not a verdict
 * about the name — see {@link validationUnsupported}.
 */
export type AppendStructureValidationResult = string;

/**
 * What the deletion answers.
 */
export type AppendStructureDeletionResult = string;

/**
 * What the source write answers.
 */
export type AppendStructureUpdated = string;

/**
 * The transport document for the object, from its `objectstates` resource.
 */
export type AppendStructureTransport = string;

/** One strategy per member of a appendStructure implementation. See `IClassResults`. */
export interface IAppendStructureResults<
  TCreated = AppendStructureCreated,
  TSource = AppendStructureSource,
  TMetadata = AppendStructureMetadata,
  TCheck = AppendStructureCheckResult,
  TActivation = AppendStructureActivationResult,
  TValidation = AppendStructureValidationResult,
  TDeletion = AppendStructureDeletionResult,
  TUpdated = AppendStructureUpdated,
  TTransport = AppendStructureTransport,
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
export const appendStructureDocuments = {
  created: rawDocument,
  source: rawDocument,
  metadata: rawDocument,
  check: rawDocument,
  activation: rawDocument,
  validation: rawDocument,
  deletion: rawDocument,
  updated: rawDocument,
  transport: rawDocument,
} satisfies IAppendStructureResults;

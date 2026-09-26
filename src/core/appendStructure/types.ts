/**
 * AppendStructure module type definitions.
 *
 * `IAppendStructureState` is gone with the other state bags: a member now answers what
 * its own endpoint produced, and a failure carries the request that produced it.
 * What each member answers is declared here, beside the implementation that
 * produces it, because a result is the implementation's to name — the contract
 * says only that it is answered.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces-adt';
import { rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type { IAppendStructureConfig } from '@mcp-abap-adt/interfaces-adt';

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
 * about the name — see `analyseUnsupportedStatus` in @mcp-abap-adt/adt-strategies.
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
export interface IAppendStructureResults {
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
  deletionCheck: rawDocument,
} satisfies IAppendStructureResults;

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

export interface ICreateAppendStructureParams {
  append_structure_name: string;
  base_object: string; // name of the base table OR structure being extended
  description?: string;
  package_name: string;
  transport_request?: string;
  masterSystem?: string;
  responsible?: string;
  masterLanguage?: string;
}

export interface IDeleteAppendStructureParams {
  append_structure_name: string;
  transport_request?: string;
}

export interface IUpdateAppendStructureParams {
  append_structure_name: string;
  source_code: string;
  transport_request?: string;
}

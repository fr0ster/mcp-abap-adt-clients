/**
 * Structure module type definitions.
 *
 * `IStructureState` is gone with the other state bags: a member now answers what
 * its own endpoint produced, and a failure carries the request that produced it.
 * What each member answers is declared here, beside the implementation that
 * produces it, because a result is the implementation's to name — the contract
 * says only that it is answered.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces';
import { rawDocument } from '../../utils/resultStrategy';
import type { DeletionCheckResult } from '../shared/results';

// Types defined in @mcp-abap-adt/interfaces
export type {
  ICreateStructureParams,
  IDeleteStructureParams,
  IStructureConfig,
  IUpdateStructureParams,
} from '@mcp-abap-adt/interfaces';

/**
 * What the create answers: the structure's metadata document.
 *
 * The create is metadata only — the fields come through `update`, which writes
 * DDL source.
 */
export type StructureCreated = string;

/**
 * The structure's DDL source, from `/source/main`.
 *
 * Empty is a legitimate answer and is not, on its own, absence.
 */
export type StructureSource = string;

/**
 * The structure's metadata document.
 */
export type StructureMetadata = string;

/**
 * What a check run answers: `chkl:messages`, whose `<msg type="E">` entries are
 * the verdict. The status is not — ADT answers a refusal inside a 200.
 */
export type StructureCheckResult = string;

/**
 * What activation answers: `chkl:messages` again.
 */
export type StructureActivationResult = string;

/**
 * What name validation answers.
 */
export type StructureValidationResult = string;

/**
 * What the deletion answers.
 */
export type StructureDeletionResult = string;

/**
 * What the DDL write answers.
 */
export type StructureUpdated = string;

/**
 * The transport document for the structure, from its `objectstates` resource.
 */
export type StructureTransport = string;

/** One strategy per member of a structure implementation. See `IClassResults`. */
export interface IStructureResults {
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
export const structureDocuments = {
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
} satisfies IStructureResults;

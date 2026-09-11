/**
 * TableType module type definitions.
 *
 * `ITableTypeState` is gone with the other state bags: a member now answers what
 * its own endpoint produced, and a failure carries the request that produced it.
 * What each member answers is declared here, beside the implementation that
 * produces it, because a result is the implementation's to name — the contract
 * says only that it is answered.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces';
import { rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type {
  ICreateTableTypeParams,
  IDeleteTableTypeParams,
  ITableTypeConfig,
  IUpdateTableTypeParams,
} from '@mcp-abap-adt/interfaces';

/**
 * What the create answers: the table type's metadata document.
 *
 * A table type is an XML-based entity, like a domain: the create makes an empty
 * one and the row type is set through `update`.
 */
export type TableTypeCreated = string;

/**
 * What `read` answers: the metadata document.
 *
 * A table type has no source of its own — `read` and `readMetadata` fetch the
 * same XML resource, and the `version` argument is accepted and ignored.
 */
export type TableTypeSource = string;

/**
 * The table type's metadata document.
 */
export type TableTypeMetadata = string;

/**
 * What a check run answers: `chkl:messages`, whose `<msg type="E">` entries are
 * the verdict. The status is not — ADT answers a refusal inside a 200.
 */
export type TableTypeCheckResult = string;

/**
 * What activation answers: `chkl:messages` again.
 */
export type TableTypeActivationResult = string;

/**
 * What name validation answers.
 */
export type TableTypeValidationResult = string;

/**
 * What the deletion answers.
 */
export type TableTypeDeletionResult = string;

/**
 * What the metadata write answers.
 */
export type TableTypeUpdated = string;

/**
 * The transport document for the table type.
 */
export type TableTypeTransport = string;

/** One strategy per member of a tableType implementation. See `IClassResults`. */
export interface ITableTypeResults {
  readonly created: IResultStrategy<unknown>;
  readonly source: IResultStrategy<unknown>;
  readonly metadata: IResultStrategy<unknown>;
  readonly check: IResultStrategy<unknown>;
  readonly activation: IResultStrategy<unknown>;
  readonly validation: IResultStrategy<unknown>;
  readonly deletion: IResultStrategy<unknown>;
  readonly metadataUpdated: IResultStrategy<unknown>;
  readonly transport: IResultStrategy<unknown>;
  /** What a deletion check answers: `del:checkResponse`. */
  readonly deletionCheck: IResultStrategy<unknown>;
}

/**
 * The shipped default: every member answers its document as it arrived.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const tableTypeDocuments = {
  created: rawDocument,
  source: rawDocument,
  metadata: rawDocument,
  check: rawDocument,
  activation: rawDocument,
  validation: rawDocument,
  deletion: rawDocument,
  metadataUpdated: rawDocument,
  transport: rawDocument,
  deletionCheck: rawDocument,
} satisfies ITableTypeResults;

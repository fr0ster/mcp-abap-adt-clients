/**
 * Table module type definitions.
 *
 * `ITableState` is gone with the other state bags: a member now answers what
 * its own endpoint produced, and a failure carries the request that produced it.
 * What each member answers is declared here, beside the implementation that
 * produces it, because a result is the implementation's to name — the contract
 * says only that it is answered.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces-adt';
import { rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type { ITableConfig } from '@mcp-abap-adt/interfaces-adt';

/**
 * What the create answers: the table's metadata document.
 */
export type TableCreated = string;

/**
 * The table's DDL source, from `/source/main`.
 *
 * Empty is a legitimate answer and is not, on its own, absence: ADT answers a
 * read for a missing object with 200 and no body rather than 404.
 */
export type TableSource = string;

/**
 * The table's metadata document.
 */
export type TableMetadata = string;

/**
 * What a check run answers: `chkl:messages`, whose `<msg type="E">` entries are
 * the verdict. The status is not — ADT answers a refusal inside a 200.
 */
export type TableCheckResult = string;

/**
 * What activation answers: `chkl:messages` again.
 */
export type TableActivationResult = string;

/**
 * What name validation answers.
 */
export type TableValidationResult = string;

/**
 * What the deletion answers.
 */
export type TableDeletionResult = string;

/**
 * What the DDL write answers.
 *
 * Until this migration `update` answered a *read* performed afterwards, or the
 * activation when one was asked for. What the write answered is what an update
 * returns.
 */
export type TableUpdated = string;

/**
 * The transport document for the table, from its `objectstates` resource.
 */
export type TableTransport = string;

/** One strategy per member of a table implementation. See `IClassResults`. */
export interface ITableResults {
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
export const tableDocuments = {
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
} satisfies ITableResults;

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

export interface ICreateTableParams {
  table_name: string;
  package_name: string;
  transport_request?: string;
  masterSystem?: string;
  responsible?: string;
  masterLanguage?: string;
}

export interface IDeleteTableParams {
  table_name: string;
  transport_request?: string;
}

export interface IUpdateTableParams {
  table_name: string;
  ddl_code: string;
  transport_request?: string;
}

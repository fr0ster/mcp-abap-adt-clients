/**
 * Table settings module type definitions.
 *
 * What each member answers is declared here, beside the implementation that
 * produces it, because a result is the implementation's to name — the contract
 * says only that it is answered.
 */

import type { ITableSettingsResults } from '@mcp-abap-adt/interfaces-adt';
import { rawDocument } from '../../utils/resultStrategy';

export type {
  ITableSettings,
  ITableSettingsConfig,
  ITableSettingsUpdateConfig,
} from '@mcp-abap-adt/interfaces-adt';

/**
 * The settings document a read answers: `ts:tableSettings`, with the table
 * as `adtcore:containerRef` and, on the cloud, `ts:isWritableByAMDP` (the
 * recorded reads, `corpus/adt/answers/read-table-settings-*`).
 */
export type TableSettingsMetadata = string;

/**
 * What a write answers: the settings document, `adtcore:version="inactive"`
 * in the recorded write (`write-table-settings-s4-2025--01-update`).
 */
export type TableSettingsUpdated = string;

/**
 * The shipped default: `readMetadata` and the writes answer their document as
 * it arrived. `lock` answers the lock handle and `unlock` nothing, whatever
 * the result set.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const tableSettingsDocuments = {
  metadata: rawDocument,
  metadataUpdated: rawDocument,
} satisfies ITableSettingsResults;

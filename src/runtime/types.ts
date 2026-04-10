import type { IAdtResponse } from '@mcp-abap-adt/interfaces';

/**
 * Marker interface for all runtime analysis domain objects.
 * These are NOT IAdtObject (not CRUD) — they represent
 * runtime analysis/monitoring capabilities.
 */
export type IRuntimeAnalysisObject = object;

/**
 * Generic listable runtime object.
 * Each domain supplies its own options type.
 */
export interface IListableRuntimeObject<TOptions = void>
  extends IRuntimeAnalysisObject {
  list(options?: TOptions): Promise<IAdtResponse>;
}

/**
 * Table operations - exports
 */

import type { IAdtSourceObject } from '@mcp-abap-adt/interfaces';
import type { ITableConfig, ITableState } from './types';

export { AdtTable } from './AdtTable';
export * from './types';

// Type alias for AdtTable
export type AdtTableType = IAdtSourceObject<ITableConfig, ITableState>;

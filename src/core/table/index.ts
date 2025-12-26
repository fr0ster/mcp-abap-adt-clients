/**
 * Table operations - exports
 */

import type { IAdtObject } from '@mcp-abap-adt/interfaces';
import type { ITableConfig, ITableState } from './types';

export { AdtTable } from './AdtTable';
export * from './types';

// Type alias for AdtTable
export type AdtTableType = IAdtObject<ITableConfig, ITableState>;

/**
 * Table operations - exports
 */

import { IAdtObject } from '@mcp-abap-adt/interfaces';
import { ITableConfig, ITableState } from './types';

export * from './types';
export { TableBuilder } from './TableBuilder';
export { AdtTable } from './AdtTable';

// Type alias for AdtTable
export type AdtTableType = IAdtObject<ITableConfig, ITableState>;

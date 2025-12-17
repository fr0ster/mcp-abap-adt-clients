/**
 * TableType operations - exports
 */

import { IAdtObject } from '@mcp-abap-adt/interfaces';
import { ITableTypeConfig, ITableTypeState } from './types';

export * from './types';
export { AdtDdicTableType } from './AdtDdicTableType';

// Type alias for AdtDdicTableType
export type AdtDdicTableTypeAlias = IAdtObject<ITableTypeConfig, ITableTypeState>;

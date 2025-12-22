/**
 * TableType operations - exports
 */

import type { IAdtObject } from '@mcp-abap-adt/interfaces';
import type { ITableTypeConfig, ITableTypeState } from './types';

export { AdtDdicTableType } from './AdtDdicTableType';
export * from './types';

// Type alias for AdtDdicTableType
export type AdtDdicTableTypeAlias = IAdtObject<
  ITableTypeConfig,
  ITableTypeState
>;

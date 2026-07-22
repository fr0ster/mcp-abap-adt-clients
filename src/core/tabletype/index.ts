/**
 * TableType operations - exports
 */

import type { IAdtSourceObject } from '@mcp-abap-adt/interfaces';
import type { ITableTypeConfig, ITableTypeState } from './types';

export { AdtDdicTableType } from './AdtDdicTableType';
export * from './types';

// Type alias for AdtDdicTableType
export type AdtDdicTableTypeAlias = IAdtSourceObject<
  ITableTypeConfig,
  ITableTypeState
>;

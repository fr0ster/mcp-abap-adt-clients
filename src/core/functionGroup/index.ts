/**
 * FunctionGroup operations - exports
 */

import type { IAdtObject } from '@mcp-abap-adt/interfaces';
import type { IFunctionGroupConfig, IFunctionGroupState } from './types';

export { AdtFunctionGroup } from './AdtFunctionGroup';
export { FunctionGroupBuilder } from './FunctionGroupBuilder';
export * from './types';

// Type alias for AdtFunctionGroup
export type AdtFunctionGroupType = IAdtObject<
  IFunctionGroupConfig,
  IFunctionGroupState
>;

/**
 * FunctionGroup operations - exports
 */

import { IAdtObject } from '@mcp-abap-adt/interfaces';
import { IFunctionGroupConfig, IFunctionGroupState } from './types';

export * from './types';
export { FunctionGroupBuilder } from './FunctionGroupBuilder';
export { AdtFunctionGroup } from './AdtFunctionGroup';

// Type alias for AdtFunctionGroup
export type AdtFunctionGroupType = IAdtObject<IFunctionGroupConfig, IFunctionGroupState>;

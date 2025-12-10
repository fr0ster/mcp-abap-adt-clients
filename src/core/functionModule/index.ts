/**
 * FunctionModule operations - exports
 */

import { IAdtObject } from '@mcp-abap-adt/interfaces';
import { IFunctionModuleConfig, IFunctionModuleState } from './types';

export * from './types';
export { FunctionModuleBuilder } from './FunctionModuleBuilder';
export { AdtFunctionModule } from './AdtFunctionModule';

// Type alias for AdtFunctionModule
export type AdtFunctionModuleType = IAdtObject<IFunctionModuleConfig, IFunctionModuleState>;

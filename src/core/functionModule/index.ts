/**
 * FunctionModule operations - exports
 */

import type { IAdtObject } from '@mcp-abap-adt/interfaces';
import type { IFunctionModuleConfig, IFunctionModuleState } from './types';

export { AdtFunctionModule } from './AdtFunctionModule';
export * from './types';

// Type alias for AdtFunctionModule
export type AdtFunctionModuleType = IAdtObject<
  IFunctionModuleConfig,
  IFunctionModuleState
>;

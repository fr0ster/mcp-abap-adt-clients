/**
 * FunctionModule module type definitions
 */

import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';

// Low-level function parameters — defined in @mcp-abap-adt/interfaces
export type {
  ICreateFunctionModuleParams,
  IDeleteFunctionModuleParams,
  IUpdateFunctionModuleParams,
} from '@mcp-abap-adt/interfaces';

// Builder configuration (camelCase)
// Note: packageName is required for create operations (validated in builder methods)
// description is required for create/validate operations
// sourceCode is required for create/update operations
export interface IFunctionModuleConfig {
  functionGroupName: string; // Required
  functionModuleName: string; // Required
  packageName?: string; // Required for create operations, optional for others
  transportRequest?: string; // Only optional parameter
  description?: string; // Required for create/validate operations, optional for others
  sourceCode?: string; // Required for create/update operations, optional for others
  masterSystem?: string; // SAP system ID (e.g. "E19") — required on on-premise
  responsible?: string; // User responsible for the object
  onLock?: (lockHandle: string) => void;
}

export interface IFunctionModuleState extends IAdtObjectState {
  // All operation results are in IAdtObjectState:
  // validationResponse, createResult, lockHandle, updateResult, checkResult,
  // unlockResult, activateResult, deleteResult, readResult, transportResult, errors
  // FunctionModule-specific fields can be added here if needed
}

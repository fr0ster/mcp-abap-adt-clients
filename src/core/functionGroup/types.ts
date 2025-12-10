/**
 * FunctionGroup module type definitions
 */

import { IAdtObjectState } from '@mcp-abap-adt/interfaces';

// Low-level function parameters (camelCase)
export interface ICreateFunctionGroupParams {
  functionGroupName: string;
  description: string;
  packageName: string;
  transportRequest?: string;
}

export interface IUpdateFunctionGroupParams {
  function_group_name: string;
  description?: string;
  transport_request?: string;
  lock_handle?: string;
}

export interface IDeleteFunctionGroupParams {
  function_group_name: string;
  transport_request?: string;
}

// Builder configuration (camelCase)
// Note: packageName is required for create operations (validated in builder methods)
// description is required for create/validate operations
export interface IFunctionGroupConfig {
  functionGroupName: string; // Required
  packageName?: string; // Required for create operations, optional for others
  transportRequest?: string; // Only optional parameter
  description?: string; // Required for create/validate operations, optional for others
  sessionId?: string;
  onLock?: (lockHandle: string) => void;
}

export interface IFunctionGroupState extends IAdtObjectState {
  // All operation results are in IAdtObjectState:
  // validationResponse, createResult, lockHandle, updateResult, checkResult,
  // unlockResult, activateResult, deleteResult, readResult, transportResult, errors
  // FunctionGroup-specific fields can be added here if needed
}

/**
 * FunctionModule module type definitions
 */

import { BaseBuilderState } from '../shared/IBuilder';

// Low-level function parameters (camelCase, matching Builder config)
export interface CreateFunctionModuleParams {
  functionGroupName: string;
  functionModuleName: string;
  description: string;
  transportRequest?: string;
}

export interface UpdateFunctionModuleParams {
  functionGroupName: string;
  functionModuleName: string;
  lockHandle: string;
  sourceCode: string;
  transportRequest?: string;
}

export interface DeleteFunctionModuleParams {
  function_module_name: string;
  function_group_name: string;
  transport_request?: string;
}

// Builder configuration (camelCase)
// Note: packageName is required for create operations (validated in builder methods)
// description is required for create/validate operations
// sourceCode is required for create/update operations
export interface FunctionModuleBuilderConfig {
  functionGroupName: string; // Required
  functionModuleName: string; // Required
  packageName?: string; // Required for create operations, optional for others
  transportRequest?: string; // Only optional parameter
  description?: string; // Required for create/validate operations, optional for others
  sourceCode?: string; // Required for create/update operations, optional for others
  onLock?: (lockHandle: string) => void;
}

export interface FunctionModuleBuilderState extends BaseBuilderState {
  // FunctionModule-specific state can be added here if needed
}

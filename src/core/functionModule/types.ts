/**
 * FunctionModule module type definitions
 */

import { BaseBuilderState } from '../shared/IBuilder';

// Low-level function parameters (snake_case)
export interface CreateFunctionModuleParams {
  function_group_name: string;
  function_module_name: string;
  source_code: string;
  package_name?: string; // optional: used to auto-create the function group if it doesn't exist
  description?: string;
  transport_request?: string;
  activate?: boolean;
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

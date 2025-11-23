/**
 * FunctionModule module type definitions
 */

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
export interface FunctionModuleBuilderConfig {
  functionGroupName: string;
  functionModuleName: string;
  packageName?: string;
  transportRequest?: string;
  description: string;
  sourceCode?: string;
  onLock?: (lockHandle: string) => void;
}

export interface FunctionModuleBuilderState {
  validationResult?: any;
  createResult?: any;
  lockHandle?: string;
  updateResult?: any;
  checkResult?: any;
  unlockResult?: any;
  activateResult?: any;
  deleteResult?: any;
  readResult?: any;
  errors: Array<{ method: string; error: Error; timestamp: Date }>;
}

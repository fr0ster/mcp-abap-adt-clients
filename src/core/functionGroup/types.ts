/**
 * FunctionGroup module type definitions
 */

// Low-level function parameters (snake_case)
export interface CreateFunctionGroupParams {
  function_group_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  activate?: boolean;
}

export interface UpdateFunctionGroupParams {
  function_group_name: string;
  description?: string;
  transport_request?: string;
  lock_handle?: string;
}

export interface DeleteFunctionGroupParams {
  function_group_name: string;
  transport_request?: string;
}

// Builder configuration (camelCase)
export interface FunctionGroupBuilderConfig {
  functionGroupName: string;
  packageName?: string;
  transportRequest?: string;
  description: string;
  sessionId?: string;
  onLock?: (lockHandle: string) => void;
}

export interface FunctionGroupBuilderState {
  validationResult?: any;
  createResult?: any;
  lockHandle?: string;
  checkResult?: any;
  unlockResult?: any;
  activateResult?: any;
  deleteResult?: any;
  readResult?: any;
  errors: Array<{ method: string; error: Error; timestamp: Date }>;
}

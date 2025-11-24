/**
 * FunctionGroup module type definitions
 */

import { BaseBuilderState } from '../shared/IBuilder';

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

export interface FunctionGroupBuilderState extends BaseBuilderState {
  // FunctionGroup-specific state can be added here if needed
}

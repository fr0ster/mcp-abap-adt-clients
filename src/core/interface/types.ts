/**
 * Interface module type definitions
 */

// Low-level function parameters (snake_case)
export interface CreateInterfaceParams {
  interface_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  master_system?: string;
  responsible?: string;
  source_code?: string;
  activate?: boolean;
}

export interface UpdateInterfaceSourceParams {
  interface_name: string;
  source_code: string;
  activate?: boolean;
}

export interface DeleteInterfaceParams {
  interface_name: string;
  transport_request?: string;
}

// Builder configuration (camelCase)
export interface InterfaceBuilderConfig {
  interfaceName: string;
  packageName?: string;
  transportRequest?: string;
  description: string;
  sourceCode?: string;
  sessionId?: string;
  onLock?: (lockHandle: string) => void;
}

export interface InterfaceBuilderState {
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

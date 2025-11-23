/**
 * Class module type definitions
 */

// Low-level function parameters (snake_case)
export interface CreateClassParams {
  class_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  master_system?: string;
  responsible?: string;
  superclass?: string;
  final?: boolean;
  abstract?: boolean;
  create_protected?: boolean;
}

export interface DeleteClassParams {
  class_name: string;
  transport_request?: string;
}

// Builder configuration (camelCase)
export interface ClassBuilderConfig {
  className: string;
  description: string;
  packageName?: string;
  transportRequest?: string;
  sourceCode?: string;
  superclass?: string;
  final?: boolean;
  abstract?: boolean;
  createProtected?: boolean;
  masterSystem?: string;
  responsible?: string;
}

export interface ClassBuilderState {
  validationResult?: any;
  readResult?: any;
  createResult?: any;
  metadataResult?: any;
  transportResult?: any;
  lockHandle?: string;
  unlockResult?: any;
  updateResult?: any;
  activateResult?: any;
  checkResult?: any;
  deleteResult?: any;
  errors: Array<{ method: string; error: Error; timestamp: Date }>;
}

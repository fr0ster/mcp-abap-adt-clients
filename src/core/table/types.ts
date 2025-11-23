/**
 * Table module type definitions
 */

// Low-level function parameters (snake_case)
export interface CreateTableParams {
  table_name: string;
  ddl_code: string;
  package_name: string;
  transport_request?: string;
}

export interface UpdateTableParams {
  table_name: string;
  ddl_code: string;
  transport_request?: string;
  activate?: boolean;
}

export interface DeleteTableParams {
  table_name: string;
  transport_request?: string;
}

// Builder configuration (camelCase)
export interface TableBuilderConfig {
  tableName: string;
  packageName?: string;
  transportRequest?: string;
  ddlCode?: string;
}

export interface TableBuilderState {
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

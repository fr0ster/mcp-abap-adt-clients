/**
 * Table module type definitions
 */

import { AxiosResponse } from 'axios';
import { BaseBuilderState } from '../shared/IBuilder';

// Low-level function parameters (snake_case)
export interface CreateTableParams {
  table_name: string;
  package_name: string;
  transport_request?: string;
  ddl_code?: string; // Optional - can be added via update() later
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
// Note: packageName is required for create operations (validated in builder methods)
// description is required for create/validate operations
export interface TableBuilderConfig {
  tableName: string;
  packageName?: string; // Required for create operations, optional for others
  transportRequest?: string; // Only optional parameter
  ddlCode?: string;
  description?: string; // Required for create/validate operations, optional for others
}

export interface TableBuilderState extends BaseBuilderState {
  // Table-specific state can be added here if needed
}

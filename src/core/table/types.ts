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
export interface TableBuilderConfig {
  tableName: string;
  packageName?: string;
  transportRequest?: string;
  ddlCode?: string;
  description?: string;
}

export interface TableBuilderState extends BaseBuilderState {
  // Table-specific state can be added here if needed
}

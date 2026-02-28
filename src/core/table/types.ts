/**
 * Table module type definitions
 */

import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';

// Low-level function parameters (snake_case)
export interface ICreateTableParams {
  table_name: string;
  package_name: string;
  transport_request?: string;
  ddl_code?: string; // Optional - can be added via update() later
  masterSystem?: string;
  responsible?: string;
}

export interface IUpdateTableParams {
  table_name: string;
  ddl_code: string;
  transport_request?: string;
  activate?: boolean;
}

export interface IDeleteTableParams {
  table_name: string;
  transport_request?: string;
}

// Builder configuration (camelCase)
// Note: packageName is required for create operations (validated in builder methods)
// description is required for create/validate operations
export interface ITableConfig {
  tableName: string;
  packageName?: string; // Required for create operations, optional for others
  transportRequest?: string; // Only optional parameter
  ddlCode?: string;
  description?: string; // Required for create/validate operations, optional for others
}

export interface ITableState extends IAdtObjectState {
  // All operation results are in IAdtObjectState:
  // validationResponse, createResult, lockHandle, updateResult, checkResult,
  // unlockResult, activateResult, deleteResult, readResult, transportResult, errors
  // Table-specific fields can be added here if needed
}

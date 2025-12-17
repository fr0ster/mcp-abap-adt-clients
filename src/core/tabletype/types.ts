/**
 * TableType module type definitions
 */

import { IAdtObjectState } from '@mcp-abap-adt/interfaces';

// Low-level function parameters (snake_case)
export interface ICreateTableTypeParams {
  tabletype_name: string;
  package_name: string;
  transport_request?: string;
  ddl_code?: string; // Optional - can be added via update() later
}

export interface IUpdateTableTypeParams {
  tabletype_name: string;
  ddl_code: string;
  transport_request?: string;
  activate?: boolean;
}

export interface IDeleteTableTypeParams {
  tabletype_name: string;
  transport_request?: string;
}

// Builder configuration (camelCase)
// Note: packageName is required for create operations (validated in builder methods)
// description is required for create/validate operations
export interface ITableTypeConfig {
  tableTypeName: string;
  packageName?: string; // Required for create operations, optional for others
  transportRequest?: string; // Only optional parameter
  ddlCode?: string;
  description?: string; // Required for create/validate operations, optional for others
}

export interface ITableTypeState extends IAdtObjectState {
  // All operation results are in IAdtObjectState:
  // validationResponse, createResult, lockHandle, updateResult, checkResult,
  // unlockResult, activateResult, deleteResult, readResult, transportResult, errors
  // TableType-specific fields can be added here if needed
}

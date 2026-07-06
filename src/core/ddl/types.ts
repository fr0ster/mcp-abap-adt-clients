/**
 * View module type definitions
 */

import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';

// Low-level function parameters (snake_case)
export interface ICreateDdlParams {
  ddl_name: string;
  ddl_source?: string; // Optional - only metadata creation in low-level function
  package_name: string;
  transport_request?: string;
  description?: string;
  masterSystem?: string;
  responsible?: string;
  masterLanguage?: string;
}

export interface IUpdateDdlSourceParams {
  ddl_name: string;
  ddl_source: string;
  activate?: boolean;
  lock_handle?: string;
  transport_request?: string;
}

export interface IDeleteDdlParams {
  ddl_name: string;
  transport_request?: string;
}

// Builder configuration (camelCase)
// Note: packageName is required for create operations (validated in builder methods)
// description is required for create/validate operations
export interface IDdlConfig {
  ddlName: string;
  masterLanguage?: string; // Original/master language for create; falls back to systemContext (SAP_LANGUAGE), then EN
  packageName?: string; // Required for create operations, optional for others
  transportRequest?: string; // Only optional parameter
  description?: string; // Required for create/validate operations, optional for others
  ddlSource?: string;
  sessionId?: string;
  onLock?: (lockHandle: string) => void;
}

export interface IDdlState extends IAdtObjectState {}

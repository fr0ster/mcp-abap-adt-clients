/**
 * View module type definitions
 */

import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';

// Low-level function parameters (snake_case)
export interface ICreateViewParams {
  view_name: string;
  ddl_source?: string; // Optional - only metadata creation in low-level function
  package_name: string;
  transport_request?: string;
  description?: string;
  masterSystem?: string;
  responsible?: string;
}

export interface IUpdateViewSourceParams {
  view_name: string;
  ddl_source: string;
  activate?: boolean;
  lock_handle?: string;
  transport_request?: string;
}

export interface IDeleteViewParams {
  view_name: string;
  transport_request?: string;
}

// Builder configuration (camelCase)
// Note: packageName is required for create operations (validated in builder methods)
// description is required for create/validate operations
export interface IViewConfig {
  viewName: string;
  packageName?: string; // Required for create operations, optional for others
  transportRequest?: string; // Only optional parameter
  description?: string; // Required for create/validate operations, optional for others
  ddlSource?: string;
  sessionId?: string;
  onLock?: (lockHandle: string) => void;
}

export interface IViewState extends IAdtObjectState {}

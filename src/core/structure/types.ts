/**
 * Structure module type definitions
 */

import { IAdtObjectState } from '@mcp-abap-adt/interfaces';

export interface IStructureField {
  name: string;
  data_type?: string;
  length?: number;
  decimals?: number;
  domain?: string;
  data_element?: string;
  structure_ref?: string;
  table_ref?: string;
  description?: string;
}

export interface IStructureInclude {
  name: string;
  suffix?: string;
}

// Low-level function parameters (camelCase)
export interface ICreateStructureParams {
  structureName: string;
  description: string;
  packageName: string;
  transportRequest?: string;
}

export interface IUpdateStructureParams {
  structureName: string;
  ddlCode: string; // DDL SQL source code for structure
  transportRequest?: string;
}

export interface IDeleteStructureParams {
  structure_name: string;
  transport_request?: string;
}

// Builder configuration (camelCase)
// Note: packageName and ddlCode are required for create operations (validated in builder methods)
// description is required for create/validate operations
export interface IStructureConfig {
  structureName: string;
  packageName?: string; // Required for create operations, optional for others
  transportRequest?: string; // Only optional parameter
  description?: string; // Required for create/validate operations, optional for others
  ddlCode?: string; // Required for create operation - DDL SQL source code for structure
  // Legacy fields (deprecated, use ddlCode instead)
  fields?: IStructureField[];
  includes?: IStructureInclude[];
  onLock?: (lockHandle: string) => void;
}

export interface IStructureState extends IAdtObjectState {
  // All operation results are in IAdtObjectState:
  // validationResponse, createResult, lockHandle, updateResult, checkResult,
  // unlockResult, activateResult, deleteResult, readResult, transportResult, errors
  // Structure-specific fields can be added here if needed
}

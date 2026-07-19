/**
 * Structure module type definitions
 */

import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';

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

// Low-level function parameters (camelCase) — defined in @mcp-abap-adt/interfaces
export type {
  ICreateStructureParams,
  IDeleteStructureParams,
  IUpdateStructureParams,
} from '@mcp-abap-adt/interfaces';

// Builder configuration (camelCase)
// Note: packageName and ddlCode are required for create operations (validated in builder methods)
// description is required for create/validate operations
export interface IStructureConfig {
  structureName: string;
  masterLanguage?: string; // Original/master language for create; falls back to systemContext (SAP_LANGUAGE), then EN
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

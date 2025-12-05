/**
 * Structure module type definitions
 */

import { BaseBuilderState } from '../shared/IBuilder';

export interface StructureField {
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

export interface StructureInclude {
  name: string;
  suffix?: string;
}

// Low-level function parameters (camelCase)
export interface CreateStructureParams {
  structureName: string;
  description: string;
  packageName: string;
  transportRequest?: string;
}

export interface UpdateStructureParams {
  structureName: string;
  ddlCode: string; // DDL SQL source code for structure
  transportRequest?: string;
}

export interface DeleteStructureParams {
  structure_name: string;
  transport_request?: string;
}

// Builder configuration (camelCase)
// Note: packageName and ddlCode are required for create operations (validated in builder methods)
// description is required for create/validate operations
export interface StructureBuilderConfig {
  structureName: string;
  packageName?: string; // Required for create operations, optional for others
  transportRequest?: string; // Only optional parameter
  description?: string; // Required for create/validate operations, optional for others
  ddlCode?: string; // Required for create operation - DDL SQL source code for structure
  // Legacy fields (deprecated, use ddlCode instead)
  fields?: StructureField[];
  includes?: StructureInclude[];
  onLock?: (lockHandle: string) => void;
}

export interface StructureBuilderState extends BaseBuilderState {
  // Structure-specific state can be added here if needed
}

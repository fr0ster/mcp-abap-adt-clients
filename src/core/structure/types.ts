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

// Low-level function parameters (snake_case)
export interface CreateStructureParams {
  structure_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  ddl_code: string; // DDL SQL source code for structure
  // Legacy fields (deprecated, use ddl_code instead)
  fields?: StructureField[];
  includes?: StructureInclude[];
}

export interface UpdateStructureParams {
  structure_name: string;
  ddl_code: string; // DDL SQL source code for structure
  transport_request?: string;
}

export interface DeleteStructureParams {
  structure_name: string;
  transport_request?: string;
}

// Builder configuration (camelCase)
export interface StructureBuilderConfig {
  structureName: string;
  packageName?: string;
  transportRequest?: string;
  description: string;
  ddlCode?: string; // DDL SQL source code for structure (required for create operation)
  // Legacy fields (deprecated, use ddlCode instead)
  fields?: StructureField[];
  includes?: StructureInclude[];
  onLock?: (lockHandle: string) => void;
}

export interface StructureBuilderState extends BaseBuilderState {
  // Structure-specific state can be added here if needed
}

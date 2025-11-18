/**
 * Structure types
 */

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


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
  fields: StructureField[];
  includes?: StructureInclude[];
}


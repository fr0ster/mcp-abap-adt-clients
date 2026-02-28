import type { IAdtObjectState, IAdtResponse } from '@mcp-abap-adt/interfaces';

// Low-level function parameters (snake_case)
export interface ICreateAccessControlParams {
  access_control_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  source_code?: string;
  masterSystem?: string;
  responsible?: string;
}

export interface IUpdateAccessControlParams {
  access_control_name: string;
  source_code: string;
  transport_request?: string;
}

export interface IDeleteAccessControlParams {
  access_control_name: string;
  transport_request?: string;
}

// Builder configuration (camelCase)
export interface IAccessControlConfig {
  accessControlName: string;
  packageName?: string;
  transportRequest?: string;
  description?: string;
  sourceCode?: string;
}

export interface IAccessControlState extends IAdtObjectState {
  readSourceResult?: IAdtResponse;
}

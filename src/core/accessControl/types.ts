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
  masterLanguage?: string;
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
  masterLanguage?: string; // Original/master language for create; falls back to systemContext (SAP_LANGUAGE), then EN
  packageName?: string;
  transportRequest?: string;
  description?: string;
  sourceCode?: string;
}

export interface IAccessControlState extends IAdtObjectState {
  readSourceResult?: IAdtResponse;
}

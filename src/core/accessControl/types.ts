import type { IAdtObjectState, IAdtResponse } from '@mcp-abap-adt/interfaces';

// Low-level function parameters (snake_case) — defined in @mcp-abap-adt/interfaces
export type {
  ICreateAccessControlParams,
  IDeleteAccessControlParams,
  IUpdateAccessControlParams,
} from '@mcp-abap-adt/interfaces';

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

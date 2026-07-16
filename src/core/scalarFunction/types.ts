/**
 * ScalarFunction (CDS DSFD/SCF) module type definitions
 */
import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';

// Low-level function parameters (snake_case)
export interface ICreateScalarFunctionParams {
  scalar_function_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  masterSystem?: string;
  responsible?: string;
  masterLanguage?: string;
}

export interface IUpdateScalarFunctionParams {
  scalar_function_name: string;
  source_code: string;
  transport_request?: string;
}

export interface IDeleteScalarFunctionParams {
  scalar_function_name: string;
  transport_request?: string;
}

// Handler configuration (camelCase)
export interface IScalarFunctionConfig {
  scalarFunctionName: string;
  masterLanguage?: string;
  packageName?: string;
  transportRequest?: string;
  description?: string;
  sourceCode?: string;
}

export interface IScalarFunctionState extends IAdtObjectState {
  /** false only when the validation endpoint returned 404/405/501 (unsupported) */
  validationSupported?: boolean;
}

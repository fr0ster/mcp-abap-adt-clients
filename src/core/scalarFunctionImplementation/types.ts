/**
 * ScalarFunctionImplementation (DSFI/SFI) module type definitions
 */
import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';

export type ScalarFunctionEngine = 'sqlEngine' | 'amdpEngine';

export interface ICreateScalarFunctionImplementationParams {
  implementation_name: string;
  scalar_function_name: string;
  engine_value?: ScalarFunctionEngine;
  description?: string;
  package_name: string;
  transport_request?: string;
  source_code?: string;
  masterSystem?: string;
  responsible?: string;
  masterLanguage?: string;
}

export interface IUpdateScalarFunctionImplementationParams {
  implementation_name: string;
  source_code: string;
  transport_request?: string;
}

export interface IDeleteScalarFunctionImplementationParams {
  implementation_name: string;
  transport_request?: string;
}

export interface IScalarFunctionImplementationConfig {
  implementationName: string;
  scalarFunctionName: string;
  engineValue?: ScalarFunctionEngine;
  masterLanguage?: string;
  packageName?: string;
  transportRequest?: string;
  description?: string;
  sourceCode?: string;
}

export interface IScalarFunctionImplementationState extends IAdtObjectState {
  validationSupported?: boolean;
}

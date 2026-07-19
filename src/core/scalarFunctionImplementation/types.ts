/**
 * ScalarFunctionImplementation (DSFI/SFI) module type definitions
 */
import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';

export type ScalarFunctionEngine = 'sqlEngine' | 'amdpEngine';

// Low-level function parameters (snake_case) — defined in @mcp-abap-adt/interfaces
export type {
  ICreateScalarFunctionImplementationParams,
  IDeleteScalarFunctionImplementationParams,
  IUpdateScalarFunctionImplementationParams,
} from '@mcp-abap-adt/interfaces';

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

/**
 * ScalarFunction (CDS DSFD/SCF) module type definitions
 */
import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';

// Low-level function parameters (snake_case) — defined in @mcp-abap-adt/interfaces
export type {
  ICreateScalarFunctionParams,
  IDeleteScalarFunctionParams,
  IUpdateScalarFunctionParams,
} from '@mcp-abap-adt/interfaces';

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

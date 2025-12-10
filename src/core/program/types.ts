/**
 * Program module type definitions
 */

import { IAdtObjectState } from '@mcp-abap-adt/interfaces';

// Low-level function parameters (snake_case)
export interface ICreateProgramParams {
  programName: string;
  description?: string;
  packageName: string;
  transportRequest?: string;
  masterSystem?: string;
  responsible?: string;
  programType?: string;
  application?: string;
  sourceCode?: string;
  activate?: boolean;
}

export interface IUpdateProgramSourceParams {
  programName: string;
  sourceCode: string;
  activate?: boolean;
}

export interface IDeleteProgramParams {
  programName: string;
  transportRequest?: string;
}

// Builder configuration (camelCase)
// Note: packageName is required for create operations (validated in builder methods)
// description is required for create/validate operations
export interface IProgramConfig {
  programName: string;
  packageName?: string; // Required for create operations, optional for others
  transportRequest?: string; // Only optional parameter
  description?: string; // Required for create/validate operations, optional for others
  programType?: string;
  application?: string;
  sourceCode?: string;
  sessionId?: string;
  onLock?: (lockHandle: string) => void;
}

export interface IProgramState extends IAdtObjectState {
  runResult?: any; // Program-specific: result of program execution
  // All operation results are in IAdtObjectState:
  // validationResponse, createResult, lockHandle, updateResult, checkResult,
  // unlockResult, activateResult, deleteResult, readResult, transportResult, errors
}

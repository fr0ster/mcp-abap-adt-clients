/**
 * Program module type definitions
 */

import { BaseBuilderState } from '../shared/IBuilder';

// Low-level function parameters (snake_case)
export interface CreateProgramParams {
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

export interface UpdateProgramSourceParams {
  programName: string;
  sourceCode: string;
  activate?: boolean;
}

export interface DeleteProgramParams {
  programName: string;
  transportRequest?: string;
}

// Builder configuration (camelCase)
// Note: packageName is required for create operations (validated in builder methods)
// description is required for create/validate operations
export interface ProgramBuilderConfig {
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

export interface ProgramBuilderState extends BaseBuilderState {
  runResult?: any; // Program-specific: result of program execution
  // Other fields inherited from BaseBuilderState
}

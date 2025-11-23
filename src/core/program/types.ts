/**
 * Program module type definitions
 */

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
export interface ProgramBuilderConfig {
  programName: string;
  packageName?: string;
  transportRequest?: string;
  description: string;
  programType?: string;
  application?: string;
  sourceCode?: string;
  sessionId?: string;
  onLock?: (lockHandle: string) => void;
}

export interface ProgramBuilderState {
  validationResult?: any;
  readResult?: any;
  createResult?: any;
  lockHandle?: string;
  unlockResult?: any;
  updateResult?: any;
  activateResult?: any;
  checkResult?: any;
  deleteResult?: any;
  runResult?: any;
  errors: Array<{ method: string; error: Error; timestamp: Date }>;
}

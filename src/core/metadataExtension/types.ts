/**
 * MetadataExtension module type definitions
 */

// Validation parameters
export interface MetadataExtensionValidationParams {
  name: string;
  description: string;
  packageName: string;
}

// Low-level function parameters (snake_case would be here if needed)
export interface MetadataExtensionCreateParams {
  name: string;
  description: string;
  packageName: string;
  transportRequest?: string;
  masterLanguage?: string;
  masterSystem?: string;
  responsible?: string;
}

// Builder configuration (camelCase)
export interface MetadataExtensionBuilderConfig {
  name: string;
  description: string;
  packageName?: string;
  transportRequest?: string;
  sourceCode?: string;
  masterLanguage?: string;
  masterSystem?: string;
  responsible?: string;
  sessionId?: string;
}

export interface MetadataExtensionBuilderState {
  validationResult?: { valid: boolean; errors?: string[] };
  createResult?: any;
  lockHandle?: string;
  readResult?: any;
  sourceCode?: string;
  updateResult?: any;
  checkResult?: any;
  unlockResult?: any;
  activateResult?: any;
  deleteResult?: any;
  errors: Array<{ method: string; error: Error; timestamp: Date }>;
}

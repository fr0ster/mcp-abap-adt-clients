/**
 * MetadataExtension module type definitions
 */

import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';

// Validation parameters
export interface IMetadataExtensionValidationParams {
  name: string;
  description: string;
  packageName: string;
}

// Low-level function parameters (snake_case would be here if needed)
export interface IMetadataExtensionCreateParams {
  name: string;
  description: string;
  packageName: string;
  transportRequest?: string;
  masterLanguage?: string;
  masterSystem?: string;
  responsible?: string;
}

// Builder configuration (camelCase)
// Note: packageName and description are required for create/validate operations (validated in builder methods)
export interface IMetadataExtensionConfig {
  name: string; // Required
  description?: string; // Required for create/validate operations, optional for others
  packageName?: string; // Required for create/validate operations, optional for others
  transportRequest?: string; // Only optional parameter
  sourceCode?: string;
  masterLanguage?: string;
  masterSystem?: string;
  responsible?: string;
  sessionId?: string;
}

export interface IMetadataExtensionState extends IAdtObjectState {
  sourceCode?: string; // MetadataExtension-specific: stored source code
  // All operation results are in IAdtObjectState:
  // validationResponse, createResult, lockHandle, updateResult, checkResult,
  // unlockResult, activateResult, deleteResult, readResult, transportResult, errors
}

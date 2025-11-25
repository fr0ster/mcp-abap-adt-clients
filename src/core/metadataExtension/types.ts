/**
 * MetadataExtension module type definitions
 */

import { AxiosResponse } from 'axios';
import { BaseBuilderState } from '../shared/IBuilder';

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
// Note: packageName and description are required for create/validate operations (validated in builder methods)
export interface MetadataExtensionBuilderConfig {
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

export interface MetadataExtensionBuilderState extends BaseBuilderState {
  sourceCode?: string; // MetadataExtension-specific: stored source code
  // Other fields inherited from BaseBuilderState
}

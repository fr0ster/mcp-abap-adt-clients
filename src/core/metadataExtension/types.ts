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

export interface MetadataExtensionBuilderState extends BaseBuilderState {
  sourceCode?: string; // MetadataExtension-specific: stored source code
  // Other fields inherited from BaseBuilderState
}

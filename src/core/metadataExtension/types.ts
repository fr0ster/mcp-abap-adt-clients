/**
 * MetadataExtension module type definitions
 */

import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';

// Validation + low-level function parameters — defined in @mcp-abap-adt/interfaces
export type {
  IMetadataExtensionCreateParams,
  IMetadataExtensionValidationParams,
} from '@mcp-abap-adt/interfaces';

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

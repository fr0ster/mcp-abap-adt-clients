/**
 * Behavior Implementation module type definitions
 */

import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';

// Low-level function parameters (snake_case)
export interface ICreateBehaviorImplementationParams {
  class_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  master_system?: string;
  responsible?: string;
  behavior_definition: string; // Root entity name (BDEF name)
}

// Builder configuration (camelCase)
export interface IBehaviorImplementationConfig {
  className: string; // Required
  description?: string; // Required for create/validate operations, optional for others
  packageName?: string; // Required for create/validate operations, optional for others
  transportRequest?: string; // Only optional parameter
  behaviorDefinition: string; // Required - root entity name (BDEF name)
  sourceCode?: string; // Implementation source code (legacy, use implementationCode instead)
  /**
   * Custom code for implementations include (local handler class) - used in updateImplementations()
   * If provided, takes precedence over sourceCode and default generated code.
   * Should contain the complete local handler class definition and implementation.
   * Example: "CLASS lhc_ZOK_I_CDS_TEST DEFINITION INHERITING FROM cl_abap_behavior_handler..."
   */
  implementationCode?: string;
  masterSystem?: string;
  responsible?: string;
}

export interface IBehaviorImplementationState extends IAdtObjectState {
  metadataResult?: any; // Class-specific: metadata read result
  // All operation results are in IAdtObjectState:
  // validationResponse, createResult, lockHandle, updateResult, checkResult,
  // unlockResult, activateResult, deleteResult, readResult, transportResult, errors
}

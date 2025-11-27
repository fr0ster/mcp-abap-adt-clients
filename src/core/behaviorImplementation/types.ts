/**
 * Behavior Implementation module type definitions
 */

import { AxiosResponse } from 'axios';
import { BaseBuilderState } from '../shared/IBuilder';

// Low-level function parameters (snake_case)
export interface CreateBehaviorImplementationParams {
  class_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  master_system?: string;
  responsible?: string;
  behavior_definition: string; // Root entity name (BDEF name)
}

// Builder configuration (camelCase)
export interface BehaviorImplementationBuilderConfig {
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

export interface BehaviorImplementationBuilderState extends BaseBuilderState {
  metadataResult?: any; // Class-specific: metadata read result
  // Other fields inherited from BaseBuilderState
}


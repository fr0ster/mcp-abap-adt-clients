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
  sourceCode?: string; // Implementation source code
  masterSystem?: string;
  responsible?: string;
}

export interface BehaviorImplementationBuilderState extends BaseBuilderState {
  metadataResult?: any; // Class-specific: metadata read result
  // Other fields inherited from BaseBuilderState
}


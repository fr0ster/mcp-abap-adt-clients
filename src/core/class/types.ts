/**
 * Class module type definitions
 */

import { AxiosResponse } from 'axios';
import { BaseBuilderState } from '../shared/IBuilder';

// Low-level function parameters (snake_case)
export interface CreateClassParams {
  class_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  master_system?: string;
  responsible?: string;
  superclass?: string;
  final?: boolean;
  abstract?: boolean;
  create_protected?: boolean;
  template_xml?: string;
}

export interface DeleteClassParams {
  class_name: string;
  transport_request?: string;
}

// Builder configuration (camelCase)
// Note: packageName is required for create operations (validated in builder methods)
// description is required for create/validate operations
export interface ClassBuilderConfig {
  className: string;
  description?: string; // Required for create/validate operations, optional for others
  packageName?: string; // Required for create operations, optional for others
  transportRequest?: string; // Only optional parameter
  sourceCode?: string;
  testClassCode?: string;
  testClassName?: string;
  localTypesCode?: string; // Local helper classes, interface definitions and type declarations
  definitionsCode?: string; // Class-relevant local types (private section types)
  macrosCode?: string; // Macro definitions (legacy ABAP)
  superclass?: string;
  final?: boolean;
  abstract?: boolean;
  createProtected?: boolean;
  masterSystem?: string;
  responsible?: string;
  classTemplate?: string;
}

export interface ClassBuilderState extends BaseBuilderState {
  metadataResult?: any; // Class-specific: metadata read result
  transportResult?: any; // Class-specific: transport read result
  testClassesResult?: any; // Class-specific: test classes update result
  testActivateResult?: any; // Class-specific: test classes activation result
  testLockHandle?: string; // Class-specific: test classes lock handle
  // Other fields inherited from BaseBuilderState
}

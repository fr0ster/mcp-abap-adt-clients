/**
 * Class module type definitions
 */

import type {
  IAdtResponse as AxiosResponse,
  IAdtObjectState,
} from '@mcp-abap-adt/interfaces';

// Low-level function parameters (snake_case)
export interface ICreateClassParams {
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

export interface IDeleteClassParams {
  class_name: string;
  transport_request?: string;
}

// AdtClass configuration (camelCase)
// Note: packageName is required for create operations (validated in builder methods)
// description is required for create/validate operations
export interface IClassConfig {
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

export interface IClassState extends IAdtObjectState {
  // All operation results are in IAdtObjectState:
  // validationResponse, createResult, lockHandle, updateResult, checkResult,
  // unlockResult, activateResult, deleteResult, readResult, transportResult, errors
  // Class-specific fields can be added here if needed
  testClassCode?: string;
  testActivateResult?: AxiosResponse;
  testLockHandle?: string;
  testClassesResult?: AxiosResponse;
}

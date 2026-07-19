/**
 * ServiceDefinition module type definitions
 */

import type { IAdtObjectState, IAdtResponse } from '@mcp-abap-adt/interfaces';

// Low-level function parameters (snake_case) — defined in @mcp-abap-adt/interfaces
export type {
  ICreateServiceDefinitionParams,
  IDeleteServiceDefinitionParams,
  IUpdateServiceDefinitionParams,
} from '@mcp-abap-adt/interfaces';

// Builder configuration (camelCase)
export interface IServiceDefinitionConfig {
  serviceDefinitionName: string;
  masterLanguage?: string; // Original/master language for create; falls back to systemContext (SAP_LANGUAGE), then EN
  packageName?: string; // Required for create operations, optional for others
  transportRequest?: string; // Only optional parameter
  description?: string; // Required for create/validate operations, optional for others
  sourceCode?: string; // Service definition source code (CDS service definition syntax)
}

export interface IServiceDefinitionState extends IAdtObjectState {
  readSourceResult?: IAdtResponse;
  // All operation results are in IAdtObjectState:
  // validationResponse, createResult, lockHandle, updateResult, checkResult,
  // unlockResult, activateResult, deleteResult, readResult, transportResult, errors
}

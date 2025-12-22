/**
 * ServiceDefinition module type definitions
 */

import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';

// Low-level function parameters (snake_case)
export interface ICreateServiceDefinitionParams {
  service_definition_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  source_code?: string;
}

export interface IUpdateServiceDefinitionParams {
  service_definition_name: string;
  source_code: string;
  transport_request?: string;
}

export interface IDeleteServiceDefinitionParams {
  service_definition_name: string;
  transport_request?: string;
}

// Builder configuration (camelCase)
export interface IServiceDefinitionConfig {
  serviceDefinitionName: string;
  packageName?: string; // Required for create operations, optional for others
  transportRequest?: string; // Only optional parameter
  description?: string; // Required for create/validate operations, optional for others
  sourceCode?: string; // Service definition source code (CDS service definition syntax)
}

export interface IServiceDefinitionState extends IAdtObjectState {
  readSourceResult?: import('axios').AxiosResponse;
  // All operation results are in IAdtObjectState:
  // validationResponse, createResult, lockHandle, updateResult, checkResult,
  // unlockResult, activateResult, deleteResult, readResult, transportResult, errors
}

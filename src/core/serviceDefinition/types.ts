/**
 * ServiceDefinition module type definitions
 */

import { BaseBuilderState } from '../shared/IBuilder';

// Low-level function parameters (snake_case)
export interface CreateServiceDefinitionParams {
  service_definition_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  source_code?: string;
}

export interface UpdateServiceDefinitionParams {
  service_definition_name: string;
  source_code: string;
  transport_request?: string;
}

export interface DeleteServiceDefinitionParams {
  service_definition_name: string;
  transport_request?: string;
}

// Builder configuration (camelCase)
export interface ServiceDefinitionBuilderConfig {
  serviceDefinitionName: string;
  packageName?: string; // Required for create operations, optional for others
  transportRequest?: string; // Only optional parameter
  description?: string; // Required for create/validate operations, optional for others
  sourceCode?: string; // Service definition source code (CDS service definition syntax)
}

export interface ServiceDefinitionBuilderState extends BaseBuilderState {
  readSourceResult?: import('axios').AxiosResponse;
}


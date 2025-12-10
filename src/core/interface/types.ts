/**
 * Interface module type definitions
 */

import { IAdtObjectConfig, IAdtObjectState } from '@mcp-abap-adt/interfaces';

// Low-level function parameters (camelCase)
export interface ICreateInterfaceParams {
  interfaceName: string;
  description: string;
  packageName: string;
  transportRequest?: string;
  masterSystem?: string;
  responsible?: string;
}

export interface IUpdateInterfaceSourceParams {
  interface_name: string;
  source_code: string;
  activate?: boolean;
}

export interface IDeleteInterfaceParams {
  interface_name: string;
  transport_request?: string;
}

// Builder configuration (camelCase)
// Note: packageName is required for create operations (validated in builder methods)
// description is required for create/validate operations
export interface IInterfaceConfig extends IAdtObjectConfig {
  interfaceName: string;
  packageName?: string; // Required for create operations, optional for others
  transportRequest?: string; // Only optional parameter
  description?: string; // Required for create/validate operations, optional for others
  sourceCode?: string;
  sessionId?: string;
  onLock?: (lockHandle: string) => void;
}

export interface IInterfaceState extends IAdtObjectState {
  // Interface-specific state can be added here if needed
}

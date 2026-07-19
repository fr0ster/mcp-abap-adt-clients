/**
 * Interface module type definitions
 */

import type {
  IAdtObjectConfig,
  IAdtObjectState,
} from '@mcp-abap-adt/interfaces';

// Low-level function parameters (camelCase) — defined in @mcp-abap-adt/interfaces
export type {
  ICreateInterfaceParams,
  IDeleteInterfaceParams,
  IUpdateInterfaceSourceParams,
} from '@mcp-abap-adt/interfaces';

// Builder configuration (camelCase)
// Note: packageName is required for create operations (validated in builder methods)
// description is required for create/validate operations
export interface IInterfaceConfig extends IAdtObjectConfig {
  interfaceName: string;
  masterLanguage?: string; // Original/master language for create; falls back to systemContext (SAP_LANGUAGE), then EN
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

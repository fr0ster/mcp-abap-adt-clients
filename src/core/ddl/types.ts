/**
 * View module type definitions
 */

import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';

// Low-level function parameters (snake_case) — defined in @mcp-abap-adt/interfaces
export type {
  ICreateDdlParams,
  IDeleteDdlParams,
  IUpdateDdlSourceParams,
} from '@mcp-abap-adt/interfaces';

// Builder configuration (camelCase)
// Note: packageName is required for create operations (validated in builder methods)
// description is required for create/validate operations
export interface IDdlConfig {
  ddlName: string;
  masterLanguage?: string; // Original/master language for create; falls back to systemContext (SAP_LANGUAGE), then EN
  packageName?: string; // Required for create operations, optional for others
  transportRequest?: string; // Only optional parameter
  description?: string; // Required for create/validate operations, optional for others
  ddlSource?: string;
  sessionId?: string;
  onLock?: (lockHandle: string) => void;
}

export interface IDdlState extends IAdtObjectState {}

/**
 * FunctionInclude (FUGR/I) module type definitions
 */

import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';

// Low-level function parameters — defined in @mcp-abap-adt/interfaces
export type { ICreateFunctionIncludeParams } from '@mcp-abap-adt/interfaces';

export interface IFunctionIncludeConfig {
  functionGroupName: string;
  includeName: string;
  description?: string;
  transportRequest?: string;
  masterSystem?: string;
  responsible?: string;
  sourceCode?: string;
  sessionId?: string;
  onLock?: (lockHandle: string) => void;
}

export interface IFunctionIncludeState extends IAdtObjectState {}

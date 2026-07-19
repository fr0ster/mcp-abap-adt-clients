/**
 * Transport module type definitions
 */

import type { IAdtObjectState, IAdtResponse } from '@mcp-abap-adt/interfaces';

// Low-level function parameters (snake_case) - internal use only — defined in @mcp-abap-adt/interfaces
export type {
  ICreateTransportParams,
  IListTransportsParams,
} from '@mcp-abap-adt/interfaces';

// Transport request configuration (camelCase)
export interface ITransportConfig {
  description: string;
  transportType?: 'workbench' | 'customizing';
  targetSystem?: string;
  owner?: string;
  transportNumber?: string; // Set after create, used for read operations
}

// Transport state
export interface ITransportState extends IAdtObjectState {
  transportNumber?: string;
  taskNumber?: string;
  listResult?: IAdtResponse;
}

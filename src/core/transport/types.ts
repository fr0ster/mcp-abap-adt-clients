/**
 * Transport module type definitions
 */

import type { IAdtObjectState, IAdtResponse } from '@mcp-abap-adt/interfaces';

// Low-level function parameters (snake_case) - internal use only
export interface ICreateTransportParams {
  transport_type?: string;
  description: string;
  target_system?: string;
  owner?: string;
}

// Low-level function parameters for listing transports (snake_case) - internal use only
export interface IListTransportsParams {
  user: string;
  status?: string; // D = modifiable, R = released
  date_range?: string; // e.g. "20260101-20260326"
  target_system?: string;
  request_type?: string; // K = workbench, T = customizing
}

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

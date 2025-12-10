/**
 * Transport module type definitions
 */

import { IAdtObjectState } from "@mcp-abap-adt/interfaces";

// Low-level function parameters (snake_case) - internal use only
export interface ICreateTransportParams {
  transport_type?: string;
  description: string;
  target_system?: string;
  owner?: string;
}

// Builder state - internal use only
export interface ITransportState extends IAdtObjectState {
  transportNumber?: string;
  taskNumber?: string;
}

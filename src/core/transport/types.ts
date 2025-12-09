/**
 * Transport module type definitions
 */

// Low-level function parameters (snake_case) - internal use only
export interface CreateTransportParams {
  transport_type?: string;
  description: string;
  target_system?: string;
  owner?: string;
}

// Builder state - internal use only
export interface TransportBuilderState {
  createResult?: any;
  readResult?: any;
  transportNumber?: string;
  taskNumber?: string;
  errors: Array<{ method: string; error: Error; timestamp: Date }>;
}

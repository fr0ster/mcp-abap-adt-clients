/**
 * Transport module type definitions
 */

// Low-level function parameters (snake_case)
export interface CreateTransportParams {
  transport_type?: string;
  description: string;
  target_system?: string;
  owner?: string;
}

// Builder configuration (camelCase)
export interface TransportBuilderConfig {
  description: string;
  transportType?: 'workbench' | 'customizing';
  targetSystem?: string;
  owner?: string;
}

export interface TransportBuilderState {
  createResult?: any;
  readResult?: any;
  transportNumber?: string;
  taskNumber?: string;
  errors: Array<{ method: string; error: Error; timestamp: Date }>;
}

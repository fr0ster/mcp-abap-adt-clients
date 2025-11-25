/**
 * View module type definitions
 */

import { AxiosResponse } from 'axios';
import { BaseBuilderState } from '../shared/IBuilder';

// Low-level function parameters (snake_case)
export interface CreateViewParams {
  view_name: string;
  ddl_source?: string; // Optional - only metadata creation in low-level function
  package_name: string;
  transport_request?: string;
  description?: string;
}

export interface UpdateViewSourceParams {
  view_name: string;
  ddl_source: string;
  activate?: boolean;
  lock_handle?: string;
  transport_request?: string;
}

export interface DeleteViewParams {
  view_name: string;
  transport_request?: string;
}

// Builder configuration (camelCase)
// Note: packageName is required for create operations (validated in builder methods)
// description is required for create/validate operations
export interface ViewBuilderConfig {
  viewName: string;
  packageName?: string; // Required for create operations, optional for others
  transportRequest?: string; // Only optional parameter
  description?: string; // Required for create/validate operations, optional for others
  ddlSource?: string;
  sessionId?: string;
  onLock?: (lockHandle: string) => void;
}

export interface ViewBuilderState extends BaseBuilderState {
  // View-specific state can be added here if needed
}

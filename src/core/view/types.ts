/**
 * View types
 */

export interface CreateViewParams {
  view_name: string;
  ddl_source: string;
  package_name: string;
  transport_request?: string;
  description?: string;
}

export interface UpdateViewSourceParams {
  view_name: string;
  ddl_source: string;
  activate?: boolean;
  lock_handle?: string;
  session_id?: string;
  transport_request?: string;
}


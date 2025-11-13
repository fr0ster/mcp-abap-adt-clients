/**
 * Interface types
 */

export interface CreateInterfaceParams {
  interface_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  master_system?: string;
  responsible?: string;
  source_code?: string;
  activate?: boolean;
}

export interface UpdateInterfaceSourceParams {
  interface_name: string;
  source_code: string;
  activate?: boolean;
}


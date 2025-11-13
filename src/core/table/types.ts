/**
 * Table types
 */

export interface CreateTableParams {
  table_name: string;
  ddl_code: string;
  package_name: string;
  transport_request?: string;
}


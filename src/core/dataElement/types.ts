/**
 * DataElement types
 */

export interface CreateDataElementParams {
  data_element_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  domain_name: string;
  data_type?: string;
  length?: number;
  decimals?: number;
  short_label?: string;
  medium_label?: string;
  long_label?: string;
  heading_label?: string;
}

export interface UpdateDataElementParams {
  data_element_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  domain_name?: string;
  type_kind?: 'domain' | 'builtin';
  type_name?: string;
  data_type?: string;
  length?: number;
  decimals?: number;
  short_label?: string;
  medium_label?: string;
  long_label?: string;
  heading_label?: string;
  activate?: boolean;
}


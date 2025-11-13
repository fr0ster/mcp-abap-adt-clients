/**
 * Package types
 */

export interface CreatePackageParams {
  package_name: string;
  description?: string;
  super_package: string;
  package_type?: string;
  software_component?: string;
  transport_layer?: string;
  transport_request?: string;
  application_component?: string;
  responsible?: string;
}


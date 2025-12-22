/**
 * Package module type definitions
 */

import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';

// Low-level function parameters (snake_case)
export interface ICreatePackageParams {
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

// Builder configuration (camelCase)
// Note: superPackage is required for create operations (validated in builder methods)
// description is required for create/validate operations
export interface IPackageConfig {
  packageName: string; // Required
  superPackage?: string; // Required for create operations, optional for others
  description?: string; // Required for create/validate operations, optional for others
  updatedDescription?: string; // Description to use for update operation
  packageType?: string;
  softwareComponent?: string;
  transportLayer?: string;
  transportRequest?: string; // Only optional parameter
  applicationComponent?: string;
  responsible?: string;
  onLock?: (lockHandle: string) => void;
}

export interface IPackageState extends IAdtObjectState {}

/**
 * Package module type definitions
 */

import { BaseBuilderState } from '../shared/IBuilder';

// Low-level function parameters (snake_case)
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

// Builder configuration (camelCase)
export interface PackageBuilderConfig {
  packageName: string;
  superPackage: string;
  description: string;
  updatedDescription?: string; // Description to use for update operation
  packageType?: string;
  softwareComponent?: string;
  transportLayer?: string;
  transportRequest?: string;
  applicationComponent?: string;
  responsible?: string;
  onLock?: (lockHandle: string) => void;
}

export interface PackageBuilderState extends BaseBuilderState {
  lockResult?: string; // Package-specific: lock handle from lock operation
  // Other fields inherited from BaseBuilderState
}

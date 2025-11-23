/**
 * Package module type definitions
 */

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

export interface PackageBuilderState {
  validationResult?: { basic?: void; full?: void };
  createResult?: any;
  readResult?: any;
  checkResult?: void;
  lockResult?: string; // lock handle
  unlockResult?: any;
  updateResult?: any;
  deleteResult?: any;
  lockHandle?: string;
  errors: Array<{ method: string; error: Error; timestamp: Date }>;
}

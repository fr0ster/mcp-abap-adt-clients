/**
 * Package module type definitions
 */

import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';

export type {
  ICreatePackageParams,
  IDeletePackageParams,
  IReadPackageParams,
  IUpdatePackageParams,
} from '@mcp-abap-adt/interfaces';

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
  masterSystem?: string;
  recordChanges?: boolean;
  onLock?: (lockHandle: string) => void;
}

export interface IPackageState extends IAdtObjectState {}

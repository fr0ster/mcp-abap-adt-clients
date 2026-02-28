import type { IAdtResponse as AxiosResponse } from '@mcp-abap-adt/interfaces';

/**
 * Implementation type for Behavior Definition
 */
export type BehaviorDefinitionImplementationType =
  | 'Managed'
  | 'Unmanaged'
  | 'Abstract'
  | 'Projection';

/**
 * Parameters for validating a behavior definition before creation
 */
export interface IBehaviorDefinitionValidationParams {
  /** Name of the behavior definition object */
  objname: string;
  /** Root entity name */
  rootEntity: string;
  /** Description of the behavior definition */
  description: string;
  /** Package name where the object will be created */
  package: string;
  /** Implementation type (Managed, Unmanaged, Abstract, Projection) */
  implementationType: BehaviorDefinitionImplementationType;
}

/**
 * Validation result
 */
export interface IValidationResult {
  severity: 'OK' | 'ERROR' | 'WARNING';
  shortText?: string;
  longText?: string;
}

/**
 * Parameters for creating a behavior definition
 */
export interface IBehaviorDefinitionCreateParams {
  /** Name of the behavior definition */
  name: string;
  /** Description */
  description: string;
  /** Package name */
  package: string;
  /** Implementation type */
  implementationType: BehaviorDefinitionImplementationType;
  /** Language (default: EN) */
  language?: string;
  /** Responsible user */
  responsible?: string;
  /** Master system */
  masterSystem?: string;
  /** Transport request number */
  transportRequest?: string;
}

/**
 * Parameters for updating a behavior definition
 */
export interface IUpdateBehaviorDefinitionParams {
  /** Name of the behavior definition */
  name: string;
  /** Source code */
  sourceCode: string;
  /** Lock handle from lock operation */
  lockHandle: string;
  /** Optional transport request number */
  transportRequest?: string;
}

/**
 * Lock result containing lock handle
 */
export interface ILockResult {
  lockHandle: string;
  corrnr?: string;
  corruser?: string;
  corrtext?: string;
  isLocal?: boolean;
  isLinkUp?: boolean;
}

/**
 * Check reporter type
 */
export type CheckReporter = 'bdefImplementationCheck' | 'abapCheckRun';

/**
 * Check message from validation
 */
export interface ICheckMessage {
  uri: string;
  type: 'E' | 'W' | 'I' | 'S';
  shortText: string;
  code: string;
}

/**
 * Check run result
 */
export interface ICheckRunResult {
  reporter: CheckReporter;
  triggeringUri: string;
  status: string;
  statusText: string;
  messages?: ICheckMessage[];
}

// Builder configuration (camelCase)
// Note: packageName, description, implementationType are required for create/validate operations (validated in builder methods)
// rootEntity is required for validate operations
export interface IBehaviorDefinitionConfig {
  name: string; // Required
  packageName?: string; // Required for create/validate operations, optional for others
  transportRequest?: string; // Only optional parameter
  description?: string; // Required for create/validate operations, optional for others
  implementationType?: 'Managed' | 'Unmanaged' | 'Abstract' | 'Projection'; // Required for create/validate operations, optional for others
  rootEntity?: string; // Required for validate operations, optional for others
  sourceCode?: string;
  onLock?: (lockHandle: string) => void;
}

/**
 * State maintained by the Behavior Definition Builder
 */

import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';

/**
 * State maintained by the Behavior Definition Builder
 */
export interface IBehaviorDefinitionState extends IAdtObjectState {
  /** Name of the behavior definition */
  name?: string;
  /** Lock result */
  lockResult?: AxiosResponse<any>;
  /** Update source result (separate from updateResult) */
  updateSourceResult?: AxiosResponse<any>;
  /** Check results (array for multiple checks) */
  checkResults?: AxiosResponse<any>[];
  /** Delete check result */
  deleteCheckResult?: AxiosResponse<any>;
  /** Validation result */
  validationResult?: AxiosResponse<any>;
  // All operation results are in IAdtObjectState:
  // validationResponse, createResult, lockHandle, updateResult, checkResult,
  // unlockResult, activateResult, deleteResult, readResult, transportResult, errors
}

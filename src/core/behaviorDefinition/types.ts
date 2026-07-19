import type { IAdtResponse as AxiosResponse } from '@mcp-abap-adt/interfaces';

/**
 * Implementation type for Behavior Definition
 */
export type BehaviorDefinitionImplementationType =
  | 'Managed'
  | 'Unmanaged'
  | 'Abstract'
  | 'Projection';

// Low-level function parameters — defined in @mcp-abap-adt/interfaces
export type {
  IBehaviorDefinitionCreateParams,
  IBehaviorDefinitionValidationParams,
  IUpdateBehaviorDefinitionParams,
} from '@mcp-abap-adt/interfaces';

/**
 * Validation result
 */
export interface IValidationResult {
  severity: 'OK' | 'ERROR' | 'WARNING';
  shortText?: string;
  longText?: string;
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
  masterLanguage?: string; // Original/master language for create; falls back to systemContext (SAP_LANGUAGE), then EN
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
  lockResult?: AxiosResponse<unknown>;
  /** Update source result (separate from updateResult) */
  updateSourceResult?: AxiosResponse<unknown>;
  /** Check results (array for multiple checks) */
  checkResults?: AxiosResponse<unknown>[];
  /** Delete check result */
  deleteCheckResult?: AxiosResponse<unknown>;
  /** Validation result */
  validationResult?: AxiosResponse<unknown>;
  // All operation results are in IAdtObjectState:
  // validationResponse, createResult, lockHandle, updateResult, checkResult,
  // unlockResult, activateResult, deleteResult, readResult, transportResult, errors
}

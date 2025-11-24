import { AxiosResponse } from 'axios';

/**
 * Implementation type for Behavior Definition
 */
export type BehaviorDefinitionImplementationType = 'Managed' | 'Unmanaged' | 'Abstract' | 'Projection';

/**
 * Parameters for validating a behavior definition before creation
 */
export interface BehaviorDefinitionValidationParams {
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
export interface ValidationResult {
    severity: 'OK' | 'ERROR' | 'WARNING';
    shortText?: string;
    longText?: string;
}

/**
 * Parameters for creating a behavior definition
 */
export interface BehaviorDefinitionCreateParams {
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
}

/**
 * Lock result containing lock handle
 */
export interface LockResult {
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
export interface CheckMessage {
    uri: string;
    type: 'E' | 'W' | 'I' | 'S';
    shortText: string;
    code: string;
}

/**
 * Check run result
 */
export interface CheckRunResult {
    reporter: CheckReporter;
    triggeringUri: string;
    status: string;
    statusText: string;
    messages?: CheckMessage[];
}

// Builder configuration (camelCase)
export interface BehaviorDefinitionBuilderConfig {
  name: string;
  packageName?: string;
  transportRequest?: string;
  description: string;
  implementationType?: 'Managed' | 'Unmanaged' | 'Abstract' | 'Projection';
  rootEntity?: string;
  sourceCode?: string;
  onLock?: (lockHandle: string) => void;
}

/**
 * State maintained by the Behavior Definition Builder
 */

import { BaseBuilderState } from '../shared/IBuilder';

/**
 * State maintained by the Behavior Definition Builder
 */
export interface BehaviorDefinitionBuilderState extends BaseBuilderState {
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
    // Other fields inherited from BaseBuilderState
}

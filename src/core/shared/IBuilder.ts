/**
 * Base interface for all ADT Builders
 * Ensures consistent API across all builder implementations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { IAdtLogger } from '../../utils/logger';
import type { DomainBuilderConfig } from '../domain/types';
import type { ClassBuilderConfig } from '../class/types';
import type { InterfaceBuilderConfig } from '../interface/types';
import type { ProgramBuilderConfig } from '../program/types';
import type { DataElementBuilderConfig } from '../dataElement/types';
import type { StructureBuilderConfig } from '../structure/types';
import type { TableBuilderConfig } from '../table/types';
import type { ViewBuilderConfig } from '../view/types';
import type { FunctionModuleBuilderConfig } from '../functionModule/types';
import type { FunctionGroupBuilderConfig } from '../functionGroup/types';
import type { PackageBuilderConfig } from '../package/types';
import type { BehaviorDefinitionBuilderConfig } from '../behaviorDefinition/types';
import type { MetadataExtensionBuilderConfig } from '../metadataExtension/types';
import type { ServiceDefinitionBuilderConfig } from '../serviceDefinition/types';

/**
 * Union type of all BuilderConfig types that can be returned by read() methods
 */
export type BuilderConfigUnion =
  | DomainBuilderConfig
  | ClassBuilderConfig
  | InterfaceBuilderConfig
  | ProgramBuilderConfig
  | DataElementBuilderConfig
  | StructureBuilderConfig
  | TableBuilderConfig
  | ViewBuilderConfig
  | FunctionModuleBuilderConfig
  | FunctionGroupBuilderConfig
  | PackageBuilderConfig
  | BehaviorDefinitionBuilderConfig
  | MetadataExtensionBuilderConfig
  | ServiceDefinitionBuilderConfig
  | undefined;

/**
 * Base state interface that all Builder states should extend
 */
export interface BaseBuilderState {
  validationResponse?: AxiosResponse;
  createResult?: AxiosResponse;
  lockHandle?: string;
  updateResult?: AxiosResponse;
  checkResult?: AxiosResponse;
  unlockResult?: AxiosResponse;
  activateResult?: AxiosResponse;
  deleteResult?: AxiosResponse;
  readResult?: AxiosResponse;
  errors: Array<{ method: string; error: Error; timestamp: Date }>;
}

/**
 * Base interface for all ADT Builders
 * All builders must implement these methods
 * If an endpoint is not available for a specific object type, implement a stub method
 */
export interface IBuilder<TState extends BaseBuilderState = BaseBuilderState> {
  /**
   * Validate object name and configuration
   * Returns raw response from ADT - consumer decides how to interpret it
   * Note: This method doesn't modify builder state, returns result directly
   */
  validate(): Promise<AxiosResponse>;

  /**
   * Create the object in SAP
   * Returns this for method chaining
   */
  create(): Promise<this>;

  /**
   * Lock the object for modification
   * Returns this for method chaining
   */
  lock(): Promise<this>;

  /**
   * Update the object source/metadata
   * Returns this for method chaining
   */
  update(): Promise<this>;

  /**
   * Check the object (syntax check, status check, etc.)
   * Note: This method doesn't modify builder state, returns result directly
   * @param status - Optional status to check ('active', 'inactive', etc.)
   */
  check(status?: string): Promise<AxiosResponse>;

  /**
   * Unlock the object
   * Returns this for method chaining
   */
  unlock(): Promise<this>;

  /**
   * Activate the object
   * Returns this for method chaining
   */
  activate(): Promise<this>;

  /**
   * Delete the object
   * Returns this for method chaining
   */
  delete(): Promise<this>;

  /**
   * Read the object (source, metadata, etc.)
   * Note: This method doesn't modify builder state, returns result directly
   * Returns parsed config interface (e.g., DomainBuilderConfig) or source code
   * @param version - Optional version to read ('active', 'inactive')
   */
  read(version?: 'active' | 'inactive'): Promise<BuilderConfigUnion>;

  /**
   * Force unlock the object (cleanup method)
   */
  forceUnlock(): Promise<void>;

  /**
   * Get current builder state
   */
  getState(): Readonly<TState>;

  /**
   * Get all operation results
   */
  getResults(): {
    validation?: AxiosResponse;
    create?: AxiosResponse;
    update?: AxiosResponse;
    check?: AxiosResponse;
    unlock?: AxiosResponse;
    activate?: AxiosResponse;
    delete?: AxiosResponse;
    read?: AxiosResponse;
    lockHandle?: string;
    errors: Array<{ method: string; error: Error; timestamp: Date }>;
  };

  /**
   * Get all errors that occurred during operations
   */
  getErrors(): ReadonlyArray<{ method: string; error: Error; timestamp: Date }>;
}


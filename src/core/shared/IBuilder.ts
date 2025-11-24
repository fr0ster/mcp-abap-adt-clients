/**
 * Base interface for all ADT Builders
 * Ensures consistent API across all builder implementations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { IAdtLogger } from '../../utils/logger';

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
   */
  validate(): Promise<this>;

  /**
   * Create the object in SAP
   */
  create(): Promise<this>;

  /**
   * Lock the object for modification
   */
  lock(): Promise<this>;

  /**
   * Update the object source/metadata
   */
  update(): Promise<this>;

  /**
   * Check the object (syntax check, status check, etc.)
   * @param status - Optional status to check ('active', 'inactive', etc.)
   */
  check(status?: string): Promise<this>;

  /**
   * Unlock the object
   */
  unlock(): Promise<this>;

  /**
   * Activate the object
   */
  activate(): Promise<this>;

  /**
   * Delete the object
   */
  delete(): Promise<this>;

  /**
   * Read the object (source, metadata, etc.)
   * @param version - Optional version to read ('active', 'inactive')
   */
  read(version?: 'active' | 'inactive'): Promise<this>;

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


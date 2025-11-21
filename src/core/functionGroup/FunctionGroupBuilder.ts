/**
 * FunctionGroupBuilder - Fluent API for function group operations with Promise chaining
 *
 * Supports:
 * - Method chaining: builder.validate().then(b => b.create()).then(b => b.lock())...
 * - Error handling: .catch() for error callbacks
 * - Cleanup: .finally() for guaranteed execution
 * - Result storage: all results stored in logger/state
 * - Chain interruption: chain stops on first error (standard Promise behavior)
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { generateSessionId } from '../../utils/sessionUtils';
import { validateFunctionGroupName } from './validation';
import { create } from './create';
import { CreateFunctionGroupParams } from './types';
import { ValidationResult } from '../shared/validation';
import { lockFunctionGroup } from './lock';
import { unlockFunctionGroup } from './unlock';
import { activateFunctionGroup } from './activation';
import { deleteFunctionGroup } from './delete';
import { checkFunctionGroup } from './check';
import { getFunctionGroup } from './read';

export interface FunctionGroupBuilderLogger {
  debug?: (message: string, ...args: any[]) => void;
  info?: (message: string, ...args: any[]) => void;
  warn?: (message: string, ...args: any[]) => void;
  error?: (message: string, ...args: any[]) => void;
}

export interface FunctionGroupBuilderConfig {
  functionGroupName: string;
  packageName?: string;
  transportRequest?: string;
  description: string;
  sessionId?: string;
  // Optional callback to register lock in persistent storage
  // Called after successful lock() with: lockHandle, sessionId
  onLock?: (lockHandle: string, sessionId: string) => void;
}

export interface FunctionGroupBuilderState {
  validationResult?: ValidationResult;
  createResult?: AxiosResponse;
  lockHandle?: string;
  checkResult?: AxiosResponse;
  unlockResult?: AxiosResponse;
  activateResult?: AxiosResponse;
  deleteResult?: AxiosResponse;
  readResult?: AxiosResponse;
  errors: Array<{ method: string; error: Error; timestamp: Date }>;
}

export class FunctionGroupBuilder {
  private connection: AbapConnection;
  private logger: FunctionGroupBuilderLogger;
  private config: FunctionGroupBuilderConfig;
  private lockHandle?: string;
  private sessionId: string;
  private state: FunctionGroupBuilderState;

  constructor(
    connection: AbapConnection,
    logger: FunctionGroupBuilderLogger,
    config: FunctionGroupBuilderConfig
  ) {
    this.connection = connection;
    this.logger = logger;
    this.config = { ...config };
    this.sessionId = config.sessionId || generateSessionId();
    this.state = {
      errors: []
    };
  }

  // Builder methods - return this for chaining
  setPackage(packageName: string): this {
    this.config.packageName = packageName;
    this.logger.debug?.('Package set:', packageName);
    return this;
  }

  setRequest(transportRequest: string): this {
    this.config.transportRequest = transportRequest;
    this.logger.debug?.('Transport request set:', transportRequest);
    return this;
  }

  setName(functionGroupName: string): this {
    this.config.functionGroupName = functionGroupName;
    this.logger.debug?.('Function group name set:', functionGroupName);
    return this;
  }

  setDescription(description: string): this {
    this.config.description = description;
    return this;
  }

  // Operation methods - return Promise<this> for Promise chaining
  async validate(): Promise<this> {
    try {
      this.logger.info?.('Validating function group:', this.config.functionGroupName);
      const result = await validateFunctionGroupName(
        this.connection,
        this.config.functionGroupName,
        this.config.description
      );
      this.state.validationResult = result;
      this.logger.info?.('Validation successful:', result.valid);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'validate',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Validation failed:', error);
      throw error; // Interrupts chain
    }
  }

  async create(): Promise<this> {
    try {
      if (!this.config.packageName) {
        throw new Error('Package name is required');
      }
      this.logger.info?.('Creating function group:', this.config.functionGroupName);
      
      // Call low-level create function
      const result = await create(
        this.connection,
        this.config.functionGroupName,
        this.config.description,
        this.config.packageName,
        this.config.transportRequest
      );
      this.state.createResult = result;
      this.logger.info?.('Function group created successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'create',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Create failed:', error);
      throw error; // Interrupts chain
    }
  }

  async lock(): Promise<this> {
    try {
      this.logger.info?.('Locking function group:', this.config.functionGroupName);
      const lockHandle = await lockFunctionGroup(
        this.connection,
        this.config.functionGroupName,
        this.sessionId
      );
      this.lockHandle = lockHandle;
      this.state.lockHandle = lockHandle;

      // Register lock in persistent storage if callback provided
      if (this.config.onLock) {
        this.config.onLock(lockHandle, this.sessionId);
      }

      this.logger.info?.('Function group locked, handle:', lockHandle.substring(0, 10) + '...');
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'lock',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Lock failed:', error);
      throw error; // Interrupts chain
    }
  }

  async check(version: 'active' | 'inactive' = 'inactive', sourceCode?: string): Promise<this> {
    try {
      this.logger.info?.('Checking function group:', this.config.functionGroupName, 'version:', version);
      const result = await checkFunctionGroup(
        this.connection,
        this.config.functionGroupName,
        version,
        sourceCode,
        this.sessionId
      );
      this.state.checkResult = result;
      this.logger.info?.('Function group check successful:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'check',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Check failed:', error);
      throw error; // Interrupts chain
    }
  }

  async unlock(): Promise<this> {
    try {
      if (!this.lockHandle) {
        throw new Error('Function group is not locked. Call lock() first.');
      }
      this.logger.info?.('Unlocking function group:', this.config.functionGroupName);
      const result = await unlockFunctionGroup(
        this.connection,
        this.config.functionGroupName,
        this.lockHandle,
        this.sessionId
      );
      this.state.unlockResult = result;
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
      this.logger.info?.('Function group unlocked successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'unlock',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Unlock failed:', error);
      throw error; // Interrupts chain
    }
  }

  async activate(): Promise<this> {
    try {
      this.logger.info?.('Activating function group:', this.config.functionGroupName);
      const result = await activateFunctionGroup(
        this.connection,
        this.config.functionGroupName
      );
      this.state.activateResult = result;
      this.logger.info?.('Function group activated successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'activate',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Activate failed:', error);
      throw error; // Interrupts chain
    }
  }

  async delete(): Promise<this> {
    try {
      this.logger.info?.('Deleting function group:', this.config.functionGroupName);
      const result = await deleteFunctionGroup(
        this.connection,
        {
          function_group_name: this.config.functionGroupName,
          transport_request: this.config.transportRequest
        }
      );
      this.state.deleteResult = result;
      this.logger.info?.('Function group deleted successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'delete',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Delete failed:', error);
      throw error; // Interrupts chain
    }
  }

  async read(): Promise<this> {
    try {
      this.logger.info?.('Reading function group:', this.config.functionGroupName);
      const result = await getFunctionGroup(this.connection, this.config.functionGroupName);
      this.state.readResult = result;
      this.logger.info?.('Function group read successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'read',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Read failed:', error);
      throw error; // Interrupts chain
    }
  }

  async forceUnlock(): Promise<void> {
    if (!this.lockHandle) {
      return;
    }
    try {
      await unlockFunctionGroup(
        this.connection,
        this.config.functionGroupName,
        this.lockHandle,
        this.sessionId
      );
      this.logger.info?.('Force unlock successful for', this.config.functionGroupName);
    } catch (error: any) {
      this.logger.warn?.('Force unlock failed:', error);
    } finally {
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
    }
  }

  // Getters for accessing results
  getState(): Readonly<FunctionGroupBuilderState> {
    return { ...this.state };
  }

  getFunctionGroupName(): string {
    return this.config.functionGroupName;
  }

  getLockHandle(): string | undefined {
    return this.lockHandle;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getValidationResult(): ValidationResult | undefined {
    return this.state.validationResult;
  }

  getCreateResult(): AxiosResponse | undefined {
    return this.state.createResult;
  }

  getCheckResult(): AxiosResponse | undefined {
    return this.state.checkResult;
  }

  getUnlockResult(): AxiosResponse | undefined {
    return this.state.unlockResult;
  }

  getActivateResult(): AxiosResponse | undefined {
    return this.state.activateResult;
  }

  getDeleteResult(): AxiosResponse | undefined {
    return this.state.deleteResult;
  }

  getReadResult(): AxiosResponse | undefined {
    return this.state.readResult;
  }

  getErrors(): ReadonlyArray<{ method: string; error: Error; timestamp: Date }> {
    return [...this.state.errors];
  }

  // Helper method to get all results
  getResults(): {
    validation?: ValidationResult;
    create?: AxiosResponse;
    check?: AxiosResponse;
    unlock?: AxiosResponse;
    activate?: AxiosResponse;
    delete?: AxiosResponse;
    lockHandle?: string;
    errors: Array<{ method: string; error: Error; timestamp: Date }>;
  } {
    return {
      validation: this.state.validationResult,
      create: this.state.createResult,
      check: this.state.checkResult,
      unlock: this.state.unlockResult,
      activate: this.state.activateResult,
      delete: this.state.deleteResult,
      lockHandle: this.lockHandle,
      errors: [...this.state.errors]
    };
  }
}


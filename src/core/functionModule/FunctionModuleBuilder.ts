/**
 * FunctionModuleBuilder - Fluent API for function module operations with Promise chaining
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
import { IAdtLogger, logErrorSafely } from '../../utils/logger';
import { validateFunctionModuleName } from './validation';
import { create } from './create';
import { lockFunctionModule } from './lock';
import { update } from './update';
import { CreateFunctionModuleParams, FunctionModuleBuilderConfig, FunctionModuleBuilderState } from './types';
import { checkFunctionModule } from './check';
import { unlockFunctionModule } from './unlock';
import { activateFunctionModule } from './activation';
import { deleteFunctionModule } from './delete';
import { getFunctionSource } from './read';
import { IBuilder } from '../shared/IBuilder';

export class FunctionModuleBuilder implements IBuilder<FunctionModuleBuilderState> {
  private connection: AbapConnection;
  private logger: IAdtLogger;
  private config: FunctionModuleBuilderConfig;
  private sourceCode?: string;
  private lockHandle?: string;
  private state: FunctionModuleBuilderState;

  constructor(
    connection: AbapConnection,
    logger: IAdtLogger,
    config: FunctionModuleBuilderConfig
  ) {
    this.connection = connection;
    this.logger = logger;
    this.config = { ...config };
    this.sourceCode = config.sourceCode;
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

  setFunctionGroup(functionGroupName: string): this {
    this.config.functionGroupName = functionGroupName;
    this.logger.debug?.('Function group name set:', functionGroupName);
    return this;
  }

  setName(functionModuleName: string): this {
    this.config.functionModuleName = functionModuleName;
    this.logger.debug?.('Function module name set:', functionModuleName);
    return this;
  }

  setCode(sourceCode: string): this {
    this.sourceCode = sourceCode;
    this.logger.debug?.('Source code set, length:', sourceCode.length);
    return this;
  }

  setDescription(description: string): this {
    this.config.description = description;
    return this;
  }

  // Operation methods - return Promise<this> for Promise chaining
  async validate(): Promise<this> {
    try {
      this.logger.info?.('Validating function module:', this.config.functionModuleName);
      const result = await validateFunctionModuleName(
        this.connection,
        this.config.functionGroupName,
        this.config.functionModuleName,
        this.config.description
      );
      // Store raw response - consumer decides how to interpret it
      this.state.validationResponse = result;
      this.logger.info?.('Validation successful');
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
      this.logger.info?.('Creating function module metadata:', this.config.functionModuleName);
      
      // Call low-level create function (metadata only)
      const result = await create(
        this.connection,
        this.config.functionGroupName,
        this.config.functionModuleName,
        this.config.description,
        this.config.transportRequest
      );
      this.state.createResult = result;
      this.logger.info?.('Function module metadata created successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'create',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      logErrorSafely(this.logger, 'Create', error);
      throw error; // Interrupts chain
    }
  }

  async lock(): Promise<this> {
    try {
      this.logger.info?.('Locking function module:', this.config.functionModuleName);
      
      // Enable stateful session mode
      this.connection.setSessionType("stateful");

      const lockHandle = await lockFunctionModule(
        this.connection,
        this.config.functionGroupName,
        this.config.functionModuleName
      );
      this.lockHandle = lockHandle;
      this.state.lockHandle = lockHandle;

      // Register lock in persistent storage if callback provided
      if (this.config.onLock) {
        this.config.onLock(lockHandle);
      }

      this.logger.info?.('Function module locked, handle:', lockHandle);
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

  async update(sourceCode?: string): Promise<this> {
    try {
      if (!this.lockHandle) {
        throw new Error('Function module must be locked before update. Call lock() first.');
      }
      const code = sourceCode || this.sourceCode;
      if (!code) {
        throw new Error('Source code is required. Use setCode() or pass as parameter.');
      }
      this.logger.info?.('Updating function module source:', this.config.functionModuleName);
      const result = await update(
        this.connection,
        this.config.functionGroupName,
        this.config.functionModuleName,
        this.lockHandle,
        code,
        this.config.transportRequest
      );
      this.state.updateResult = result;
      this.logger.info?.('Function module updated successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'update',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Update failed:', error);
      throw error; // Interrupts chain
    }
  }

  async check(version: 'active' | 'inactive' = 'inactive', sourceCode?: string): Promise<this> {
    try {
      this.logger.info?.('Checking function module:', this.config.functionModuleName, 'version:', version);
      const result = await checkFunctionModule(
        this.connection,
        this.config.functionGroupName,
        this.config.functionModuleName,
        version,
        sourceCode
      );
      this.state.checkResult = result;
      this.logger.info?.('Function module check successful:', result.status);
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
        throw new Error('Function module is not locked. Call lock() first.');
      }
      this.logger.info?.('Unlocking function module:', this.config.functionModuleName);
      await unlockFunctionModule(
        this.connection,
        this.config.functionGroupName,
        this.config.functionModuleName,
        this.lockHandle
      );
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
      this.logger.info?.('Function module unlocked successfully');
      
      // Enable stateless session mode
      this.connection.setSessionType("stateless");

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
      this.logger.info?.('Activating function module:', this.config.functionModuleName);
      const result = await activateFunctionModule(
        this.connection,
        this.config.functionGroupName,
        this.config.functionModuleName
      );
      this.state.activateResult = result;
      this.logger.info?.('Function module activated successfully:', result.status);
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
      this.logger.info?.('Deleting functionmodule:', this.config.functionModuleName);
      const result = await deleteFunctionModule(
        this.connection,
        {
          function_module_name: this.config.functionModuleName,
          function_group_name: this.config.functionGroupName,
          transport_request: this.config.transportRequest
        }
      );
      this.state.deleteResult = result;
      this.logger.info?.('FunctionModule deleted successfully:', result.status);
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

  async read(version: 'active' | 'inactive' = 'active'): Promise<this> {
    try {
      this.logger.info?.('Reading function module:', this.config.functionModuleName);
      const result = await getFunctionSource(
        this.connection,
        this.config.functionModuleName,
        this.config.functionGroupName,
        version
      );
      this.state.readResult = result;
      this.logger.info?.('Function module read successfully:', result.status);
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
      await unlockFunctionModule(
        this.connection,
        this.config.functionGroupName,
        this.config.functionModuleName,
        this.lockHandle,
      );
      this.logger.info?.('Force unlock successful for', this.config.functionModuleName);
    } catch (error: any) {
      this.logger.warn?.('Force unlock failed:', error);
    } finally {
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
    }
  }

  // Getters for accessing results
  getState(): Readonly<FunctionModuleBuilderState> {
    return { ...this.state };
  }

  getFunctionModuleName(): string {
    return this.config.functionModuleName;
  }

  getFunctionGroupName(): string {
    return this.config.functionGroupName;
  }

  getLockHandle(): string | undefined {
    return this.lockHandle;
  }

  getSessionId(): string | null {
    return this.connection.getSessionId();
  }

  getValidationResponse(): AxiosResponse | undefined {
    return this.state.validationResponse;
  }

  getCreateResult(): AxiosResponse | undefined {
    return this.state.createResult;
  }

  getUpdateResult(): AxiosResponse | undefined {
    return this.state.updateResult;
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
  } {
    return {
      validation: this.state.validationResponse,
      create: this.state.createResult,
      update: this.state.updateResult,
      check: this.state.checkResult,
      unlock: this.state.unlockResult,
      activate: this.state.activateResult,
      delete: this.state.deleteResult,
      read: this.state.readResult,
      lockHandle: this.lockHandle,
      errors: [...this.state.errors]
    };
  }
}


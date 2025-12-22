/**
 * BehaviorDefinitionBuilder - Fluent API for behavior definition operations with Promise chaining
 *
 * Supports:
 * - Method chaining: builder.validate().then(b => b.create()).then(b => b.lock())...
 * - Error handling: .catch() for error callbacks
 * - Cleanup: .finally() for guaranteed execution
 * - Result storage: all results stored in logger/state
 * - Chain interruption: chain stops on first error (standard Promise behavior)
 */

import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { activate } from './activation';
import { checkAbap, checkImplementation } from './check';
import { create } from './create';
import { checkDeletion, deleteBehaviorDefinition } from './delete';
import { lock } from './lock';
import { read, readSource } from './read';
import type {
  IBehaviorDefinitionConfig,
  IBehaviorDefinitionCreateParams,
  IBehaviorDefinitionState,
  IBehaviorDefinitionValidationParams,
  IUpdateBehaviorDefinitionParams,
} from './types';
import { unlock } from './unlock';
import { update } from './update';
import { validate } from './validation';

export class BehaviorDefinitionBuilder {
  private connection: IAbapConnection;
  private logger?: ILogger;
  private config: IBehaviorDefinitionConfig;
  private sourceCode?: string;
  private lockHandle?: string;
  private state: IBehaviorDefinitionState;

  constructor(
    connection: IAbapConnection,
    config: IBehaviorDefinitionConfig,
    logger?: ILogger,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.config = { ...config };
    this.sourceCode = config.sourceCode;
    this.state = { errors: [] };
  }

  // Builder methods - return this for chaining
  setPackage(packageName: string): this {
    this.config.packageName = packageName;
    this.logger?.debug('Package set:', packageName);
    return this;
  }

  setRequest(transportRequest: string): this {
    this.config.transportRequest = transportRequest;
    this.logger?.debug('Transport request set:', transportRequest);
    return this;
  }

  setName(name: string): this {
    this.config.name = name;
    this.logger?.debug('Behavior definition name set:', name);
    return this;
  }

  setCode(sourceCode: string): this {
    this.sourceCode = sourceCode;
    this.logger?.debug(`'Source code set  length:' ${`sourceCode.length`}`);
    return this;
  }

  setDescription(description: string): this {
    this.config.description = description;
    return this;
  }

  setImplementationType(
    implementationType: 'Managed' | 'Unmanaged' | 'Abstract' | 'Projection',
  ): this {
    this.config.implementationType = implementationType;
    return this;
  }

  setRootEntity(rootEntity: string): this {
    this.config.rootEntity = rootEntity;
    return this;
  }

  // Operation methods - return Promise<this> for Promise chaining
  async validate(): Promise<this> {
    try {
      if (!this.config.rootEntity) {
        throw new Error('Root entity is required for validation');
      }
      if (!this.config.packageName) {
        throw new Error('Package name is required for validation');
      }

      this.logger?.info('Validating behavior definition:', this.config.name);

      const params: IBehaviorDefinitionValidationParams = {
        objname: this.config.name,
        rootEntity: this.config.rootEntity,
        description: this.config.description || '',
        package: this.config.packageName,
        implementationType: this.config.implementationType || 'Managed',
      };

      const response = await validate(this.connection, params);

      // Store raw response - consumer decides how to interpret it
      this.state.validationResponse = response;
      this.logger?.info('Validation successful');
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'validate',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      });
      this.logger?.error('Validation failed:', error);
      throw error; // Interrupts chain
    }
  }

  async create(): Promise<this> {
    try {
      if (!this.config.packageName) {
        throw new Error('Package name is required');
      }

      this.logger?.info('Creating behavior definition:', this.config.name);

      const params: IBehaviorDefinitionCreateParams = {
        name: this.config.name,
        package: this.config.packageName,
        description: this.config.description || '',
        implementationType: this.config.implementationType || 'Managed',
      };

      const result = await create(this.connection, params);
      this.state.createResult = result;
      this.logger?.info(
        'Behavior definition created successfully:',
        result.status,
      );
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'create',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      });
      this.logger?.error('Create failed:', error);
      throw error; // Interrupts chain
    }
  }

  async lock(): Promise<this> {
    try {
      this.logger?.info('Locking behavior definition:', this.config.name);

      // Enable stateful session mode
      this.connection.setSessionType('stateful');

      const lockHandle = await lock(this.connection, this.config.name);
      this.lockHandle = lockHandle;
      this.state.lockHandle = lockHandle;

      // Register lock in persistent storage if callback provided
      if (this.config.onLock) {
        this.config.onLock(lockHandle);
      }

      this.logger?.info(
        `'Behavior definition locked  handle:' ${`lockHandle`}`,
      );
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'lock',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      });
      this.logger?.error('Lock failed:', error);
      throw error; // Interrupts chain
    }
  }

  async readSource(): Promise<this> {
    try {
      this.logger?.info(
        'Reading behavior definition source:',
        this.config.name,
      );
      const response = await readSource(this.connection, this.config.name);
      this.sourceCode = response.data;
      this.logger?.info(
        `'Source code read  length:' ${`response.data?.length || 0`}`,
      );
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'readSource',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      });
      this.logger?.error('Read source failed:', error);
      throw error;
    }
  }

  async update(sourceCode?: string): Promise<this> {
    try {
      if (!this.lockHandle) {
        throw new Error(
          'Behavior definition must be locked before update. Call lock() first.',
        );
      }
      const code = sourceCode || this.sourceCode;
      if (!code) {
        throw new Error(
          'Source code is required. Use setCode() or pass as parameter.',
        );
      }
      this.logger?.info(
        'Updating behavior definition source:',
        this.config.name,
      );

      const params: IUpdateBehaviorDefinitionParams = {
        name: this.config.name,
        sourceCode: code,
        lockHandle: this.lockHandle,
        transportRequest: this.config.transportRequest,
      };
      const result = await update(this.connection, params);

      this.state.updateResult = result;
      this.logger?.info(
        'Behavior definition updated successfully:',
        result.status,
      );
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'update',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      });
      this.logger?.error('Update failed:', error);
      throw error; // Interrupts chain
    }
  }

  async check(
    version: 'active' | 'inactive' = 'inactive',
    sourceCode?: string,
  ): Promise<this> {
    try {
      this.logger?.info(
        `'Checking behavior definition:'  this.config.name  'version:' ${`version`}`,
      );

      // Use provided source code or stored source code
      const codeToCheck = sourceCode || this.sourceCode;

      // Run both implementation check and ABAP check
      const implResult = await checkImplementation(
        this.connection,
        this.config.name,
        version,
        codeToCheck,
      );

      const abapResult = await checkAbap(
        this.connection,
        this.config.name,
        version,
        codeToCheck,
      );

      this.state.checkResults = [implResult, abapResult];
      this.logger?.info('Behavior definition check successful');
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'check',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      });
      this.logger?.error('Check failed:', error);
      throw error; // Interrupts chain
    }
  }

  async unlock(): Promise<this> {
    try {
      if (!this.lockHandle) {
        throw new Error(
          'Behavior definition is not locked. Call lock() first.',
        );
      }
      this.logger?.info('Unlocking behavior definition:', this.config.name);
      const result = await unlock(
        this.connection,
        this.config.name,
        this.lockHandle,
      );
      this.state.unlockResult = result;
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
      this.logger?.info('Behavior definition unlocked successfully');

      // Enable stateless session mode
      this.connection.setSessionType('stateless');

      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'unlock',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      });
      this.logger?.error('Unlock failed:', error);
      throw error; // Interrupts chain
    }
  }

  async activate(preauditRequested: boolean = false): Promise<this> {
    try {
      this.logger?.info('Activating behavior definition:', this.config.name);
      const result = await activate(
        this.connection,
        this.config.name,
        preauditRequested,
      );
      this.state.activateResult = result;
      this.logger?.info(
        'Behavior definition activated successfully:',
        result.status,
      );
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'activate',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      });
      this.logger?.error('Activate failed:', error);
      throw error; // Interrupts chain
    }
  }

  async checkDeletion(): Promise<this> {
    try {
      this.logger?.info(
        'Checking deletion for behavior definition:',
        this.config.name,
      );
      const result = await checkDeletion(this.connection, this.config.name);
      this.state.deleteCheckResult = result;
      this.logger?.info('Deletion check successful:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'checkDeletion',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      });
      this.logger?.error('Deletion check failed:', error);
      throw error;
    }
  }

  async delete(): Promise<this> {
    try {
      this.logger?.info('Deleting behavior definition:', this.config.name);
      const result = await deleteBehaviorDefinition(
        this.connection,
        this.config.name,
        this.config.transportRequest,
      );
      this.state.deleteResult = result;
      this.logger?.info(
        'Behavior definition deleted successfully:',
        result.status,
      );
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'delete',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      });
      this.logger?.error('Delete failed:', error);
      throw error; // Interrupts chain
    }
  }

  async read(
    version: 'active' | 'inactive' = 'inactive',
    options?: { withLongPolling?: boolean },
  ): Promise<this> {
    try {
      this.logger?.info(
        'Reading behavior definition metadata:',
        this.config.name,
      );
      const result = await read(
        this.connection,
        this.config.name,
        '',
        version,
        options?.withLongPolling !== undefined
          ? { withLongPolling: options.withLongPolling }
          : undefined,
      );
      this.state.readResult = result;
      this.logger?.info(
        'Behavior definition read successfully:',
        result.status,
      );
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'read',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      });
      this.logger?.error('Read failed:', error);
      throw error; // Interrupts chain
    }
  }

  async forceUnlock(): Promise<void> {
    if (!this.lockHandle) {
      return;
    }
    try {
      await unlock(this.connection, this.config.name, this.lockHandle);
      this.logger?.info('Force unlock successful for', this.config.name);
    } catch (error: any) {
      this.logger?.warn('Force unlock failed:', error);
    } finally {
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
    }
  }

  // Getters for accessing results
  getState(): Readonly<IBehaviorDefinitionState> {
    return { ...this.state };
  }

  getName(): string {
    return this.config.name;
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

  getCheckResults(): AxiosResponse[] | undefined {
    return this.state.checkResults;
  }

  getUnlockResult(): AxiosResponse | undefined {
    return this.state.unlockResult;
  }

  getActivateResult(): AxiosResponse | undefined {
    return this.state.activateResult;
  }

  getDeleteCheckResult(): AxiosResponse | undefined {
    return this.state.deleteCheckResult;
  }

  getDeleteResult(): AxiosResponse | undefined {
    return this.state.deleteResult;
  }

  getReadResult(): AxiosResponse | undefined {
    return this.state.readResult;
  }

  getErrors(): ReadonlyArray<{
    method: string;
    error: Error;
    timestamp: Date;
  }> {
    return [...this.state.errors];
  }

  // Helper method to get all results
  getResults(): {
    validation?: AxiosResponse;
    create?: AxiosResponse;
    update?: AxiosResponse;
    check?: AxiosResponse[];
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
      check: this.state.checkResults,
      unlock: this.state.unlockResult,
      activate: this.state.activateResult,
      delete: this.state.deleteResult,
      read: this.state.readResult,
      lockHandle: this.lockHandle,
      errors: [...this.state.errors],
    };
  }
}

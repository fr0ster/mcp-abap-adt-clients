/**
 * StructureBuilder - Fluent API for structure operations with Promise chaining
 *
 * Supports:
 * - Method chaining: builder.create().then(b => b.lock()).then(b => b.update())...
 * - Error handling: .catch() for error callbacks
 * - Cleanup: .finally() for guaranteed execution
 * - Result storage: all results stored in logger/state
 * - Chain interruption: chain stops on first error (standard Promise behavior)
 *
 * @example
 * ```typescript
 * const builder = new StructureBuilder(connection, logger, {
 *   structureName: 'Z_TEST_STRUCT',
 *   packageName: 'ZOK_TEST_PKG_01'
 * });
 *
 * await builder
 *   .setFields([{ name: 'FIELD1', data_type: 'CHAR', length: 10 }])
 *   .create()
 *   .then(b => b.lock())
 *   .then(b => b.update())
 *   .then(b => b.check())
 *   .then(b => b.unlock())
 *   .then(b => b.activate())
 *   .catch(error => {
 *     logger.error('Operation failed:', error);
 *   });
 * ```
 */

import { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import { IAdtLogger, logErrorSafely } from '../../utils/logger';
import { create } from './create';
import { lockStructure } from './lock';
import { upload } from './update';
import { checkStructure } from './check';
import { unlockStructure } from './unlock';
import { activateStructure } from './activation';
import { deleteStructure } from './delete';
import { validateStructureName } from './validation';
import { IStructureField, IStructureInclude, ICreateStructureParams, IUpdateStructureParams, IStructureConfig, IStructureState } from './types';
import { getStructureSource } from './read';
import { IBuilder } from '../shared/IBuilder';

export class StructureBuilder implements IBuilder<IStructureState> {
  private connection: IAbapConnection;
  private logger: IAdtLogger;
  private config: IStructureConfig;
  private lockHandle?: string;
  private state: IStructureState;

  constructor(
    connection: IAbapConnection,
    logger: IAdtLogger,
    config: IStructureConfig
  ) {
    this.connection = connection;
    this.logger = logger;
    this.config = { ...config };
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

  setName(structureName: string): this {
    this.config.structureName = structureName;
    this.logger.debug?.('Structure name set:', structureName);
    return this;
  }

  setDescription(description: string): this {
    this.config.description = description;
    return this;
  }

  setDdlCode(ddlCode: string): this {
    this.config.ddlCode = ddlCode;
    this.logger.debug?.('DDL code set');
    return this;
  }

  setFields(fields: IStructureField[]): this {
    this.config.fields = fields;
    this.logger.debug?.('Fields set:', fields.length);
    return this;
  }

  setIncludes(includes: IStructureInclude[]): this {
    this.config.includes = includes;
    this.logger.debug?.('Includes set:', includes.length);
    return this;
  }

  addField(field: IStructureField): this {
    if (!this.config.fields) {
      this.config.fields = [];
    }
    this.config.fields.push(field);
    return this;
  }

  addInclude(include: IStructureInclude): this {
    if (!this.config.includes) {
      this.config.includes = [];
    }
    this.config.includes.push(include);
    return this;
  }

  // Operation methods - return Promise<this> for Promise chaining
  async validate(): Promise<AxiosResponse> {
    try {
      this.logger.info?.('Validating structure name:', this.config.structureName);
      const response = await validateStructureName(
        this.connection,
        this.config.structureName,
        this.config.description
      );
      
      // Store raw response for backward compatibility
      this.state.validationResponse = response;
      this.logger.info?.('Structure name validation successful');
      return response;
    } catch (error: any) {
      // For validation, HTTP 400 might indicate object exists - store response for analysis
      if (error.response && error.response.status === 400) {
        this.state.validationResponse = error.response;
        this.logger.info?.('Structure validation returned 400 - object may already exist');
        return error.response;
      }
      // Store error response if available
      if (error.response) {
        this.state.validationResponse = error.response;
      }
      this.state.errors.push({
        method: 'validate',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Validation failed:', error);
      throw error;
    }
  }

  async create(): Promise<this> {
    try {
      if (!this.config.packageName) {
        throw new Error('Package name is required');
      }
      this.logger.info?.('Creating structure metadata:', this.config.structureName);
      
      // Call low-level create function (metadata only)
      const params: ICreateStructureParams = {
        structureName: this.config.structureName,
        description: this.config.description || '',
        packageName: this.config.packageName,
        transportRequest: this.config.transportRequest
      };
      const result = await create(this.connection, params);
      this.state.createResult = result;
      this.logger.info?.('Structure metadata created successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'create',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      logErrorSafely(this.logger, 'Create', error);
      throw error;
    }
  }

  async lock(): Promise<this> {
    try {
      this.logger.info?.('Locking structure:', this.config.structureName);
      
      // Enable stateful mode for lock operation
      this.connection.setSessionType('stateful');
      
      const lockHandle = await lockStructure(
        this.connection,
        this.config.structureName
      );
      this.lockHandle = lockHandle;
      this.state.lockHandle = lockHandle;

      // Register lock in persistent storage if callback provided
      if (this.config.onLock) {
        this.config.onLock(lockHandle);
      }

      this.logger.info?.('Structure locked, handle:', lockHandle);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'lock',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Lock failed:', error);
      throw error;
    }
  }

  async update(ddlCode?: string): Promise<this> {
    try {
      if (!this.lockHandle) {
        throw new Error('Structure must be locked before update. Call lock() first.');
      }
      const code = ddlCode || this.config.ddlCode;
      if (!code) {
        throw new Error('DDL code is required. Use setDdlCode() or pass as parameter.');
      }
      this.logger.info?.('Updating structure DDL:', this.config.structureName);
      
      const params: IUpdateStructureParams = {
        structureName: this.config.structureName,
        ddlCode: code,
        transportRequest: this.config.transportRequest
      };
      const result = await upload(this.connection, params, this.lockHandle);
      this.state.updateResult = result;
      this.logger.info?.('Structure updated successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'update',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Update failed:', error);
      throw error;
    }
  }

  async check(version: 'active' | 'inactive' = 'inactive', sourceCode?: string): Promise<AxiosResponse> {
    try {
      const codeToCheck = sourceCode || this.config.ddlCode;
      this.logger.info?.('Checking structure:', this.config.structureName, 'version:', version, codeToCheck ? 'with source code' : 'saved version');
      const result = await checkStructure(
        this.connection,
        this.config.structureName,
        version,
        codeToCheck
      );
      // Store result for backward compatibility
      this.state.checkResult = result;
      this.logger.info?.('Structure check successful:', result.status);
      return result;
    } catch (error: any) {
      this.state.errors.push({
        method: 'check',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Check failed:', error);
      throw error;
    }
  }

  async unlock(): Promise<this> {
    try {
      if (!this.lockHandle) {
        throw new Error('Structure is not locked. Call lock() first.');
      }
      this.logger.info?.('Unlocking structure:', this.config.structureName);
      const result = await unlockStructure(
        this.connection,
        this.config.structureName,
        this.lockHandle,
      );
      this.state.unlockResult = result;
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
      
      // Disable stateful mode after unlock
      this.connection.setSessionType('stateless');
      
      this.logger.info?.('Structure unlocked successfully');
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'unlock',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Unlock failed:', error);
      throw error;
    }
  }

  async activate(): Promise<this> {
    try {
      this.logger.info?.('Activating structure:', this.config.structureName);
      const result = await activateStructure(
        this.connection,
        this.config.structureName
      );
      this.state.activateResult = result;
      this.logger.info?.('Structure activated successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'activate',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Activate failed:', error);
      throw error;
    }
  }


  async delete(): Promise<this> {
    try {
      this.logger.info?.('Deleting structure:', this.config.structureName);
      const result = await deleteStructure(
        this.connection,
        {
          structure_name: this.config.structureName,
          transport_request: this.config.transportRequest
        }
      );
      this.state.deleteResult = result;
      this.logger.info?.('Structure deleted successfully:', result.status);
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

  async read(version: 'active' | 'inactive' = 'active'): Promise<IStructureConfig | undefined> {
    try {
      this.logger.info?.('Reading structure:', this.config.structureName);
      const result = await getStructureSource(this.connection, this.config.structureName);
      // Store raw response for backward compatibility
      this.state.readResult = result;
      this.logger.info?.('Structure read successfully:', result.status);
      
      // Parse and return config directly
      const ddlCode = typeof result.data === 'string'
        ? result.data
        : JSON.stringify(result.data);
      
      return {
        structureName: this.config.structureName,
        ddlCode
      };
    } catch (error: any) {
      this.state.errors.push({
        method: 'read',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Read failed:', error);
      throw error;
    }
  }

  async forceUnlock(): Promise<void> {
    if (!this.lockHandle) {
      return;
    }
    try {
      await unlockStructure(
        this.connection,
        this.config.structureName,
        this.lockHandle,
      );
      this.logger.info?.('Force unlock successful for', this.config.structureName);
    } catch (error: any) {
      this.logger.warn?.('Force unlock failed:', error);
    } finally {
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
    }
  }

  // Getters for accessing results
  getState(): Readonly<IStructureState> {
    return { ...this.state };
  }

  getStructureName(): string {
    return this.config.structureName;
  }

  getLockHandle(): string | undefined {
    return this.lockHandle;
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

  getReadResult(): IStructureConfig | undefined {
    if (!this.state.readResult) {
      return undefined;
    }

    // Structure read() returns DDL source code (plain text)
    const ddlCode = typeof this.state.readResult.data === 'string'
      ? this.state.readResult.data
      : JSON.stringify(this.state.readResult.data);

    return {
      structureName: this.config.structureName,
      ddlCode
    };
  }

  getErrors(): ReadonlyArray<{ method: string; error: Error; timestamp: Date }> {
    return [...this.state.errors];
  }

  getResults(): {
    validate?: AxiosResponse;
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
      validate: this.state.validationResponse,
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


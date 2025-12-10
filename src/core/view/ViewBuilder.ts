/**
 * ViewBuilder - Fluent API for view operations with Promise chaining
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
 * const builder = new ViewBuilder(connection, logger, {
 *   viewName: 'Z_TEST_VIEW',
 *   packageName: 'ZOK_TEST_PKG_01'
 * });
 *
 * await builder
 *   .setDdlSource('@AbapCatalog.viewType: #BASIC\n...')
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
import { createView } from './create';
import { updateView } from './update';
import { lockDDLS } from './lock';
import { checkView } from './check';
import { unlockDDLS } from './unlock';
import { activateDDLS } from './activation';
import { deleteView } from './delete';
import { validateViewName } from './validation';
import { ICreateViewParams, IUpdateViewSourceParams, IViewConfig, IViewState } from './types';
import { getViewSource } from './read';

export class ViewBuilder {
  private connection: IAbapConnection;
  private logger: IAdtLogger;
  private config: IViewConfig;
  private lockHandle?: string;
  private state: IViewState;

  constructor(
    connection: IAbapConnection,
    logger: IAdtLogger,
    config: IViewConfig
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

  setName(viewName: string): this {
    this.config.viewName = viewName;
    this.logger.debug?.('View name set:', viewName);
    return this;
  }

  setDescription(description: string): this {
    this.config.description = description;
    return this;
  }

  setDdlSource(ddlSource: string): this {
    this.config.ddlSource = ddlSource;
    this.logger.debug?.('DDL source set, length:', ddlSource.length);
    return this;
  }

  // Operation methods - return Promise<this> for Promise chaining
  async validate(): Promise<AxiosResponse> {
    try {
      if (!this.config.packageName) {
        throw new Error('Package name is required for view validation');
      }
      this.logger.info?.('Validating view name:', this.config.viewName);
      const response = await validateViewName(
        this.connection,
        this.config.viewName,
        this.config.packageName,
        this.config.description
      );
      
      // Store raw response for backward compatibility
      this.state.validationResponse = response;
      this.logger.info?.('View name validation successful');
      return response;
    } catch (error: any) {
      // For validation, HTTP 400 might indicate object exists - store response for analysis
      if (error.response && error.response.status === 400) {
        this.state.validationResponse = error.response;
        this.logger.info?.('View validation returned 400 - object may already exist');
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
      
      this.logger.info?.('Creating view:', this.config.viewName);
      
      // Enable stateful session mode for create operation
      this.connection.setSessionType("stateful");
      
      const params: ICreateViewParams = {
        view_name: this.config.viewName,
        package_name: this.config.packageName,
        transport_request: this.config.transportRequest,
        description: this.config.description
      };
      const result = await createView(this.connection, params);
      this.state.createResult = result;
      
      this.logger.info?.('View created successfully:', result.status);
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
      this.logger.info?.('Locking view:', this.config.viewName);
      
      // Enable stateful session mode
      this.connection.setSessionType("stateful");

      const lockHandle = await lockDDLS(
        this.connection,
        this.config.viewName,
      );
      this.lockHandle = lockHandle;
      this.state.lockHandle = lockHandle;

      // Register lock in persistent storage if callback provided
      if (this.config.onLock) {
        this.config.onLock(lockHandle);
      }

      this.logger.info?.('View locked, handle:', lockHandle);
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

  async update(): Promise<this> {
    try {
      if (!this.lockHandle) {
        throw new Error('View must be locked before update. Call lock() first.');
      }
      if (!this.config.ddlSource) {
        throw new Error('DDL source is required');
      }
      
      this.logger.info?.('Updating view:', this.config.viewName);
      
      // Upload DDL source with existing lock handle
      const result = await updateView(
        this.connection,
        this.config.viewName,
        this.config.ddlSource,
        this.lockHandle,
        this.config.transportRequest
      );
      
      this.state.updateResult = result;
      this.logger.info?.('View updated successfully:', result.status);
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
      const codeToCheck = sourceCode || this.config.ddlSource;
      this.logger.info?.('Checking view:', this.config.viewName, 'version:', version, codeToCheck ? 'with source code' : 'saved version');
      const result = await checkView(
        this.connection,
        this.config.viewName,
        version,
        codeToCheck
      );
      // Store result for backward compatibility
      this.state.checkResult = result;
      this.logger.info?.('View check successful:', result.status);
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
        throw new Error('View is not locked. Call lock() first.');
      }
      this.logger.info?.('Unlocking view:', this.config.viewName);
      const result = await unlockDDLS(
        this.connection,
        this.config.viewName,
        this.lockHandle
      );
      this.state.unlockResult = result;
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
      this.logger.info?.('View unlocked successfully');
      
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
      throw error;
    }
  }

  async activate(): Promise<this> {
    try {
      this.logger.info?.('Activating view:', this.config.viewName);
      const result = await activateDDLS(
        this.connection,
        this.config.viewName
      );
      this.state.activateResult = result;
      this.logger.info?.('View activated successfully:', result.status);
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
      this.logger.info?.('Deleting view:', this.config.viewName);
      const result = await deleteView(
        this.connection,
        {
          view_name: this.config.viewName,
          transport_request: this.config.transportRequest
        }
      );
      this.state.deleteResult = result;
      this.logger.info?.('View deleted successfully:', result.status);
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

  async read(version: 'active' | 'inactive' = 'active'): Promise<IViewConfig | undefined> {
    try {
      this.logger.info?.('Reading view:', this.config.viewName);
      const result = await getViewSource(this.connection, this.config.viewName);
      // Store raw response for backward compatibility
      this.state.readResult = result;
      this.logger.info?.('View read successfully:', result.status);
      
      // Parse and return config directly
      const ddlSource = typeof result.data === 'string'
        ? result.data
        : JSON.stringify(result.data);
      
      return {
        viewName: this.config.viewName,
        ddlSource
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
      await unlockDDLS(
        this.connection,
        this.config.viewName,
        this.lockHandle
      );
      this.logger.info?.('Force unlock successful for', this.config.viewName);
    } catch (error: any) {
      this.logger.warn?.('Force unlock failed:', error);
    } finally {
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
    }
  }

  // Getters for accessing results
  getState(): Readonly<IViewState> {
    return { ...this.state };
  }

  getViewName(): string {
    return this.config.viewName;
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

  getReadResult(): IViewConfig | undefined {
    if (!this.state.readResult) {
      return undefined;
    }

    // View read() returns DDL source code (plain text)
    const ddlSource = typeof this.state.readResult.data === 'string'
      ? this.state.readResult.data
      : JSON.stringify(this.state.readResult.data);

    return {
      viewName: this.config.viewName,
      ddlSource
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


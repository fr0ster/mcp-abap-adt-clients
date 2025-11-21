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

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { generateSessionId } from '../../utils/sessionUtils';
import { createView } from './create';
import { lockDDLS } from './lock';
import { updateViewSource } from './update';
import { checkView } from './check';
import { unlockDDLS } from './unlock';
import { activateDDLS } from './activation';
import { deleteView } from './delete';
import { validateViewName } from './validation';
import { CreateViewParams, UpdateViewSourceParams } from './types';
import { ValidationResult } from '../shared/validation';
import { getViewSource } from './read';

export interface ViewBuilderLogger {
  debug?: (message: string, ...args: any[]) => void;
  info?: (message: string, ...args: any[]) => void;
  warn?: (message: string, ...args: any[]) => void;
  error?: (message: string, ...args: any[]) => void;
}

export interface ViewBuilderConfig {
  viewName: string;
  packageName?: string;
  transportRequest?: string;
  description: string;
  ddlSource?: string;
  sessionId?: string;
  // Optional callback to register lock in persistent storage
  // Called after successful lock() with: lockHandle, sessionId
  onLock?: (lockHandle: string, sessionId: string) => void;
}

export interface ViewBuilderState {
  validationResult?: ValidationResult;
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

export class ViewBuilder {
  private connection: AbapConnection;
  private logger: ViewBuilderLogger;
  private config: ViewBuilderConfig;
  private lockHandle?: string;
  private sessionId: string;
  private state: ViewBuilderState;

  constructor(
    connection: AbapConnection,
    logger: ViewBuilderLogger,
    config: ViewBuilderConfig
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
  async validate(): Promise<this> {
    try {
      this.logger.info?.('Validating view name:', this.config.viewName);
      const result = await validateViewName(
        this.connection,
        this.config.viewName,
        this.config.description
      );
      this.state.validationResult = result;
      if (!result.valid) {
        throw new Error(`View name validation failed: ${result.message}`);
      }
      this.logger.info?.('View name validation successful');
      return this;
    } catch (error: any) {
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
      if (!this.config.ddlSource) {
        throw new Error('DDL source is required');
      }
      this.logger.info?.('Creating view:', this.config.viewName);
      const params: CreateViewParams = {
        view_name: this.config.viewName,
        ddl_source: this.config.ddlSource,
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
      this.logger.error?.('Create failed:', error);
      throw error;
    }
  }

  async lock(): Promise<this> {
    try {
      this.logger.info?.('Locking view:', this.config.viewName);
      const lockHandle = await lockDDLS(
        this.connection,
        this.config.viewName,
        this.sessionId
      );
      this.lockHandle = lockHandle;
      this.state.lockHandle = lockHandle;

      // Register lock in persistent storage if callback provided
      if (this.config.onLock) {
        this.config.onLock(lockHandle, this.sessionId);
      }

      this.logger.info?.('View locked, handle:', lockHandle.substring(0, 10) + '...');
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
      const params: UpdateViewSourceParams = {
        view_name: this.config.viewName,
        ddl_source: this.config.ddlSource,
        activate: false,
        lock_handle: this.lockHandle,
        session_id: this.sessionId,
        transport_request: this.config.transportRequest
      };
      const result = await updateViewSource(this.connection, params);
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

  async check(version: 'active' | 'inactive' = 'inactive'): Promise<this> {
    try {
      this.logger.info?.('Checking view:', this.config.viewName, 'version:', version);
      const result = await checkView(
        this.connection,
        this.config.viewName,
        version,
        this.sessionId
      );
      this.state.checkResult = result;
      this.logger.info?.('View check successful:', result.status);
      return this;
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
        this.lockHandle,
        this.sessionId
      );
      this.state.unlockResult = result;
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
      this.logger.info?.('View unlocked successfully');
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
        this.config.viewName,
        this.sessionId
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

  async read(version: 'active' | 'inactive' = 'active'): Promise<this> {
    try {
      this.logger.info?.('Reading view:', this.config.viewName);
      const result = await getViewSource(this.connection, this.config.viewName);
      this.state.readResult = result;
      this.logger.info?.('View read successfully:', result.status);
      return this;
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
        this.lockHandle,
        this.sessionId
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
  getState(): Readonly<ViewBuilderState> {
    return { ...this.state };
  }

  getViewName(): string {
    return this.config.viewName;
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

  getResults(): {
    validate?: ValidationResult;
    create?: AxiosResponse;
    update?: AxiosResponse;
    check?: AxiosResponse;
    unlock?: AxiosResponse;
    activate?: AxiosResponse;
    delete?: AxiosResponse;
    lockHandle?: string;
    errors: Array<{ method: string; error: Error; timestamp: Date }>;
  } {
    return {
      validate: this.state.validationResult,
      create: this.state.createResult,
      update: this.state.updateResult,
      check: this.state.checkResult,
      unlock: this.state.unlockResult,
      activate: this.state.activateResult,
      delete: this.state.deleteResult,
      lockHandle: this.lockHandle,
      errors: [...this.state.errors]
    };
  }
}


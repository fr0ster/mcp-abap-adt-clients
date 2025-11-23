/**
 * TableBuilder - Fluent API for table operations with Promise chaining
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
 * const builder = new TableBuilder(connection, logger, {
 *   tableName: 'Z_TEST_TABLE',
 *   packageName: 'ZOK_TEST_PKG_01'
 * });
 *
 * await builder
 *   .setDdlCode('@AbapCatalog.tableType : #TRANSPARENT\n...')
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
import { IAdtLogger } from '../../utils/logger';
import { createTable } from './create';
import { acquireTableLockHandle } from './lock';
import { updateTable } from './update';
import { runTableCheckRun } from './check';
import { unlockTable } from './unlock';
import { activateTable } from './activation';
import { deleteTable } from './delete';
import { validateTableName } from './validation';
import { CreateTableParams } from './types';
import { UpdateTableParams } from './update';
import { ValidationResult } from '../shared/validation';
import { getTableSource } from './read';

export interface TableBuilderConfig {
  tableName: string;
  packageName?: string;
  transportRequest?: string;
  ddlCode?: string;
}

export interface TableBuilderState {
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

export class TableBuilder {
  private connection: AbapConnection;
  private logger: IAdtLogger;
  private config: TableBuilderConfig;
  private lockHandle?: string;
  private state: TableBuilderState;

  constructor(
    connection: AbapConnection,
    logger: IAdtLogger,
    config: TableBuilderConfig
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

  setName(tableName: string): this {
    this.config.tableName = tableName;
    this.logger.debug?.('Table name set:', tableName);
    return this;
  }

  setDdlCode(ddlCode: string): this {
    this.config.ddlCode = ddlCode;
    this.logger.debug?.('DDL code set, length:', ddlCode.length);
    return this;
  }

  // Operation methods - return Promise<this> for Promise chaining
  async validate(): Promise<this> {
    try {
      this.logger.info?.('Validating table name:', this.config.tableName);
      const result = await validateTableName(
        this.connection,
        this.config.tableName
      );
      this.state.validationResult = result;
      if (!result.valid) {
        throw new Error(`Table name validation failed: ${result.message}`);
      }
      this.logger.info?.('Table name validation successful');
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
      if (!this.config.ddlCode) {
        throw new Error('DDL code is required');
      }
      this.logger.info?.('Creating table:', this.config.tableName);
      this.connection.setSessionType("stateful");
      const params: CreateTableParams = {
        table_name: this.config.tableName,
        ddl_code: this.config.ddlCode,
        package_name: this.config.packageName,
        transport_request: this.config.transportRequest
      };
      const result = await createTable(this.connection, params);
      this.state.createResult = result;
      this.logger.info?.('Table created successfully:', result.status);
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
      this.logger.info?.('Locking table:', this.config.tableName);
      this.connection.setSessionType("stateful");
      const lockHandle = await acquireTableLockHandle(
        this.connection,
        this.config.tableName
      );
      this.lockHandle = lockHandle;
      this.state.lockHandle = lockHandle;

      this.logger.info?.('Table locked, handle:', lockHandle);
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
        throw new Error('Table must be locked before update. Call lock() first.');
      }
      if (!this.config.ddlCode) {
        throw new Error('DDL code is required');
      }
      this.logger.info?.('Updating table:', this.config.tableName);
      const params: UpdateTableParams = {
        table_name: this.config.tableName,
        ddl_code: this.config.ddlCode,
        transport_request: this.config.transportRequest,
        activate: false
      };
      const result = await updateTable(
        this.connection,
        params,
        this.lockHandle
      );
      this.state.updateResult = result;
      this.logger.info?.('Table updated successfully:', result.status);
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

  async check(reporter: 'tableStatusCheck' | 'abapCheckRun' = 'abapCheckRun'): Promise<this> {
    try {
      this.logger.info?.('Checking table:', this.config.tableName, 'reporter:', reporter);
      const result = await runTableCheckRun(
        this.connection,
        reporter,
        this.config.tableName
      );
      this.state.checkResult = result;
      this.logger.info?.('Table check successful:', result.status);
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
        throw new Error('Table is not locked. Call lock() first.');
      }
      this.logger.info?.('Unlocking table:', this.config.tableName);
      const result = await unlockTable(
        this.connection,
        this.config.tableName,
        this.lockHandle,
      );
      this.state.unlockResult = result;
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
      this.connection.setSessionType("stateless");
      this.logger.info?.('Table unlocked successfully');
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
      this.logger.info?.('Activating table:', this.config.tableName);
      const result = await activateTable(
        this.connection,
        this.config.tableName
      );
      this.state.activateResult = result;
      this.logger.info?.('Table activated successfully:', result.status);
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
      this.logger.info?.('Deleting table:', this.config.tableName);
      const result = await deleteTable(
        this.connection,
        {
          table_name: this.config.tableName,
          transport_request: this.config.transportRequest
        }
      );
      this.state.deleteResult = result;
      this.logger.info?.('Table deleted successfully:', result.status);
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
      this.logger.info?.('Reading table:', this.config.tableName);
      const result = await getTableSource(this.connection, this.config.tableName);
      this.state.readResult = result;
      this.logger.info?.('Table read successfully:', result.status);
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
      await unlockTable(
        this.connection,
        this.config.tableName,
        this.lockHandle
      );
      this.logger.info?.('Force unlock successful for', this.config.tableName);
    } catch (error: any) {
      this.logger.warn?.('Force unlock failed:', error);
    } finally {
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
      this.connection.setSessionType("stateless");
    }
  }

  // Getters for accessing results
  getState(): Readonly<TableBuilderState> {
    return { ...this.state };
  }

  getTableName(): string {
    return this.config.tableName;
  }

  getLockHandle(): string | undefined {
    return this.lockHandle;
  }

  getSessionId(): string | null {
    return this.connection.getSessionId();
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


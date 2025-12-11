/**
 * AdtTable - High-level CRUD operations for Table objects
 * 
 * Implements IAdtObject interface with automatic operation chains,
 * error handling, and resource cleanup.
 * 
 * Uses low-level functions directly (not Builder classes).
 * 
 * Session management:
 * - stateful: only when doing lock/update/unlock operations
 * - stateless: obligatory after unlock
 * - If no lock/unlock, no stateful needed
 * - activate uses same session/cookies (no stateful needed)
 * 
 * Operation chains:
 * - Create: validate → create → check → lock → check(inactive) → update → unlock → check → activate
 * - Update: lock → check(inactive) → update → unlock → check → activate
 * - Delete: check(deletion) → delete
 */

import { IAbapConnection, IAdtObject, IAdtOperationOptions } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { ITableConfig, ITableState } from './types';
import { validateTableName } from './validation';
import { createTable } from './create';
import { runTableCheckRun } from './check';
import { acquireTableLockHandle } from './lock';
import { updateTable } from './update';
import { unlockTable } from './unlock';
import { activateTable } from './activation';
import { checkDeletion, deleteTable } from './delete';
import { getTableSource, getTableMetadata, getTableTransport } from './read';

export class AdtTable implements IAdtObject<ITableConfig, ITableState> {
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  public readonly objectType: string = 'Table';

  constructor(connection: IAbapConnection, logger?: ILogger) {
    this.connection = connection;
    this.logger = logger;
  }

  /**
   * Validate table configuration before creation
   */
  async validate(config: Partial<ITableConfig>): Promise<ITableState> {
    if (!config.tableName) {
      throw new Error('Table name is required for validation');
    }

    const validationResponse = await validateTableName(
      this.connection,
      config.tableName,
      config.description
    );
    return { validationResponse, errors: [] };
  }

  /**
   * Create table with full operation chain
   */
  async create(
    config: ITableConfig,
    options?: IAdtOperationOptions
  ): Promise<ITableState> {
    if (!config.tableName) {
      throw new Error('Table name is required');
    }
    if (!config.packageName) {
      throw new Error('Package name is required');
    }

    let objectCreated = false;
    let lockHandle: string | undefined;

    try {
      // 1. Validate (no stateful needed)
      this.logger?.info?.('Step 1: Validating table configuration');
      await validateTableName(
        this.connection,
        config.tableName,
        config.description
      );
      this.logger?.info?.('Validation passed');

      // 2. Create (no stateful needed)
      this.logger?.info?.('Step 2: Creating table');
      await createTable(this.connection, {
        table_name: config.tableName,
        package_name: config.packageName,
        transport_request: config.transportRequest,
        ddl_code: options?.sourceCode || config.ddlCode
      });
      objectCreated = true;
      this.logger?.info?.('Table created');

      // 3. Check after create (no stateful needed)
      this.logger?.info?.('Step 3: Checking created table');
      await runTableCheckRun(this.connection, 'abapCheckRun', config.tableName, undefined, 'inactive');
      this.logger?.info?.('Check after create passed');

      // 4. Lock (stateful ONLY before lock)
      this.logger?.info?.('Step 4: Locking table');
      this.connection.setSessionType('stateful');
      lockHandle = await acquireTableLockHandle(this.connection, config.tableName);
      this.logger?.info?.('Table locked, handle:', lockHandle);

      // 5. Check inactive with code for update (from options or config)
      const codeToCheck = options?.sourceCode || config.ddlCode;
      if (codeToCheck) {
        this.logger?.info?.('Step 5: Checking inactive version with update content');
        await runTableCheckRun(this.connection, 'abapCheckRun', config.tableName, codeToCheck, 'inactive');
        this.logger?.info?.('Check inactive with update content passed');
      }

      // 6. Update
      if (codeToCheck && lockHandle) {
        this.logger?.info?.('Step 6: Updating table with DDL code');
        await updateTable(
          this.connection,
          {
            table_name: config.tableName,
            ddl_code: codeToCheck,
            transport_request: config.transportRequest
          },
          lockHandle
        );
        this.logger?.info?.('Table updated');
      }

      // 7. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger?.info?.('Step 7: Unlocking table');
        await unlockTable(this.connection, config.tableName, lockHandle);
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger?.info?.('Table unlocked');
      }

      // 8. Final check (no stateful needed)
      this.logger?.info?.('Step 8: Final check');
      await runTableCheckRun(this.connection, 'abapCheckRun', config.tableName, undefined, 'inactive');
      this.logger?.info?.('Final check passed');

      // 9. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnCreate) {
        this.logger?.info?.('Step 9: Activating table');
        const activateResponse = await activateTable(this.connection, config.tableName);
        this.logger?.info?.('Table activated, status:', activateResponse.status);
        
        // Don't read after activation - object may not be ready yet
        // Return basic info (activation returns 201)
        return { createResult: activateResponse, errors: [] };
      }

      // Read and return result (no stateful needed)
      const readResponse = await getTableSource(this.connection, config.tableName);
      return { createResult: readResponse, errors: [] };
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger?.warn?.('Unlocking table during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlockTable(this.connection, config.tableName, lockHandle);
          this.connection.setSessionType('stateless');
        } catch (unlockError) {
          this.logger?.warn?.('Failed to unlock during cleanup:', unlockError);
        }
      } else {
        // Ensure stateless if no lock was acquired
        this.connection.setSessionType('stateless');
      }

      if (objectCreated && options?.deleteOnFailure) {
        try {
          this.logger?.warn?.('Deleting table after failure');
          // No stateful needed - delete doesn't use lock/unlock
          await deleteTable(this.connection, {
            table_name: config.tableName,
            transport_request: config.transportRequest
          });
        } catch (deleteError) {
          this.logger?.warn?.('Failed to delete table after failure:', deleteError);
        }
      }

      this.logger?.error('Create failed:', error);
      throw error;
    }
  }

  /**
   * Read table
   */
  async read(
    config: Partial<ITableConfig>,
    version: 'active' | 'inactive' = 'active'
  ): Promise<ITableState> {
    if (!config.tableName) {
      throw new Error('Table name is required');
    }

    try {
      const readResult = await getTableSource(this.connection, config.tableName);
      return { readResult, errors: [] };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return { readResult: undefined, errors: [] };
      }
      throw error;
    }
  }

  /**
   * Read table metadata (object characteristics: package, responsible, description, etc.)
   */
  async readMetadata(config: Partial<ITableConfig>): Promise<ITableState> {
    const state: ITableState = { errors: [] };
    if (!config.tableName) {
      const error = new Error('Table name is required');
      state.errors.push({ method: 'readMetadata', error, timestamp: new Date() });
      throw error;
    }
    try {
      const response = await getTableMetadata(this.connection, config.tableName);
      state.metadataResult = response;
      this.logger?.info?.('Table metadata read successfully');
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({ method: 'readMetadata', error: err, timestamp: new Date() });
      this.logger?.error('readMetadata', err);
      throw err;
    }
  }

  /**
   * Read transport request information for the table
   */
  async readTransport(config: Partial<ITableConfig>): Promise<ITableState> {
    const state: ITableState = { errors: [] };
    if (!config.tableName) {
      const error = new Error('Table name is required');
      state.errors.push({ method: 'readTransport', error, timestamp: new Date() });
      throw error;
    }
    try {
      const response = await getTableTransport(this.connection, config.tableName);
      state.transportResult = response;
      this.logger?.info?.('Table transport request read successfully');
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({ method: 'readTransport', error: err, timestamp: new Date() });
      this.logger?.error('readTransport', err);
      throw err;
    }
  }

  /**
   * Update table with full operation chain
   * Always starts with lock
   */
  async update(
    config: Partial<ITableConfig>,
    options?: IAdtOperationOptions
  ): Promise<ITableState> {
    if (!config.tableName) {
      throw new Error('Table name is required');
    }

    let lockHandle: string | undefined;

    try {
      // 1. Lock (update always starts with lock, stateful ONLY before lock)
      this.logger?.info?.('Step 1: Locking table');
      this.connection.setSessionType('stateful');
      lockHandle = await acquireTableLockHandle(this.connection, config.tableName);
      this.logger?.info?.('Table locked, handle:', lockHandle);

      // 2. Check inactive with code for update (from options or config)
      const codeToCheck = options?.sourceCode || config.ddlCode;
      if (codeToCheck) {
        this.logger?.info?.('Step 2: Checking inactive version with update content');
        await runTableCheckRun(this.connection, 'abapCheckRun', config.tableName, codeToCheck, 'inactive');
        this.logger?.info?.('Check inactive with update content passed');
      }

      // 3. Update
      if (codeToCheck && lockHandle) {
        this.logger?.info?.('Step 3: Updating table');
        await updateTable(
          this.connection,
          {
            table_name: config.tableName,
            ddl_code: codeToCheck,
            transport_request: config.transportRequest
          },
          lockHandle
        );
        this.logger?.info?.('Table updated');
      }

      // 4. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger?.info?.('Step 4: Unlocking table');
        await unlockTable(this.connection, config.tableName, lockHandle);
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger?.info?.('Table unlocked');
      }

      // 5. Final check (no stateful needed)
      this.logger?.info?.('Step 5: Final check');
      await runTableCheckRun(this.connection, 'abapCheckRun', config.tableName, undefined, 'inactive');
      this.logger?.info?.('Final check passed');

      // 6. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 6: Activating table');
        const activateResponse = await activateTable(this.connection, config.tableName);
        this.logger?.info?.('Table activated, status:', activateResponse.status);
        
        // Don't read after activation - object may not be ready yet
        // Return basic info (activation returns 201)
        return {
          activateResult: activateResponse,
          errors: []
        };
      }

      // Read and return result (no stateful needed)
      const readResponse = await getTableSource(this.connection, config.tableName);
      return {
        readResult: readResponse,
        errors: []
      };
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger?.warn?.('Unlocking table during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlockTable(this.connection, config.tableName, lockHandle);
          this.connection.setSessionType('stateless');
        } catch (unlockError) {
          this.logger?.warn?.('Failed to unlock during cleanup:', unlockError);
        }
      } else {
        // Ensure stateless if lock failed
        this.connection.setSessionType('stateless');
      }

      if (options?.deleteOnFailure) {
        try {
          this.logger?.warn?.('Deleting table after failure');
          // No stateful needed - delete doesn't use lock/unlock
          await deleteTable(this.connection, {
            table_name: config.tableName,
            transport_request: config.transportRequest
          });
        } catch (deleteError) {
          this.logger?.warn?.('Failed to delete table after failure:', deleteError);
        }
      }

      this.logger?.error('Update failed:', error);
      throw error;
    }
  }

  /**
   * Delete table
   */
  async delete(config: Partial<ITableConfig>): Promise<ITableState> {
    if (!config.tableName) {
      throw new Error('Table name is required');
    }

    try {
      // Check for deletion (no stateful needed)
      this.logger?.info?.('Checking table for deletion');
      await checkDeletion(this.connection, {
        table_name: config.tableName,
        transport_request: config.transportRequest
      });
      this.logger?.info?.('Deletion check passed');

      // Delete (no stateful needed - no lock/unlock)
      this.logger?.info?.('Deleting table');
      const result = await deleteTable(this.connection, {
        table_name: config.tableName,
        transport_request: config.transportRequest
      });
      this.logger?.info?.('Table deleted');

      return { deleteResult: result, errors: [] };
    } catch (error: any) {
      this.logger?.error('Delete failed:', error);
      throw error;
    }
  }

  /**
   * Activate table
   * No stateful needed - uses same session/cookies
   */
  async activate(config: Partial<ITableConfig>): Promise<ITableState> {
    if (!config.tableName) {
      throw new Error('Table name is required');
    }

    try {
      const result = await activateTable(this.connection, config.tableName);
      return { activateResult: result, errors: [] };
    } catch (error: any) {
      this.logger?.error('Activate failed:', error);
      throw error;
    }
  }

  /**
   * Check table
   */
  async check(
    config: Partial<ITableConfig>,
    status?: string
  ): Promise<ITableState> {
    if (!config.tableName) {
      throw new Error('Table name is required');
    }

    // Map status to version
    const version: string = status === 'active' ? 'active' : 'inactive';
    return {
      checkResult: await runTableCheckRun(this.connection, 'abapCheckRun', config.tableName, undefined, version),
      errors: []
    };
  }
}

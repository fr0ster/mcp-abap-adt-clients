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
import { IAdtLogger, logErrorSafely } from '../../utils/logger';
import { TableBuilderConfig } from './types';
import { validateTableName } from './validation';
import { createTable } from './create';
import { runTableCheckRun } from './check';
import { acquireTableLockHandle } from './lock';
import { updateTable } from './update';
import { unlockTable } from './unlock';
import { activateTable } from './activation';
import { checkDeletion, deleteTable } from './delete';
import { getTableSource } from './read';

export class AdtTable implements IAdtObject<TableBuilderConfig, TableBuilderConfig> {
  private readonly connection: IAbapConnection;
  private readonly logger?: IAdtLogger;
  public readonly objectType: string = 'Table';

  constructor(connection: IAbapConnection, logger?: IAdtLogger) {
    this.connection = connection;
    this.logger = logger;
  }

  /**
   * Validate table configuration before creation
   */
  async validate(config: Partial<TableBuilderConfig>): Promise<AxiosResponse> {
    if (!config.tableName) {
      throw new Error('Table name is required for validation');
    }

    return await validateTableName(
      this.connection,
      config.tableName,
      config.description
    );
  }

  /**
   * Create table with full operation chain
   */
  async create(
    config: TableBuilderConfig,
    options?: IAdtOperationOptions
  ): Promise<TableBuilderConfig> {
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
        return {
          tableName: config.tableName,
          packageName: config.packageName
        };
      }

      // Read and return result (no stateful needed)
      const readResponse = await getTableSource(this.connection, config.tableName);
      const ddlCode = typeof readResponse.data === 'string'
        ? readResponse.data
        : JSON.stringify(readResponse.data);

      return {
        tableName: config.tableName,
        packageName: config.packageName,
        ddlCode
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

      logErrorSafely(this.logger, 'Create', error);
      throw error;
    }
  }

  /**
   * Read table
   */
  async read(
    config: Partial<TableBuilderConfig>,
    version: 'active' | 'inactive' = 'active'
  ): Promise<TableBuilderConfig | undefined> {
    if (!config.tableName) {
      throw new Error('Table name is required');
    }

    try {
      const response = await getTableSource(this.connection, config.tableName);
      const ddlCode = typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);

      return {
        tableName: config.tableName,
        ddlCode
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Update table with full operation chain
   * Always starts with lock
   */
  async update(
    config: Partial<TableBuilderConfig>,
    options?: IAdtOperationOptions
  ): Promise<TableBuilderConfig> {
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
          tableName: config.tableName
        };
      }

      // Read and return result (no stateful needed)
      const readResponse = await getTableSource(this.connection, config.tableName);
      const ddlCode = typeof readResponse.data === 'string'
        ? readResponse.data
        : JSON.stringify(readResponse.data);

      return {
        tableName: config.tableName,
        ddlCode
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

      logErrorSafely(this.logger, 'Update', error);
      throw error;
    }
  }

  /**
   * Delete table
   */
  async delete(config: Partial<TableBuilderConfig>): Promise<AxiosResponse> {
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

      return result;
    } catch (error: any) {
      logErrorSafely(this.logger, 'Delete', error);
      throw error;
    }
  }

  /**
   * Activate table
   * No stateful needed - uses same session/cookies
   */
  async activate(config: Partial<TableBuilderConfig>): Promise<AxiosResponse> {
    if (!config.tableName) {
      throw new Error('Table name is required');
    }

    try {
      const result = await activateTable(this.connection, config.tableName);
      return result;
    } catch (error: any) {
      logErrorSafely(this.logger, 'Activate', error);
      throw error;
    }
  }

  /**
   * Check table
   */
  async check(
    config: Partial<TableBuilderConfig>,
    status?: string
  ): Promise<AxiosResponse> {
    if (!config.tableName) {
      throw new Error('Table name is required');
    }

    // Map status to version
    const version: string = status === 'active' ? 'active' : 'inactive';
    return await runTableCheckRun(this.connection, 'abapCheckRun', config.tableName, undefined, version);
  }
}

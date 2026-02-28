/**
 * AdtTableType - High-level CRUD operations for Table Type objects
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

import type {
  IAbapConnection,
  IAdtObject,
  IAdtOperationOptions,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IAdtSystemContext } from '../../clients/AdtClient';
import type { IReadOptions } from '../shared/types';
import { activateTableType } from './activation';
import { runTableTypeCheckRun } from './check';
import { createTableType } from './create';
import { checkDeletion, deleteTableType } from './delete';
import { acquireTableTypeLockHandle } from './lock';
import { getTableTypeMetadata, getTableTypeTransport } from './read';
import type { ITableTypeConfig, ITableTypeState } from './types';
import { unlockTableType } from './unlock';
import { updateTableType } from './update';
import { validateTableTypeName } from './validation';

export class AdtDdicTableType
  implements IAdtObject<ITableTypeConfig, ITableTypeState>
{
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  private readonly systemContext: IAdtSystemContext;
  public readonly objectType: string = 'TableType';

  constructor(connection: IAbapConnection, logger?: ILogger, systemContext?: IAdtSystemContext) {
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
  }

  /**
   * Validate table type configuration before creation
   */
  async validate(config: Partial<ITableTypeConfig>): Promise<ITableTypeState> {
    if (!config.tableTypeName) {
      throw new Error('Table type name is required for validation');
    }

    const validationResponse = await validateTableTypeName(
      this.connection,
      config.tableTypeName,
      config.description,
    );
    return { validationResponse, errors: [] };
  }

  /**
   * Create table type with full operation chain
   */
  async create(
    config: ITableTypeConfig,
    options?: IAdtOperationOptions,
  ): Promise<ITableTypeState> {
    if (!config.tableTypeName) {
      throw new Error('Table type name is required');
    }
    if (!config.packageName) {
      throw new Error('Package name is required');
    }

    let objectCreated = false;
    const state: ITableTypeState = {
      errors: [],
    };

    try {
      // Create empty table type (XML-based entity like Domain/DataElement)
      // rowType is added via update() method
      this.logger?.info?.('Creating table type');
      const createResponse = await createTableType(this.connection, {
        tabletype_name: config.tableTypeName,
        package_name: config.packageName,
        description: config.description,
        transport_request: config.transportRequest,
        masterSystem: this.systemContext.masterSystem,
        responsible: this.systemContext.responsible,
      });
      objectCreated = true;
      state.createResult = createResponse;
      this.logger?.info?.('Table type created');

      return state;
    } catch (error: any) {
      // Cleanup on error - ensure stateless
      this.connection.setSessionType('stateless');

      if (objectCreated && options?.deleteOnFailure) {
        try {
          this.logger?.warn?.('Deleting table type after failure');
          await deleteTableType(this.connection, {
            tabletype_name: config.tableTypeName,
            transport_request: config.transportRequest,
          });
        } catch (deleteError) {
          this.logger?.warn?.(
            'Failed to delete table type after failure:',
            deleteError,
          );
        }
      }

      this.logger?.error('Create failed:', error);
      throw error;
    }
  }

  /**
   * Read table type metadata (TableType is XML-based entity like Domain/DataElement)
   */
  async read(
    config: Partial<ITableTypeConfig>,
    _version?: 'active' | 'inactive',
    options?: IReadOptions,
  ): Promise<ITableTypeState> {
    if (!config.tableTypeName) {
      throw new Error('Table type name is required');
    }

    // TableType is XML-based, read metadata
    try {
      const readResult = await getTableTypeMetadata(
        this.connection,
        config.tableTypeName,
        options,
        this.logger,
      );
      return { readResult, errors: [] };
    } catch (error: any) {
      // If metadata read fails with 404, return empty result
      if (error.response?.status === 404) {
        return { readResult: undefined, errors: [] };
      }
      throw error;
    }
  }

  /**
   * Read table type metadata (object characteristics: package, responsible, description, etc.)
   */
  async readMetadata(
    config: Partial<ITableTypeConfig>,
    options?: IReadOptions,
  ): Promise<ITableTypeState> {
    const state: ITableTypeState = { errors: [] };
    if (!config.tableTypeName) {
      const error = new Error('Table type name is required');
      state.errors.push({
        method: 'readMetadata',
        error,
        timestamp: new Date(),
      });
      throw error;
    }
    try {
      const response = await getTableTypeMetadata(
        this.connection,
        config.tableTypeName,
        options,
        this.logger,
      );
      state.metadataResult = response;
      this.logger?.info?.('Table type metadata read successfully');
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({
        method: 'readMetadata',
        error: err,
        timestamp: new Date(),
      });
      this.logger?.error('readMetadata', err);
      throw err;
    }
  }

  /**
   * Read transport request information for the table type
   */
  async readTransport(
    config: Partial<ITableTypeConfig>,
    options?: { withLongPolling?: boolean },
  ): Promise<ITableTypeState> {
    const state: ITableTypeState = { errors: [] };
    if (!config.tableTypeName) {
      const error = new Error('Table type name is required');
      state.errors.push({
        method: 'readTransport',
        error,
        timestamp: new Date(),
      });
      throw error;
    }
    try {
      const response = await getTableTypeTransport(
        this.connection,
        config.tableTypeName,
        options?.withLongPolling !== undefined
          ? { withLongPolling: options.withLongPolling }
          : undefined,
      );
      state.transportResult = response;
      this.logger?.info?.('Table type transport request read successfully');
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({
        method: 'readTransport',
        error: err,
        timestamp: new Date(),
      });
      this.logger?.error('readTransport', err);
      throw err;
    }
  }

  /**
   * Update table type with full operation chain
   * Always starts with lock
   * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
   */
  async update(
    config: Partial<ITableTypeConfig>,
    options?: IAdtOperationOptions,
  ): Promise<ITableTypeState> {
    if (!config.tableTypeName) {
      throw new Error('Table type name is required');
    }

    // Low-level mode: if lockHandle is provided, perform only update operation
    if (options?.lockHandle) {
      const hasRowType =
        config.rowTypeName && config.rowTypeName.trim().length > 0;
      if (!hasRowType || !config.rowTypeName) {
        throw new Error('rowTypeName is required for update');
      }

      this.logger?.info?.(
        'Low-level update: performing update only (lockHandle provided)',
      );
      const updateResponse = await updateTableType(
        this.connection,
        {
          tabletype_name: config.tableTypeName,
          description: config.description,
          row_type_name: config.rowTypeName,
          row_type_kind: config.rowTypeKind || 'dictionaryType',
          access_type: config.accessType || 'standard',
          primary_key_definition: config.primaryKeyDefinition || 'standard',
          primary_key_kind: config.primaryKeyKind || 'nonUnique',
          transport_request: config.transportRequest,
        },
        options.lockHandle,
        this.logger,
      );
      this.logger?.info?.('Table type updated (low-level)');
      return {
        updateResult: updateResponse,
        errors: [],
      };
    }

    let lockHandle: string | undefined;

    try {
      // 1. Lock (update always starts with lock, stateful ONLY before lock)
      this.logger?.info?.('Step 1: Locking table type');
      this.connection.setSessionType('stateful');
      lockHandle = await acquireTableTypeLockHandle(
        this.connection,
        config.tableTypeName,
      );
      this.logger?.info?.('Table type locked, handle:', lockHandle);

      // 2. Check inactive (TableType is XML-based, no source code check needed)
      // Skip check step for XML-based TableType

      // 3. Update
      // TableType is XML-based entity (like Domain/DataElement)
      const hasRowType =
        config.rowTypeName && config.rowTypeName.trim().length > 0;

      if (hasRowType && lockHandle && config.rowTypeName) {
        this.logger?.info?.('Step 3: Updating table type');
        try {
          await updateTableType(
            this.connection,
            {
              tabletype_name: config.tableTypeName,
              description: config.description,
              row_type_name: config.rowTypeName, // TypeScript now knows this is defined
              row_type_kind: config.rowTypeKind || 'dictionaryType',
              access_type: config.accessType || 'standard',
              primary_key_definition: config.primaryKeyDefinition || 'standard',
              primary_key_kind: config.primaryKeyKind || 'nonUnique',
              transport_request: config.transportRequest,
            },
            lockHandle,
            this.logger,
          );
          this.logger?.info?.('Table type updated');
        } catch (updateError: any) {
          // Log update error details before rethrowing
          this.logger?.error?.('Update failed with error:', updateError);
          if (updateError.message) {
            this.logger?.error?.('Error message:', updateError.message);
          }
          throw updateError;
        }

        // 3.5. Read with long polling to ensure object is ready after update
        this.logger?.info?.('read (wait for object ready after update)');
        try {
          await this.read({ tableTypeName: config.tableTypeName }, 'active', {
            withLongPolling: true,
          });
          this.logger?.info?.('object is ready after update');
        } catch (readError) {
          this.logger?.warn?.(
            'read with long polling failed after update:',
            readError,
          );
          // Continue anyway - unlock might still work
        }
      }

      // 4. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger?.info?.('Step 4: Unlocking table type');
        await unlockTableType(
          this.connection,
          config.tableTypeName,
          lockHandle,
        );
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger?.info?.('Table type unlocked');
      }

      // 5. Final check (no stateful needed)
      this.logger?.info?.('Step 5: Final check');
      await runTableTypeCheckRun(
        this.connection,
        'abapCheckRun',
        config.tableTypeName,
        undefined,
        'inactive',
      );
      this.logger?.info?.('Final check passed');

      // 6. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 6: Activating table type');
        const activateResponse = await activateTableType(
          this.connection,
          config.tableTypeName,
        );
        this.logger?.info?.(
          'Table type activated, status:',
          activateResponse.status,
        );

        // 6.5. Read with long polling to ensure object is ready after activation
        this.logger?.info?.('read (wait for object ready after activation)');
        try {
          const readState = await this.read(
            { tableTypeName: config.tableTypeName },
            'active',
            { withLongPolling: true },
          );
          if (readState) {
            return {
              activateResult: activateResponse,
              readResult: readState.readResult,
              errors: [],
            };
          }
          this.logger?.info?.('object is ready after activation');
        } catch (readError) {
          this.logger?.warn?.(
            'read with long polling failed after activation:',
            readError,
          );
          // Continue anyway - activation was successful
        }
        return {
          activateResult: activateResponse,
          errors: [],
        };
      }

      // Read and return result (no stateful needed)
      // TableType is XML-based, read metadata
      try {
        const readResponse = await getTableTypeMetadata(
          this.connection,
          config.tableTypeName,
        );
        return {
          readResult: readResponse,
          errors: [],
        };
      } catch (error: any) {
        // If metadata read fails with 404, return empty result
        if (error.response?.status === 404) {
          return {
            readResult: undefined,
            errors: [],
          };
        }
        throw error;
      }
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger?.warn?.('Unlocking table type during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlockTableType(
            this.connection,
            config.tableTypeName,
            lockHandle,
          );
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
          this.logger?.warn?.('Deleting table type after failure');
          // No stateful needed - delete doesn't use lock/unlock
          await deleteTableType(this.connection, {
            tabletype_name: config.tableTypeName,
            transport_request: config.transportRequest,
          });
        } catch (deleteError) {
          this.logger?.warn?.(
            'Failed to delete table type after failure:',
            deleteError,
          );
        }
      }

      this.logger?.error('Update failed:', error);
      throw error;
    }
  }

  /**
   * Delete table type
   */
  async delete(config: Partial<ITableTypeConfig>): Promise<ITableTypeState> {
    if (!config.tableTypeName) {
      throw new Error('Table type name is required');
    }

    try {
      // Check for deletion (no stateful needed)
      this.logger?.info?.('Checking table type for deletion');
      await checkDeletion(this.connection, {
        tabletype_name: config.tableTypeName,
        transport_request: config.transportRequest,
      });
      this.logger?.info?.('Deletion check passed');

      // Delete (no stateful needed - no lock/unlock)
      this.logger?.info?.('Deleting table type');
      const result = await deleteTableType(this.connection, {
        tabletype_name: config.tableTypeName,
        transport_request: config.transportRequest,
      });
      this.logger?.info?.('Table type deleted');

      return { deleteResult: result, errors: [] };
    } catch (error: any) {
      this.logger?.error('Delete failed:', error);
      throw error;
    }
  }

  /**
   * Activate table type
   * No stateful needed - uses same session/cookies
   */
  async activate(config: Partial<ITableTypeConfig>): Promise<ITableTypeState> {
    if (!config.tableTypeName) {
      throw new Error('Table type name is required');
    }

    try {
      const result = await activateTableType(
        this.connection,
        config.tableTypeName,
      );
      return { activateResult: result, errors: [] };
    } catch (error: any) {
      this.logger?.error('Activate failed:', error);
      throw error;
    }
  }

  /**
   * Check table type
   */
  async check(
    config: Partial<ITableTypeConfig>,
    status?: string,
  ): Promise<ITableTypeState> {
    if (!config.tableTypeName) {
      throw new Error('Table type name is required');
    }

    // Map status to version
    const version: string = status === 'active' ? 'active' : 'inactive';
    return {
      checkResult: await runTableTypeCheckRun(
        this.connection,
        'abapCheckRun',
        config.tableTypeName,
        undefined,
        version,
      ),
      errors: [],
    };
  }

  /**
   * Lock table type for modification
   */
  async lock(config: Partial<ITableTypeConfig>): Promise<string> {
    if (!config.tableTypeName) {
      throw new Error('Table type name is required');
    }

    this.connection.setSessionType('stateful');
    return await acquireTableTypeLockHandle(
      this.connection,
      config.tableTypeName,
    );
  }

  /**
   * Unlock table type
   */
  async unlock(
    config: Partial<ITableTypeConfig>,
    lockHandle: string,
  ): Promise<ITableTypeState> {
    if (!config.tableTypeName) {
      throw new Error('Table type name is required');
    }

    const result = await unlockTableType(
      this.connection,
      config.tableTypeName,
      lockHandle,
    );
    this.connection.setSessionType('stateless');
    return {
      unlockResult: result,
      errors: [],
    };
  }
}

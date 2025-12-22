/**
 * AdtFunctionGroup - High-level CRUD operations for Function Group objects
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
 * - Create: validate → create → check → (no update - function groups are containers)
 * - Update: lock → update(metadata) → unlock → check → activate
 * - Delete: check(deletion) → delete
 *
 * Note: Function groups are containers for function modules and don't have source code.
 * Update only changes metadata (description).
 */

import type {
  IAbapConnection,
  IAdtObject,
  IAdtOperationOptions,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { activateFunctionGroup } from './activation';
import { checkFunctionGroup } from './check';
import { create as createFunctionGroup } from './create';
import { checkDeletion, deleteFunctionGroup } from './delete';
import { lockFunctionGroup, unlockFunctionGroup } from './lock';
import { getFunctionGroup, getFunctionGroupTransport } from './read';
import type { IFunctionGroupConfig, IFunctionGroupState } from './types';
import { updateFunctionGroup } from './update';
import { validateFunctionGroupName } from './validation';

export class AdtFunctionGroup
  implements IAdtObject<IFunctionGroupConfig, IFunctionGroupState>
{
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  public readonly objectType: string = 'FunctionGroup';

  constructor(connection: IAbapConnection, logger?: ILogger) {
    this.connection = connection;
    this.logger = logger;
  }

  /**
   * Validate function group configuration before creation
   */
  async validate(
    config: Partial<IFunctionGroupConfig>,
  ): Promise<IFunctionGroupState> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required for validation');
    }

    return {
      validationResponse: await validateFunctionGroupName(
        this.connection,
        config.functionGroupName,
        config.packageName,
        config.description,
      ),
      errors: [],
    };
  }

  /**
   * Create function group with full operation chain
   * Note: Function groups are containers, so no source code update after create
   */
  async create(
    config: IFunctionGroupConfig,
    options?: IAdtOperationOptions,
  ): Promise<IFunctionGroupState> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }
    if (!config.packageName) {
      throw new Error('Package name is required');
    }
    if (!config.description) {
      throw new Error('Description is required');
    }

    let objectCreated = false;
    const _sessionId = this.connection.getSessionId?.() || '';

    try {
      // 1. Validate (no stateful needed)
      this.logger?.info?.('Step 1: Validating function group configuration');
      try {
        await validateFunctionGroupName(
          this.connection,
          config.functionGroupName,
          config.packageName,
          config.description,
        );
        this.logger?.info?.('Validation passed');
      } catch (error: any) {
        // Ignore "Kerberos library not loaded" error for FunctionGroup (test cloud issue)
        const errorMessage =
          error?.response?.data || error?.message || String(error);
        const errorText =
          typeof errorMessage === 'string'
            ? errorMessage
            : JSON.stringify(errorMessage);
        if (errorText.toLowerCase().includes('kerberos library not loaded')) {
          this.logger?.warn?.(
            'Validation returned Kerberos error (ignoring): Kerberos library not loaded',
          );
          // Continue - this is a known issue in test environments
        } else {
          throw error; // Re-throw other errors
        }
      }

      // 2. Create (no stateful needed)
      this.logger?.info?.('Step 2: Creating function group');
      await createFunctionGroup(this.connection, {
        functionGroupName: config.functionGroupName,
        packageName: config.packageName,
        transportRequest: config.transportRequest,
        description: config.description,
      });
      this.logger?.info?.('Function group created');

      // 2.5. Read with long polling to ensure object is ready
      // Read 'inactive' version since object is not yet activated
      this.logger?.info?.('read (wait for object ready)');
      try {
        await this.read(
          { functionGroupName: config.functionGroupName },
          'inactive',
          { withLongPolling: true },
        );
        this.logger?.info?.('object is ready after creation');
      } catch (readError) {
        this.logger?.warn?.(
          'read with long polling failed (object may not be ready yet):',
          readError,
        );
        // Continue anyway - check might still work
      }
      objectCreated = true;

      // 3. Check after create (no stateful needed)
      this.logger?.info?.('Step 3: Checking created function group');
      await checkFunctionGroup(
        this.connection,
        config.functionGroupName,
        'inactive',
      );
      this.logger?.info?.('Check after create passed');

      // Note: Function groups are containers - no source code to update after create

      // 4. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnCreate) {
        this.logger?.info?.('Step 4: Activating function group');
        const activateResponse = await activateFunctionGroup(
          this.connection,
          config.functionGroupName,
        );
        this.logger?.info?.(
          'Function group activated, status:',
          activateResponse.status,
        );

        // 4.5. Read with long polling to ensure object is ready after activation
        this.logger?.info?.('read (wait for object ready after activation)');
        try {
          const readState = await this.read(
            { functionGroupName: config.functionGroupName },
            'active',
            { withLongPolling: true },
          );
          if (readState) {
            return {
              createResult: activateResponse,
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
          createResult: activateResponse,
          errors: [],
        };
      }

      // Read and return result (no stateful needed)
      const readResponse = await getFunctionGroup(
        this.connection,
        config.functionGroupName,
      );
      return {
        createResult: readResponse,
        errors: [],
      };
    } catch (error: any) {
      // Ensure stateless if needed
      this.connection.setSessionType('stateless');

      if (objectCreated && options?.deleteOnFailure) {
        try {
          this.logger?.warn?.('Deleting function group after failure');
          // No stateful needed - delete doesn't use lock/unlock
          await deleteFunctionGroup(this.connection, {
            function_group_name: config.functionGroupName,
            transport_request: config.transportRequest,
          });
        } catch (deleteError) {
          this.logger?.warn?.(
            'Failed to delete function group after failure:',
            deleteError,
          );
        }
      }

      this.logger?.error('Create failed:', error);
      throw error;
    }
  }

  /**
   * Read function group
   */
  async read(
    config: Partial<IFunctionGroupConfig>,
    _version: 'active' | 'inactive' = 'active',
    options?: { withLongPolling?: boolean },
  ): Promise<IFunctionGroupState | undefined> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }

    try {
      const response = await getFunctionGroup(
        this.connection,
        config.functionGroupName,
        options?.withLongPolling !== undefined
          ? { withLongPolling: options.withLongPolling }
          : undefined,
      );
      return {
        readResult: response,
        errors: [],
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Read function group metadata (object characteristics: package, responsible, description, etc.)
   * For function groups, read() already returns metadata since there's no source code.
   */
  async readMetadata(
    config: Partial<IFunctionGroupConfig>,
    options?: { withLongPolling?: boolean },
  ): Promise<IFunctionGroupState> {
    const state: IFunctionGroupState = { errors: [] };
    if (!config.functionGroupName) {
      const error = new Error('Function group name is required');
      state.errors.push({
        method: 'readMetadata',
        error,
        timestamp: new Date(),
      });
      throw error;
    }
    try {
      // For objects without source code, read() already returns metadata
      const readState = await this.read(config, 'active', options);
      if (readState) {
        state.metadataResult = readState.readResult;
        state.readResult = readState.readResult;
      } else {
        const error = new Error(
          `Function group '${config.functionGroupName}' not found`,
        );
        state.errors.push({
          method: 'readMetadata',
          error,
          timestamp: new Date(),
        });
        throw error;
      }
      this.logger?.info?.('Function group metadata read successfully');
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
   * Read transport request information for the function group
   */
  async readTransport(
    config: Partial<IFunctionGroupConfig>,
    options?: { withLongPolling?: boolean },
  ): Promise<IFunctionGroupState> {
    const state: IFunctionGroupState = { errors: [] };
    if (!config.functionGroupName) {
      const error = new Error('Function group name is required');
      state.errors.push({
        method: 'readTransport',
        error,
        timestamp: new Date(),
      });
      throw error;
    }
    try {
      const response = await getFunctionGroupTransport(
        this.connection,
        config.functionGroupName,
        options?.withLongPolling !== undefined
          ? { withLongPolling: options.withLongPolling }
          : undefined,
      );
      state.transportResult = response;
      this.logger?.info?.('Function group transport request read successfully');
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
   * Update function group with full operation chain
   * Always starts with lock
   * Note: Function groups only support metadata updates (description)
   * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
   */
  async update(
    config: Partial<IFunctionGroupConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IFunctionGroupState> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }
    if (!config.description) {
      throw new Error('Description is required for update');
    }

    // Low-level mode: if lockHandle is provided, perform only update operation
    if (options?.lockHandle) {
      this.logger?.info?.(
        'Low-level update: performing update only (lockHandle provided)',
      );
      const updateResponse = await updateFunctionGroup(this.connection, {
        function_group_name: config.functionGroupName,
        description: config.description,
        lock_handle: options.lockHandle,
        transport_request: config.transportRequest,
      });
      this.logger?.info?.('Function group updated (low-level)');
      return {
        updateResult: updateResponse,
        errors: [],
      };
    }

    let lockHandle: string | undefined;
    const sessionId = this.connection.getSessionId?.() || '';

    try {
      // 1. Lock (update always starts with lock, stateful ONLY before lock)
      this.logger?.info?.('Step 1: Locking function group');
      this.connection.setSessionType('stateful');
      lockHandle = await lockFunctionGroup(
        this.connection,
        config.functionGroupName,
        sessionId,
      );
      this.logger?.info?.('Function group locked, handle:', lockHandle);

      // 2. Update metadata (description)
      this.logger?.info?.('Step 2: Updating function group metadata');
      await updateFunctionGroup(this.connection, {
        function_group_name: config.functionGroupName,
        description: config.description,
        transport_request: config.transportRequest,
        lock_handle: lockHandle,
      });
      this.logger?.info?.('Function group updated');

      // 2.5. Read with long polling to ensure object is ready after update
      this.logger?.info?.('read (wait for object ready after update)');
      try {
        await this.read(
          { functionGroupName: config.functionGroupName },
          'active',
          { withLongPolling: true },
        );
        this.logger?.info?.('object is ready after update');
      } catch (readError) {
        this.logger?.warn?.(
          'read with long polling failed after update:',
          readError,
        );
        // Continue anyway - unlock might still work
      }

      // 3. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger?.info?.('Step 3: Unlocking function group');
        await unlockFunctionGroup(
          this.connection,
          config.functionGroupName,
          lockHandle,
          sessionId,
        );
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger?.info?.('Function group unlocked');
      }

      // 4. Final check (no stateful needed)
      this.logger?.info?.('Step 4: Final check');
      await checkFunctionGroup(
        this.connection,
        config.functionGroupName,
        'inactive',
      );
      this.logger?.info?.('Final check passed');

      // 5. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 5: Activating function group');
        const activateResponse = await activateFunctionGroup(
          this.connection,
          config.functionGroupName,
        );
        this.logger?.info?.(
          'Function group activated, status:',
          activateResponse.status,
        );

        // 5.5. Read with long polling to ensure object is ready after activation
        this.logger?.info?.('read (wait for object ready after activation)');
        try {
          const readState = await this.read(
            { functionGroupName: config.functionGroupName },
            'active',
            { withLongPolling: true },
          );
          if (readState) {
            return {
              updateResult: activateResponse,
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
          updateResult: activateResponse,
          errors: [],
        };
      }

      // Read and return result (no stateful needed)
      const readResponse = await getFunctionGroup(
        this.connection,
        config.functionGroupName,
      );
      return {
        updateResult: readResponse,
        errors: [],
      };
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger?.warn?.('Unlocking function group during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlockFunctionGroup(
            this.connection,
            config.functionGroupName,
            lockHandle,
            sessionId,
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
          this.logger?.warn?.('Deleting function group after failure');
          // No stateful needed - delete doesn't use lock/unlock
          await deleteFunctionGroup(this.connection, {
            function_group_name: config.functionGroupName,
            transport_request: config.transportRequest,
          });
        } catch (deleteError) {
          this.logger?.warn?.(
            'Failed to delete function group after failure:',
            deleteError,
          );
        }
      }

      this.logger?.error('Update failed:', error);
      throw error;
    }
  }

  /**
   * Delete function group
   */
  async delete(
    config: Partial<IFunctionGroupConfig>,
  ): Promise<IFunctionGroupState> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }

    try {
      // Check for deletion (no stateful needed)
      this.logger?.info?.('Checking function group for deletion');
      await checkDeletion(this.connection, {
        function_group_name: config.functionGroupName,
        transport_request: config.transportRequest,
      });
      this.logger?.info?.('Deletion check passed');

      // Delete (no stateful needed - no lock/unlock)
      this.logger?.info?.('Deleting function group');
      const result = await deleteFunctionGroup(this.connection, {
        function_group_name: config.functionGroupName,
        transport_request: config.transportRequest,
      });
      this.logger?.info?.('Function group deleted');

      return { deleteResult: result, errors: [] };
    } catch (error: any) {
      this.logger?.error('Delete failed:', error);
      throw error;
    }
  }

  /**
   * Activate function group
   * No stateful needed - uses same session/cookies
   */
  async activate(
    config: Partial<IFunctionGroupConfig>,
  ): Promise<IFunctionGroupState> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }

    try {
      const result = await activateFunctionGroup(
        this.connection,
        config.functionGroupName,
      );
      return { activateResult: result, errors: [] };
    } catch (error: any) {
      this.logger?.error('Activate failed:', error);
      throw error;
    }
  }

  /**
   * Check function group
   */
  async check(
    config: Partial<IFunctionGroupConfig>,
    status?: string,
  ): Promise<IFunctionGroupState> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }

    // Map status to version
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';
    return {
      checkResult: await checkFunctionGroup(
        this.connection,
        config.functionGroupName,
        version,
      ),
      errors: [],
    };
  }

  /**
   * Lock function group for modification
   */
  async lock(config: Partial<IFunctionGroupConfig>): Promise<string> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }

    this.connection.setSessionType('stateful');
    return await lockFunctionGroup(this.connection, config.functionGroupName);
  }

  /**
   * Unlock function group
   */
  async unlock(
    config: Partial<IFunctionGroupConfig>,
    lockHandle: string,
  ): Promise<IFunctionGroupState> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }

    const result = await unlockFunctionGroup(
      this.connection,
      config.functionGroupName,
      lockHandle,
    );
    this.connection.setSessionType('stateless');
    return {
      unlockResult: result,
      errors: [],
    };
  }
}

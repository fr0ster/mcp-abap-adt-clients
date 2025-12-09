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

import { IAbapConnection, IAdtObject, IAdtOperationOptions } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import { IAdtLogger, logErrorSafely } from '../../utils/logger';
import { FunctionGroupBuilderConfig } from './types';
import { validateFunctionGroupName } from './validation';
import { create as createFunctionGroup } from './create';
import { checkFunctionGroup } from './check';
import { lockFunctionGroup, unlockFunctionGroup } from './lock';
import { updateFunctionGroup } from './update';
import { activateFunctionGroup } from './activation';
import { checkDeletion, deleteFunctionGroup } from './delete';
import { getFunctionGroup } from './read';

export class AdtFunctionGroup implements IAdtObject<FunctionGroupBuilderConfig, FunctionGroupBuilderConfig> {
  private readonly connection: IAbapConnection;
  private readonly logger: IAdtLogger;
  public readonly objectType: string = 'FunctionGroup';

  constructor(connection: IAbapConnection, logger: IAdtLogger) {
    this.connection = connection;
    this.logger = logger;
  }

  /**
   * Validate function group configuration before creation
   */
  async validate(config: Partial<FunctionGroupBuilderConfig>): Promise<AxiosResponse> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required for validation');
    }

    return await validateFunctionGroupName(
      this.connection,
      config.functionGroupName,
      config.packageName,
      config.description
    );
  }

  /**
   * Create function group with full operation chain
   * Note: Function groups are containers, so no source code update after create
   */
  async create(
    config: FunctionGroupBuilderConfig,
    options?: IAdtOperationOptions
  ): Promise<FunctionGroupBuilderConfig> {
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
    const sessionId = this.connection.getSessionId?.() || '';

    try {
      // 1. Validate (no stateful needed)
      this.logger.info?.('Step 1: Validating function group configuration');
      await validateFunctionGroupName(
        this.connection,
        config.functionGroupName,
        config.packageName,
        config.description
      );
      this.logger.info?.('Validation passed');

      // 2. Create (no stateful needed)
      this.logger.info?.('Step 2: Creating function group');
      await createFunctionGroup(this.connection, {
        functionGroupName: config.functionGroupName,
        packageName: config.packageName,
        transportRequest: config.transportRequest,
        description: config.description
      });
      objectCreated = true;
      this.logger.info?.('Function group created');

      // 3. Check after create (no stateful needed)
      this.logger.info?.('Step 3: Checking created function group');
      await checkFunctionGroup(this.connection, config.functionGroupName, 'inactive');
      this.logger.info?.('Check after create passed');

      // Note: Function groups are containers - no source code to update after create

      // 4. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnCreate) {
        this.logger.info?.('Step 4: Activating function group');
        const activateResponse = await activateFunctionGroup(this.connection, config.functionGroupName);
        this.logger.info?.('Function group activated, status:', activateResponse.status);
        
        // Don't read after activation - object may not be ready yet
        // Return basic info (activation returns 201)
        return {
          functionGroupName: config.functionGroupName,
          packageName: config.packageName
        };
      }

      // Read and return result (no stateful needed)
      const readResponse = await getFunctionGroup(this.connection, config.functionGroupName);
      return {
        functionGroupName: config.functionGroupName,
        packageName: config.packageName
      };
    } catch (error: any) {
      // Ensure stateless if needed
      this.connection.setSessionType('stateless');

      if (objectCreated && options?.deleteOnFailure) {
        try {
          this.logger.warn?.('Deleting function group after failure');
          // No stateful needed - delete doesn't use lock/unlock
          await deleteFunctionGroup(this.connection, {
            function_group_name: config.functionGroupName,
            transport_request: config.transportRequest
          });
        } catch (deleteError) {
          this.logger.warn?.('Failed to delete function group after failure:', deleteError);
        }
      }

      logErrorSafely(this.logger, 'Create', error);
      throw error;
    }
  }

  /**
   * Read function group
   */
  async read(
    config: Partial<FunctionGroupBuilderConfig>,
    version: 'active' | 'inactive' = 'active'
  ): Promise<FunctionGroupBuilderConfig | undefined> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }

    try {
      const response = await getFunctionGroup(this.connection, config.functionGroupName);
      return {
        functionGroupName: config.functionGroupName
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Update function group with full operation chain
   * Always starts with lock
   * Note: Function groups only support metadata updates (description)
   */
  async update(
    config: Partial<FunctionGroupBuilderConfig>,
    options?: IAdtOperationOptions
  ): Promise<FunctionGroupBuilderConfig> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }
    if (!config.description) {
      throw new Error('Description is required for update');
    }

    let lockHandle: string | undefined;
    const sessionId = this.connection.getSessionId?.() || '';

    try {
      // 1. Lock (update always starts with lock, stateful ONLY before lock)
      this.logger.info?.('Step 1: Locking function group');
      this.connection.setSessionType('stateful');
      lockHandle = await lockFunctionGroup(this.connection, config.functionGroupName, sessionId);
      this.logger.info?.('Function group locked, handle:', lockHandle);

      // 2. Update metadata (description)
      this.logger.info?.('Step 2: Updating function group metadata');
      await updateFunctionGroup(this.connection, {
        function_group_name: config.functionGroupName,
        description: config.description,
        transport_request: config.transportRequest,
        lock_handle: lockHandle
      });
      this.logger.info?.('Function group updated');

      // 3. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger.info?.('Step 3: Unlocking function group');
        await unlockFunctionGroup(this.connection, config.functionGroupName, lockHandle, sessionId);
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger.info?.('Function group unlocked');
      }

      // 4. Final check (no stateful needed)
      this.logger.info?.('Step 4: Final check');
      await checkFunctionGroup(this.connection, config.functionGroupName, 'inactive');
      this.logger.info?.('Final check passed');

      // 5. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnUpdate) {
        this.logger.info?.('Step 5: Activating function group');
        const activateResponse = await activateFunctionGroup(this.connection, config.functionGroupName);
        this.logger.info?.('Function group activated, status:', activateResponse.status);
        
        // Don't read after activation - object may not be ready yet
        // Return basic info (activation returns 201)
        return {
          functionGroupName: config.functionGroupName
        };
      }

      // Read and return result (no stateful needed)
      const readResponse = await getFunctionGroup(this.connection, config.functionGroupName);
      return {
        functionGroupName: config.functionGroupName
      };
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger.warn?.('Unlocking function group during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlockFunctionGroup(this.connection, config.functionGroupName, lockHandle, sessionId);
          this.connection.setSessionType('stateless');
        } catch (unlockError) {
          this.logger.warn?.('Failed to unlock during cleanup:', unlockError);
        }
      } else {
        // Ensure stateless if lock failed
        this.connection.setSessionType('stateless');
      }

      if (options?.deleteOnFailure) {
        try {
          this.logger.warn?.('Deleting function group after failure');
          // No stateful needed - delete doesn't use lock/unlock
          await deleteFunctionGroup(this.connection, {
            function_group_name: config.functionGroupName,
            transport_request: config.transportRequest
          });
        } catch (deleteError) {
          this.logger.warn?.('Failed to delete function group after failure:', deleteError);
        }
      }

      logErrorSafely(this.logger, 'Update', error);
      throw error;
    }
  }

  /**
   * Delete function group
   */
  async delete(config: Partial<FunctionGroupBuilderConfig>): Promise<AxiosResponse> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }

    try {
      // Check for deletion (no stateful needed)
      this.logger.info?.('Checking function group for deletion');
      await checkDeletion(this.connection, {
        function_group_name: config.functionGroupName,
        transport_request: config.transportRequest
      });
      this.logger.info?.('Deletion check passed');

      // Delete (no stateful needed - no lock/unlock)
      this.logger.info?.('Deleting function group');
      const result = await deleteFunctionGroup(this.connection, {
        function_group_name: config.functionGroupName,
        transport_request: config.transportRequest
      });
      this.logger.info?.('Function group deleted');

      return result;
    } catch (error: any) {
      logErrorSafely(this.logger, 'Delete', error);
      throw error;
    }
  }

  /**
   * Activate function group
   * No stateful needed - uses same session/cookies
   */
  async activate(config: Partial<FunctionGroupBuilderConfig>): Promise<AxiosResponse> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }

    try {
      const result = await activateFunctionGroup(this.connection, config.functionGroupName);
      return result;
    } catch (error: any) {
      logErrorSafely(this.logger, 'Activate', error);
      throw error;
    }
  }

  /**
   * Check function group
   */
  async check(
    config: Partial<FunctionGroupBuilderConfig>,
    status?: string
  ): Promise<AxiosResponse> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }

    // Map status to version
    const version: 'active' | 'inactive' = status === 'active' ? 'active' : 'inactive';
    return await checkFunctionGroup(this.connection, config.functionGroupName, version);
  }
}

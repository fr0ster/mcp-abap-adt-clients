/**
 * AdtFunctionModule - High-level CRUD operations for Function Module objects
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
import { FunctionModuleBuilderConfig } from './types';
import { validateFunctionModuleName } from './validation';
import { create as createFunctionModule } from './create';
import { checkFunctionModule } from './check';
import { lockFunctionModule } from './lock';
import { update } from './update';
import { unlockFunctionModule } from './unlock';
import { activateFunctionModule } from './activation';
import { checkDeletion, deleteFunctionModule } from './delete';
import { getFunctionSource } from './read';

export class AdtFunctionModule implements IAdtObject<FunctionModuleBuilderConfig, FunctionModuleBuilderConfig> {
  private readonly connection: IAbapConnection;
  private readonly logger?: IAdtLogger;
  public readonly objectType: string = 'FunctionModule';

  constructor(connection: IAbapConnection, logger?: IAdtLogger) {
    this.connection = connection;
    this.logger = logger;
  }

  /**
   * Validate function module configuration before creation
   */
  async validate(config: Partial<FunctionModuleBuilderConfig>): Promise<AxiosResponse> {
    if (!config.functionModuleName) {
      throw new Error('Function module name is required for validation');
    }
    if (!config.functionGroupName) {
      throw new Error('Function group name is required for validation');
    }

    return await validateFunctionModuleName(
      this.connection,
      config.functionGroupName,
      config.functionModuleName,
      config.description
    );
  }

  /**
   * Create function module with full operation chain
   */
  async create(
    config: FunctionModuleBuilderConfig,
    options?: IAdtOperationOptions
  ): Promise<FunctionModuleBuilderConfig> {
    if (!config.functionModuleName) {
      throw new Error('Function module name is required');
    }
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }
    if (!config.description) {
      throw new Error('Description is required');
    }

    let objectCreated = false;
    let lockHandle: string | undefined;

    try {
      // 1. Validate (no stateful needed)
      this.logger?.info?.('Step 1: Validating function module configuration');
      await validateFunctionModuleName(
        this.connection,
        config.functionGroupName,
        config.functionModuleName,
        config.description
      );
      this.logger?.info?.('Validation passed');

      // 2. Create (no stateful needed)
      this.logger?.info?.('Step 2: Creating function module');
      await createFunctionModule(this.connection, {
        functionGroupName: config.functionGroupName,
        functionModuleName: config.functionModuleName,
        transportRequest: config.transportRequest,
        description: config.description
      });
      objectCreated = true;
      this.logger?.info?.('Function module created');

      // 3. Check after create (no stateful needed)
      this.logger?.info?.('Step 3: Checking created function module');
      await checkFunctionModule(this.connection, config.functionGroupName, config.functionModuleName, 'inactive');
      this.logger?.info?.('Check after create passed');

      // 4. Lock (stateful ONLY before lock)
      this.logger?.info?.('Step 4: Locking function module');
      this.connection.setSessionType('stateful');
      lockHandle = await lockFunctionModule(this.connection, config.functionGroupName, config.functionModuleName);
      this.logger?.info?.('Function module locked, handle:', lockHandle);

      // 5. Check inactive with code for update (from options or config)
      const codeToCheck = options?.sourceCode || config.sourceCode;
      if (codeToCheck) {
        this.logger?.info?.('Step 5: Checking inactive version with update content');
        await checkFunctionModule(this.connection, config.functionGroupName, config.functionModuleName, 'inactive', codeToCheck);
        this.logger?.info?.('Check inactive with update content passed');
      }

      // 6. Update
      if (codeToCheck && lockHandle) {
        this.logger?.info?.('Step 6: Updating function module with source code');
        await update(
          this.connection,
          {
            functionGroupName: config.functionGroupName,
            functionModuleName: config.functionModuleName,
            sourceCode: codeToCheck,
            lockHandle,
            transportRequest: config.transportRequest
          }
        );
        this.logger?.info?.('Function module updated');
      }

      // 7. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger?.info?.('Step 7: Unlocking function module');
        await unlockFunctionModule(this.connection, config.functionGroupName, config.functionModuleName, lockHandle);
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger?.info?.('Function module unlocked');
      }

      // 8. Final check (no stateful needed)
      this.logger?.info?.('Step 8: Final check');
      await checkFunctionModule(this.connection, config.functionGroupName, config.functionModuleName, 'inactive');
      this.logger?.info?.('Final check passed');

      // 9. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnCreate) {
        this.logger?.info?.('Step 9: Activating function module');
        const activateResponse = await activateFunctionModule(this.connection, config.functionGroupName, config.functionModuleName);
        this.logger?.info?.('Function module activated, status:', activateResponse.status);
        
        // Don't read after activation - object may not be ready yet
        // Return basic info (activation returns 201)
        return {
          functionGroupName: config.functionGroupName,
          functionModuleName: config.functionModuleName
        };
      }

      // Read and return result (no stateful needed)
      const readResponse = await getFunctionSource(this.connection, config.functionModuleName, config.functionGroupName);
      const sourceCode = typeof readResponse.data === 'string'
        ? readResponse.data
        : JSON.stringify(readResponse.data);

      return {
        functionGroupName: config.functionGroupName,
        functionModuleName: config.functionModuleName,
        sourceCode
      };
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger?.warn?.('Unlocking function module during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlockFunctionModule(this.connection, config.functionGroupName, config.functionModuleName, lockHandle);
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
          this.logger?.warn?.('Deleting function module after failure');
          // No stateful needed - delete doesn't use lock/unlock
          await deleteFunctionModule(this.connection, {
            function_module_name: config.functionModuleName,
            function_group_name: config.functionGroupName,
            transport_request: config.transportRequest
          });
        } catch (deleteError) {
          this.logger?.warn?.('Failed to delete function module after failure:', deleteError);
        }
      }

      logErrorSafely(this.logger, 'Create', error);
      throw error;
    }
  }

  /**
   * Read function module
   */
  async read(
    config: Partial<FunctionModuleBuilderConfig>,
    version: 'active' | 'inactive' = 'active'
  ): Promise<FunctionModuleBuilderConfig | undefined> {
    if (!config.functionModuleName) {
      throw new Error('Function module name is required');
    }
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }

    try {
      const response = await getFunctionSource(this.connection, config.functionModuleName, config.functionGroupName, version);
      const sourceCode = typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);

      return {
        functionGroupName: config.functionGroupName,
        functionModuleName: config.functionModuleName,
        sourceCode
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Update function module with full operation chain
   * Always starts with lock
   */
  async update(
    config: Partial<FunctionModuleBuilderConfig>,
    options?: IAdtOperationOptions
  ): Promise<FunctionModuleBuilderConfig> {
    if (!config.functionModuleName) {
      throw new Error('Function module name is required');
    }
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }

    let lockHandle: string | undefined;

    try {
      // 1. Lock (update always starts with lock, stateful ONLY before lock)
      this.logger?.info?.('Step 1: Locking function module');
      this.connection.setSessionType('stateful');
      lockHandle = await lockFunctionModule(this.connection, config.functionGroupName, config.functionModuleName);
      this.logger?.info?.('Function module locked, handle:', lockHandle);

      // 2. Check inactive with code for update (from options or config)
      const codeToCheck = options?.sourceCode || config.sourceCode;
      if (codeToCheck) {
        this.logger?.info?.('Step 2: Checking inactive version with update content');
        await checkFunctionModule(this.connection, config.functionGroupName, config.functionModuleName, 'inactive', codeToCheck);
        this.logger?.info?.('Check inactive with update content passed');
      }

      // 3. Update
      if (codeToCheck && lockHandle) {
        this.logger?.info?.('Step 3: Updating function module');
        await update(
          this.connection,
          {
            functionGroupName: config.functionGroupName,
            functionModuleName: config.functionModuleName,
            sourceCode: codeToCheck,
            lockHandle,
            transportRequest: config.transportRequest
          }
        );
        this.logger?.info?.('Function module updated');
      }

      // 4. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger?.info?.('Step 4: Unlocking function module');
        await unlockFunctionModule(this.connection, config.functionGroupName, config.functionModuleName, lockHandle);
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger?.info?.('Function module unlocked');
      }

      // 5. Final check (no stateful needed)
      this.logger?.info?.('Step 5: Final check');
      await checkFunctionModule(this.connection, config.functionGroupName, config.functionModuleName, 'inactive');
      this.logger?.info?.('Final check passed');

      // 6. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 6: Activating function module');
        const activateResponse = await activateFunctionModule(this.connection, config.functionGroupName, config.functionModuleName);
        this.logger?.info?.('Function module activated, status:', activateResponse.status);
        
        // Don't read after activation - object may not be ready yet
        // Return basic info (activation returns 201)
        return {
          functionGroupName: config.functionGroupName,
          functionModuleName: config.functionModuleName
        };
      }

      // Read and return result (no stateful needed)
      const readResponse = await getFunctionSource(this.connection, config.functionModuleName, config.functionGroupName);
      const sourceCode = typeof readResponse.data === 'string'
        ? readResponse.data
        : JSON.stringify(readResponse.data);

      return {
        functionGroupName: config.functionGroupName,
        functionModuleName: config.functionModuleName,
        sourceCode
      };
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger?.warn?.('Unlocking function module during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlockFunctionModule(this.connection, config.functionGroupName, config.functionModuleName, lockHandle);
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
          this.logger?.warn?.('Deleting function module after failure');
          // No stateful needed - delete doesn't use lock/unlock
          await deleteFunctionModule(this.connection, {
            function_module_name: config.functionModuleName,
            function_group_name: config.functionGroupName,
            transport_request: config.transportRequest
          });
        } catch (deleteError) {
          this.logger?.warn?.('Failed to delete function module after failure:', deleteError);
        }
      }

      logErrorSafely(this.logger, 'Update', error);
      throw error;
    }
  }

  /**
   * Delete function module
   */
  async delete(config: Partial<FunctionModuleBuilderConfig>): Promise<AxiosResponse> {
    if (!config.functionModuleName) {
      throw new Error('Function module name is required');
    }
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }

    try {
      // Check for deletion (no stateful needed)
      this.logger?.info?.('Checking function module for deletion');
      await checkDeletion(this.connection, {
        function_module_name: config.functionModuleName,
        function_group_name: config.functionGroupName,
        transport_request: config.transportRequest
      });
      this.logger?.info?.('Deletion check passed');

      // Delete (no stateful needed - no lock/unlock)
      this.logger?.info?.('Deleting function module');
      const result = await deleteFunctionModule(this.connection, {
        function_module_name: config.functionModuleName,
        function_group_name: config.functionGroupName,
        transport_request: config.transportRequest
      });
      this.logger?.info?.('Function module deleted');

      return result;
    } catch (error: any) {
      logErrorSafely(this.logger, 'Delete', error);
      throw error;
    }
  }

  /**
   * Activate function module
   * No stateful needed - uses same session/cookies
   */
  async activate(config: Partial<FunctionModuleBuilderConfig>): Promise<AxiosResponse> {
    if (!config.functionModuleName) {
      throw new Error('Function module name is required');
    }
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }

    try {
      const result = await activateFunctionModule(this.connection, config.functionGroupName, config.functionModuleName);
      return result;
    } catch (error: any) {
      logErrorSafely(this.logger, 'Activate', error);
      throw error;
    }
  }

  /**
   * Check function module
   */
  async check(
    config: Partial<FunctionModuleBuilderConfig>,
    status?: string
  ): Promise<AxiosResponse> {
    if (!config.functionModuleName) {
      throw new Error('Function module name is required');
    }
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }

    // Map status to version
    const version: 'active' | 'inactive' = status === 'active' ? 'active' : 'inactive';
    return await checkFunctionModule(this.connection, config.functionGroupName, config.functionModuleName, version);
  }
}

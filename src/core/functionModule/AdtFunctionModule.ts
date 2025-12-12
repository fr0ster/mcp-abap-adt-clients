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
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { IFunctionModuleConfig, IFunctionModuleState } from './types';
import { validateFunctionModuleName } from './validation';
import { create as createFunctionModule } from './create';
import { checkFunctionModule } from './check';
import { lockFunctionModule } from './lock';
import { update } from './update';
import { unlockFunctionModule } from './unlock';
import { activateFunctionModule } from './activation';
import { checkDeletion, deleteFunctionModule } from './delete';
import { getFunctionSource, getFunctionMetadata, getFunctionModuleTransport } from './read';

export class AdtFunctionModule implements IAdtObject<IFunctionModuleConfig, IFunctionModuleState> {
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  public readonly objectType: string = 'FunctionModule';

  constructor(connection: IAbapConnection, logger?: ILogger) {
    this.connection = connection;
    this.logger = logger;
  }

  /**
   * Validate function module configuration before creation
   */
  async validate(config: Partial<IFunctionModuleConfig>): Promise<IFunctionModuleState> {
    if (!config.functionModuleName) {
      throw new Error('Function module name is required for validation');
    }
    if (!config.functionGroupName) {
      throw new Error('Function group name is required for validation');
    }

    return {
      validationResponse: await validateFunctionModuleName(
      this.connection,
      config.functionGroupName,
      config.functionModuleName,
      config.description
    ),
    errors: []
  };
  }

  /**
   * Create function module with full operation chain
   */
  async create(
    config: IFunctionModuleConfig,
    options?: IAdtOperationOptions
  ): Promise<IFunctionModuleState> {
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

      // 2.5. Read with long polling (wait for object to be ready)
      this.logger?.info?.('read (wait for object ready)');
      try {
        await this.read(
          { functionModuleName: config.functionModuleName, functionGroupName: config.functionGroupName },
          'active',
          { withLongPolling: true }
        );
        this.logger?.info?.('object is ready after creation');
      } catch (readError) {
        this.logger?.warn?.('read with long polling failed (object may not be ready yet):', readError);
        // Continue anyway - check might still work
      }

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

        // 6.5. Read with long polling (wait for object to be ready after update)
        this.logger?.info?.('read (wait for object ready after update)');
        try {
          await this.read(
            { functionModuleName: config.functionModuleName, functionGroupName: config.functionGroupName },
            'active',
            { withLongPolling: true }
          );
          this.logger?.info?.('object is ready after update');
        } catch (readError) {
          this.logger?.warn?.('read with long polling failed (object may not be ready yet):', readError);
          // Continue anyway - unlock might still work
        }
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
        
        // 9.5. Read with long polling (wait for object to be ready after activation)
        this.logger?.info?.('read (wait for object ready after activation)');
        try {
          await this.read(
            { functionModuleName: config.functionModuleName, functionGroupName: config.functionGroupName },
            'active',
            { withLongPolling: true }
          );
          this.logger?.info?.('object is ready after activation');
        } catch (readError) {
          this.logger?.warn?.('read with long polling failed (object may not be ready yet):', readError);
          // Continue anyway - return activation response
        }
        
        return {
          createResult: activateResponse,
          errors: []
        };
      }

      // Read and return result (no stateful needed)
      const readResponse = await getFunctionSource(this.connection, config.functionModuleName, config.functionGroupName);
      const sourceCode = typeof readResponse.data === 'string'
        ? readResponse.data
        : JSON.stringify(readResponse.data);

      return {
        createResult: readResponse,
        errors: []
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

      this.logger?.error('Create failed:', error);
      throw error;
    }
  }

  /**
   * Read function module
   */
  async read(
    config: Partial<IFunctionModuleConfig>,
    version: 'active' | 'inactive' = 'active',
    options?: { withLongPolling?: boolean }
  ): Promise<IFunctionModuleState | undefined> {
    if (!config.functionModuleName) {
      throw new Error('Function module name is required');
    }
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }

    try {
      const response = await getFunctionSource(
        this.connection,
        config.functionModuleName,
        config.functionGroupName,
        version,
        options?.withLongPolling !== undefined ? { withLongPolling: options.withLongPolling } : undefined
      );
      return {
        readResult: response,
        errors: []
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Read function module metadata (object characteristics: package, responsible, description, etc.)
   */
  async readMetadata(
    config: Partial<IFunctionModuleConfig>,
    options?: { withLongPolling?: boolean }
  ): Promise<IFunctionModuleState> {
    const state: IFunctionModuleState = { errors: [] };
    if (!config.functionModuleName) {
      const error = new Error('Function module name is required');
      state.errors.push({ method: 'readMetadata', error, timestamp: new Date() });
      throw error;
    }
    if (!config.functionGroupName) {
      const error = new Error('Function group name is required');
      state.errors.push({ method: 'readMetadata', error, timestamp: new Date() });
      throw error;
    }
    try {
      const response = await getFunctionMetadata(
        this.connection,
        config.functionModuleName,
        config.functionGroupName,
        options?.withLongPolling !== undefined ? { withLongPolling: options.withLongPolling } : undefined
      );
      state.metadataResult = response;
      this.logger?.info?.('Function module metadata read successfully');
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({ method: 'readMetadata', error: err, timestamp: new Date() });
      this.logger?.error('readMetadata', err);
      throw err;
    }
  }

  /**
   * Read transport request information for the function module
   */
  async readTransport(
    config: Partial<IFunctionModuleConfig>,
    options?: { withLongPolling?: boolean }
  ): Promise<IFunctionModuleState> {
    const state: IFunctionModuleState = { errors: [] };
    if (!config.functionModuleName) {
      const error = new Error('Function module name is required');
      state.errors.push({ method: 'readTransport', error, timestamp: new Date() });
      throw error;
    }
    if (!config.functionGroupName) {
      const error = new Error('Function group name is required');
      state.errors.push({ method: 'readTransport', error, timestamp: new Date() });
      throw error;
    }
    try {
      const response = await getFunctionModuleTransport(
        this.connection,
        config.functionModuleName,
        config.functionGroupName,
        options?.withLongPolling !== undefined ? { withLongPolling: options.withLongPolling } : undefined
      );
      state.transportResult = response;
      this.logger?.info?.('Function module transport request read successfully');
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({ method: 'readTransport', error: err, timestamp: new Date() });
      this.logger?.error('readTransport', err);
      throw err;
    }
  }

  /**
   * Update function module with full operation chain
   * Always starts with lock
   */
  async update(
    config: Partial<IFunctionModuleConfig>,
    options?: IAdtOperationOptions
  ): Promise<IFunctionModuleState> {
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

        // 3.5. Read with long polling (wait for object to be ready after update)
        this.logger?.info?.('read (wait for object ready after update)');
        try {
          await this.read(
            { functionModuleName: config.functionModuleName, functionGroupName: config.functionGroupName },
            'active',
            { withLongPolling: true }
          );
          this.logger?.info?.('object is ready after update');
        } catch (readError) {
          this.logger?.warn?.('read with long polling failed (object may not be ready yet):', readError);
          // Continue anyway - unlock might still work
        }
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
        
        // 6.5. Read with long polling (wait for object to be ready after activation)
        this.logger?.info?.('read (wait for object ready after activation)');
        try {
          await this.read(
            { functionModuleName: config.functionModuleName, functionGroupName: config.functionGroupName },
            'active',
            { withLongPolling: true }
          );
          this.logger?.info?.('object is ready after activation');
        } catch (readError) {
          this.logger?.warn?.('read with long polling failed (object may not be ready yet):', readError);
          // Continue anyway - return activation response
        }
        
        return {
          updateResult: activateResponse,
          errors: []
        };
      }

      // Read and return result (no stateful needed)
      const readResponse = await getFunctionSource(this.connection, config.functionModuleName, config.functionGroupName);
      const sourceCode = typeof readResponse.data === 'string'
        ? readResponse.data
        : JSON.stringify(readResponse.data);

      return {
        updateResult: readResponse,
        errors: []
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

      this.logger?.error('Update failed:', error);
      throw error;
    }
  }

  /**
   * Delete function module
   */
  async delete(config: Partial<IFunctionModuleConfig>): Promise<IFunctionModuleState> {
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

      return { deleteResult: result, errors: [] };
    } catch (error: any) {
      this.logger?.error('Delete failed:', error);
      throw error;
    }
  }

  /**
   * Activate function module
   * No stateful needed - uses same session/cookies
   */
  async activate(config: Partial<IFunctionModuleConfig>): Promise<IFunctionModuleState> {
    if (!config.functionModuleName) {
      throw new Error('Function module name is required');
    }
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }

    try {
      const result = await activateFunctionModule(this.connection, config.functionGroupName, config.functionModuleName);
      return { activateResult: result, errors: [] };
    } catch (error: any) {
      this.logger?.error('Activate failed:', error);
      throw error;
    }
  }

  /**
   * Check function module
   */
  async check(
    config: Partial<IFunctionModuleConfig>,
    status?: string
  ): Promise<IFunctionModuleState> {
    if (!config.functionModuleName) {
      throw new Error('Function module name is required');
    }
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }

    // Map status to version
    const version: 'active' | 'inactive' = status === 'active' ? 'active' : 'inactive';
    return {
      checkResult: await checkFunctionModule(this.connection, config.functionGroupName, config.functionModuleName, version),
      errors: []
    };
  }
}

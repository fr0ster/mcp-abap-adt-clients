/**
 * AdtInterface - High-level CRUD operations for Interface objects
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
import { validateInterfaceName } from './validation';
import { create as createInterface } from './create';
import { upload } from './update';
import { checkInterface } from './check';
import { lockInterface } from './lock';
import { unlockInterface } from './unlock';
import { activateInterface } from './activation';
import { checkDeletion, deleteInterface } from './delete';
import { getInterfaceSource, getInterfaceTransport, getInterfaceMetadata } from './read';
import { IInterfaceConfig, IInterfaceState } from './types';

export class AdtInterface implements IAdtObject<IInterfaceConfig, IInterfaceState> {
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  public readonly objectType: string = 'Interface';

  constructor(connection: IAbapConnection, logger?: ILogger) {
    this.connection = connection;
    this.logger = logger;
  }

  /**
   * Validate interface configuration before creation
   */
  async validate(config: Partial<IInterfaceConfig>): Promise<IInterfaceState> {
    if (!config.interfaceName) {
      throw new Error('Interface name is required for validation');
    }

    const validationResponse = await validateInterfaceName(
      this.connection,
      config.interfaceName,
      config.packageName,
      config.description
    );

    return {
      validationResponse: validationResponse,
      errors: []
    };
  }

  /**
   * Create interface with full operation chain
   */
  async create(
    config: IInterfaceConfig,
    options?: IAdtOperationOptions
  ): Promise<IInterfaceState> {
    if (!config.interfaceName) {
      throw new Error('Interface name is required');
    }
    if (!config.packageName) {
      throw new Error('Package name is required');
    }
    if (!config.description) {
      throw new Error('Description is required');
    }

    let objectCreated = false;
    let lockHandle: string | undefined;
    const state: IInterfaceState = {
      errors: []
    };

    try {
      // 1. Validate (no stateful needed)
      this.logger?.info?.('Step 1: Validating interface configuration');
      const validationResponse = await validateInterfaceName(
        this.connection,
        config.interfaceName,
        config.packageName,
        config.description
      );
      state.validationResponse = validationResponse;
      this.logger?.info?.('Validation passed');

      // 2. Create (no stateful needed)
      this.logger?.info?.('Step 2: Creating interface');
      const createResponse = await createInterface(this.connection, {
        interfaceName: config.interfaceName,
        packageName: config.packageName,
        transportRequest: config.transportRequest,
        description: config.description
      });
      state.createResult = createResponse;
      objectCreated = true;
      this.logger?.info?.('Interface created');

      // 2.5. Read with long polling to ensure object is ready
      // Read 'inactive' version since object is not yet activated
      this.logger?.info?.('read (wait for object ready)');
      try {
        await this.read(
          { interfaceName: config.interfaceName },
          'inactive',
          { withLongPolling: true }
        );
        this.logger?.info?.('object is ready after creation');
      } catch (readError) {
        this.logger?.warn?.('read with long polling failed (object may not be ready yet):', readError);
        // Continue anyway - check might still work
      }

      // 3. Check after create (no stateful needed)
      this.logger?.info?.('Step 3: Checking created interface');
      const checkResponse1 = await checkInterface(this.connection, config.interfaceName, 'inactive');
      state.checkResult = checkResponse1;
      this.logger?.info?.('Check after create passed');

      // 4. Lock (stateful ТІЛЬКИ перед lock)
      this.logger?.info?.('Step 4: Locking interface');
      this.connection.setSessionType('stateful');
      const lockResult = await lockInterface(this.connection, config.interfaceName);
      lockHandle = lockResult.lockHandle;
      state.lockHandle = lockHandle;
      this.logger?.info?.('Interface locked, handle:', lockHandle);

      // 5. Check inactive with code for update
      const codeToCheck = options?.sourceCode || config.sourceCode;
      if (codeToCheck) {
        this.logger?.info?.('Step 5: Checking inactive version with update content');
        const checkResponse2 = await checkInterface(this.connection, config.interfaceName, 'inactive', codeToCheck);
        state.checkResult = checkResponse2;
        this.logger?.info?.('Check inactive with update content passed');
      }

      // 6. Update
      if (codeToCheck && lockHandle) {
        this.logger?.info?.('Step 6: Updating interface with source code');
        await upload(
          this.connection,
          config.interfaceName,
          codeToCheck,
          lockHandle,
          config.transportRequest
        );
        // upload() returns void, so we don't store it in state
        this.logger?.info?.('Interface updated');

        // 6.5. Read with long polling to ensure object is ready after update
        this.logger?.info?.('read (wait for object ready after update)');
        try {
          await this.read(
            { interfaceName: config.interfaceName },
            'active',
            { withLongPolling: true }
          );
          this.logger?.info?.('object is ready after update');
        } catch (readError) {
          this.logger?.warn?.('read with long polling failed after update:', readError);
          // Continue anyway - unlock might still work
        }
      }

      // 7. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger?.info?.('Step 7: Unlocking interface');
        const unlockResponse = await unlockInterface(this.connection, config.interfaceName, lockHandle);
        state.unlockResult = unlockResponse;
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger?.info?.('Interface unlocked');
      }

      // 8. Final check (no stateful needed)
      this.logger?.info?.('Step 8: Final check');
      const checkResponse3 = await checkInterface(this.connection, config.interfaceName, 'inactive');
      state.checkResult = checkResponse3;
      this.logger?.info?.('Final check passed');

      // 9. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnCreate) {
        this.logger?.info?.('Step 9: Activating interface');
        const activateResponse = await activateInterface(this.connection, config.interfaceName);
        state.activateResult = activateResponse;
        this.logger?.info?.('Interface activated, status:', activateResponse.status);

        // 9.5. Read with long polling to ensure object is ready after activation
        this.logger?.info?.('read (wait for object ready after activation)');
        try {
          const readState = await this.read(
            { interfaceName: config.interfaceName },
            'active',
            { withLongPolling: true }
          );
          if (readState) {
            state.readResult = readState.readResult;
          }
          this.logger?.info?.('object is ready after activation');
        } catch (readError) {
          this.logger?.warn?.('read with long polling failed after activation:', readError);
          // Continue anyway - activation was successful
        }
      } else {
        // Read inactive version if not activated
        const readResponse = await getInterfaceSource(this.connection, config.interfaceName, 'inactive');
        state.readResult = readResponse;
      }

      return state;
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger?.warn?.('Unlocking interface during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlockInterface(this.connection, config.interfaceName, lockHandle);
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
          this.logger?.warn?.('Deleting interface after failure');
          this.connection.setSessionType('stateful');
          await deleteInterface(this.connection, {
            interface_name: config.interfaceName,
            transport_request: config.transportRequest
          });
          this.connection.setSessionType('stateless');
        } catch (deleteError) {
          this.logger?.warn?.('Failed to delete interface after failure:', deleteError);
        }
      }

      this.logger?.error('Create failed:', error);
      throw error;
    }
  }

  /**
   * Read interface
   */
  async read(
    config: Partial<IInterfaceConfig>,
    version: 'active' | 'inactive' = 'active',
    options?: { withLongPolling?: boolean }
  ): Promise<IInterfaceState | undefined> {
    if (!config.interfaceName) {
      throw new Error('Interface name is required');
    }

    try {
      const response = await getInterfaceSource(
        this.connection,
        config.interfaceName,
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
      this.logger?.error('Read failed:', error);
      throw error;
    }
  }

  /**
   * Read interface metadata (object characteristics: package, responsible, description, etc.)
   */
  async readMetadata(
    config: Partial<IInterfaceConfig>,
    options?: { withLongPolling?: boolean }
  ): Promise<IInterfaceState> {
    const state: IInterfaceState = { errors: [] };
    if (!config.interfaceName) {
      const error = new Error('Interface name is required');
      state.errors.push({ method: 'readMetadata', error, timestamp: new Date() });
      throw error;
    }
    try {
      const response = await getInterfaceMetadata(
        this.connection,
        config.interfaceName,
        options?.withLongPolling !== undefined ? { withLongPolling: options.withLongPolling } : undefined
      );
      state.metadataResult = response;
      this.logger?.info?.('Interface metadata read successfully');
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({ method: 'readMetadata', error: err, timestamp: new Date() });
      this.logger?.error('readMetadata', err);
      throw err;
    }
  }

  /**
   * Update interface with full operation chain
   * Always starts with lock
   */
  async update(
    config: Partial<IInterfaceConfig>,
    options?: IAdtOperationOptions
  ): Promise<IInterfaceState> {
    if (!config.interfaceName) {
      throw new Error('Interface name is required');
    }

    let lockHandle: string | undefined;
    const state: IInterfaceState = {
      errors: []
    };

    try {
      // 1. Lock (update always starts with lock, stateful only for lock)
      this.logger?.info?.('Step 1: Locking interface');
      this.connection.setSessionType('stateful');
      const lockResult = await lockInterface(this.connection, config.interfaceName);
      lockHandle = lockResult.lockHandle;
      state.lockHandle = lockHandle;
      this.logger?.info?.('Interface locked, handle:', lockHandle);

      // 2. Check inactive with code for update (from options or config)
      const codeToCheck = options?.sourceCode || config.sourceCode;
      if (codeToCheck) {
        this.logger?.info?.('Step 2: Checking inactive version with update content');
        const checkResponse = await checkInterface(this.connection, config.interfaceName, 'inactive', codeToCheck);
        state.checkResult = checkResponse;
        this.logger?.info?.('Check inactive with update content passed');
      }

      // 3. Update
      if (codeToCheck && lockHandle) {
        this.logger?.info?.('Step 3: Updating interface');
        await upload(
          this.connection,
          config.interfaceName,
          codeToCheck,
          lockHandle,
          config.transportRequest
        );
        // upload() returns void, so we don't store it in state
        this.logger?.info?.('Interface updated');

        // 3.5. Read with long polling to ensure object is ready after update
        this.logger?.info?.('read (wait for object ready after update)');
        try {
          await this.read(
            { interfaceName: config.interfaceName },
            'active',
            { withLongPolling: true }
          );
          this.logger?.info?.('object is ready after update');
        } catch (readError) {
          this.logger?.warn?.('read with long polling failed after update:', readError);
          // Continue anyway - unlock might still work
        }
      }

      // 4. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger?.info?.('Step 4: Unlocking interface');
        const unlockResponse = await unlockInterface(this.connection, config.interfaceName, lockHandle);
        state.unlockResult = unlockResponse;
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger?.info?.('Interface unlocked');
      }

      // 5. Final check (no stateful needed)
      this.logger?.info?.('Step 5: Final check');
      const checkResponse2 = await checkInterface(this.connection, config.interfaceName, 'inactive');
      state.checkResult = checkResponse2;
      this.logger?.info?.('Final check passed');

      // 6. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 6: Activating interface');
        const activateResponse = await activateInterface(this.connection, config.interfaceName);
        state.activateResult = activateResponse;
        this.logger?.info?.('Interface activated, status:', activateResponse.status);

        // 6.5. Read with long polling to ensure object is ready after activation
        this.logger?.info?.('read (wait for object ready after activation)');
        try {
          const readState = await this.read(
            { interfaceName: config.interfaceName },
            'active',
            { withLongPolling: true }
          );
          if (readState) {
            state.readResult = readState.readResult;
          }
          this.logger?.info?.('object is ready after activation');
        } catch (readError) {
          this.logger?.warn?.('read with long polling failed after activation:', readError);
          // Continue anyway - activation was successful
        }
      } else {
        // Read inactive version if not activated
        const readResponse = await getInterfaceSource(this.connection, config.interfaceName, 'inactive');
        state.readResult = readResponse;
      }

      return state;
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger?.warn?.('Unlocking interface during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlockInterface(this.connection, config.interfaceName, lockHandle);
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
          this.logger?.warn?.('Deleting interface after failure');
          this.connection.setSessionType('stateful');
          await deleteInterface(this.connection, {
            interface_name: config.interfaceName,
            transport_request: config.transportRequest
          });
          this.connection.setSessionType('stateless');
        } catch (deleteError) {
          this.logger?.warn?.('Failed to delete interface after failure:', deleteError);
        }
      }

      this.logger?.error('Update failed:', error);
      throw error;
    }
  }

  /**
   * Delete interface
   */
  async delete(config: Partial<IInterfaceConfig>): Promise<IInterfaceState> {
    if (!config.interfaceName) {
      throw new Error('Interface name is required');
    }

    const state: IInterfaceState = {
      errors: []
    };

    try {
      // Check for deletion (no stateful needed)
      this.logger?.info?.('Checking interface for deletion');
      const checkResponse = await checkDeletion(this.connection, {
        interface_name: config.interfaceName,
        transport_request: config.transportRequest
      });
      state.checkResult = checkResponse;
      this.logger?.info?.('Deletion check passed');

      // Delete (requires stateful, but no lock)
      this.logger?.info?.('Deleting interface');
      this.connection.setSessionType('stateful');
      const deleteResponse = await deleteInterface(this.connection, {
        interface_name: config.interfaceName,
        transport_request: config.transportRequest
      });
      state.deleteResult = deleteResponse;
      this.logger?.info?.('Interface deleted');

      return state;
    } catch (error: any) {
      this.logger?.error('Delete failed:', error);
      throw error;
    } finally {
      this.connection.setSessionType('stateless');
    }
  }

  /**
   * Activate interface
   * No stateful needed - uses same session/cookies
   */
  async activate(config: Partial<IInterfaceConfig>): Promise<IInterfaceState> {
    if (!config.interfaceName) {
      throw new Error('Interface name is required');
    }

    const state: IInterfaceState = {
      errors: []
    };

    try {
      const activateResponse = await activateInterface(this.connection, config.interfaceName);
      state.activateResult = activateResponse;
      return state;
    } catch (error: any) {
      this.logger?.error('Activate failed:', error);
      throw error;
    }
  }

  /**
   * Check interface
   */
  async check(
    config: Partial<IInterfaceConfig>,
    status?: string
  ): Promise<IInterfaceState> {
    if (!config.interfaceName) {
      throw new Error('Interface name is required');
    }

    const state: IInterfaceState = {
      errors: []
    };

    // Map status to version
    const version: 'active' | 'inactive' = status === 'active' ? 'active' : 'inactive';
    const checkResponse = await checkInterface(this.connection, config.interfaceName, version, config.sourceCode);
    state.checkResult = checkResponse;
    return state;
  }

  /**
   * Read transport request information for the interface
   */
  async readTransport(
    config: Partial<IInterfaceConfig>,
    options?: { withLongPolling?: boolean }
  ): Promise<IInterfaceState> {
    const state: IInterfaceState = {
      errors: []
    };

    if (!config.interfaceName) {
      const error = new Error('Interface name is required');
      state.errors.push({
        method: 'readTransport',
        error,
        timestamp: new Date()
      });
      throw error;
    }

    try {
      const response = await getInterfaceTransport(
        this.connection,
        config.interfaceName,
        options?.withLongPolling !== undefined ? { withLongPolling: options.withLongPolling } : undefined
      );
      state.transportResult = response;
      this.logger?.info?.('Transport request read successfully');
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({
        method: 'readTransport',
        error: err,
        timestamp: new Date()
      });
      this.logger?.error('readTransport', err);
      throw err;
    }
  }
}

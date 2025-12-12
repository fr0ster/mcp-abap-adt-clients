/**
 * AdtStructure - High-level CRUD operations for Structure objects
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
import { IStructureConfig, IStructureState } from './types';
import { validateStructureName } from './validation';
import { create as createStructure } from './create';
import { checkStructure } from './check';
import { lockStructure } from './lock';
import { upload } from './update';
import { unlockStructure } from './unlock';
import { activateStructure } from './activation';
import { checkDeletion, deleteStructure } from './delete';
import { getStructureSource, getStructureMetadata, getStructureTransport } from './read';

export class AdtStructure implements IAdtObject<IStructureConfig, IStructureState> {
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  public readonly objectType: string = 'Structure';

  constructor(connection: IAbapConnection, logger?: ILogger) {
    this.connection = connection;
    this.logger = logger;
  }

  /**
   * Validate structure configuration before creation
   */
  async validate(config: Partial<IStructureConfig>): Promise<IStructureState> {
    if (!config.structureName) {
      throw new Error('Structure name is required for validation');
    }

    const state: IStructureState = { errors: [] };
    try {
      const response = await validateStructureName(
      this.connection,
      config.structureName,
      config.description
    );
    state.validationResponse = response;
    return state;
  } catch (error: any) {
    state.errors.push({ method: 'validate', error: error instanceof Error ? error : new Error(String(error)), timestamp: new Date() });
    this.logger?.error('validate failed:', error);
    throw error;
  }
  }

  /**
   * Create structure with full operation chain
   */
  async create(
    config: IStructureConfig,
    options?: IAdtOperationOptions
  ): Promise<IStructureState> {
    if (!config.structureName) {
      throw new Error('Structure name is required');
    }
    if (!config.packageName) {
      throw new Error('Package name is required');
    }
    if (!config.description) {
      throw new Error('Description is required');
    }

    let objectCreated = false;
    let lockHandle: string | undefined;

    try {
      // 1. Validate (no stateful needed)
      this.logger?.info?.('Step 1: Validating structure configuration');
      await validateStructureName(
        this.connection,
        config.structureName,
        config.description
      );
      this.logger?.info?.('Validation passed');

      // 2. Create (no stateful needed)
      this.logger?.info?.('Step 2: Creating structure');
      await createStructure(this.connection, {
        structureName: config.structureName,
        packageName: config.packageName,
        transportRequest: config.transportRequest,
        description: config.description
      });
      objectCreated = true;
      this.logger?.info?.('Structure created');

      // 2.5. Read with long polling to ensure object is ready
      // Read 'inactive' version since object is not yet activated
      this.logger?.info?.('read (wait for object ready)');
      try {
        await this.read(
          { structureName: config.structureName },
          'inactive',
          { withLongPolling: true }
        );
        this.logger?.info?.('object is ready after creation');
      } catch (readError) {
        this.logger?.warn?.('read with long polling failed (object may not be ready yet):', readError);
        // Continue anyway - check might still work
      }

      // 3. Check after create (no stateful needed)
      this.logger?.info?.('Step 3: Checking created structure');
      await checkStructure(this.connection, config.structureName, 'inactive');
      this.logger?.info?.('Check after create passed');

      // 4. Lock (stateful ONLY before lock)
      this.logger?.info?.('Step 4: Locking structure');
      this.connection.setSessionType('stateful');
      lockHandle = await lockStructure(this.connection, config.structureName);
      this.logger?.info?.('Structure locked, handle:', lockHandle);

      // 5. Check inactive with code for update (from options or config)
      const codeToCheck = options?.sourceCode || config.ddlCode;
      if (codeToCheck) {
        this.logger?.info?.('Step 5: Checking inactive version with update content');
        await checkStructure(this.connection, config.structureName, 'inactive', codeToCheck);
        this.logger?.info?.('Check inactive with update content passed');
      }

      // 6. Update
      if (codeToCheck && lockHandle) {
        this.logger?.info?.('Step 6: Updating structure with DDL code');
        await upload(
          this.connection,
          {
            structureName: config.structureName,
            ddlCode: codeToCheck,
            transportRequest: config.transportRequest
          },
          lockHandle
        );
        this.logger?.info?.('Structure updated');

        // 6.5. Read with long polling to ensure object is ready after update
        this.logger?.info?.('read (wait for object ready after update)');
        try {
          await this.read(
            { structureName: config.structureName },
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
        this.logger?.info?.('Step 7: Unlocking structure');
        await unlockStructure(this.connection, config.structureName, lockHandle);
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger?.info?.('Structure unlocked');
      }

      // 8. Final check (no stateful needed)
      this.logger?.info?.('Step 8: Final check');
      await checkStructure(this.connection, config.structureName, 'inactive');
      this.logger?.info?.('Final check passed');

      // 9. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnCreate) {
        this.logger?.info?.('Step 9: Activating structure');
        const activateResponse = await activateStructure(this.connection, config.structureName);
        this.logger?.info?.('Structure activated, status:', activateResponse.status);

        // 9.5. Read with long polling to ensure object is ready after activation
        this.logger?.info?.('read (wait for object ready after activation)');
        try {
          const readState = await this.read(
            { structureName: config.structureName },
            'active',
            { withLongPolling: true }
          );
          if (readState) {
            return {
              createResult: activateResponse,
              readResult: readState.readResult,
              errors: []
            };
          }
          this.logger?.info?.('object is ready after activation');
        } catch (readError) {
          this.logger?.warn?.('read with long polling failed after activation:', readError);
          // Continue anyway - activation was successful
        }
        return {
          createResult: activateResponse,
          errors: []
        };
      }

      // Read and return result (no stateful needed)
      const readResponse = await getStructureSource(this.connection, config.structureName, 'inactive');
      return {
        readResult: readResponse,
        errors: []
      };
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger?.warn?.('Unlocking structure during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlockStructure(this.connection, config.structureName, lockHandle);
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
          this.logger?.warn?.('Deleting structure after failure');
          // No stateful needed - delete doesn't use lock/unlock
          await deleteStructure(this.connection, {
            structure_name: config.structureName,
            transport_request: config.transportRequest
          });
        } catch (deleteError) {
          this.logger?.warn?.('Failed to delete structure after failure:', deleteError);
        }
      }

      this.logger?.error('Create failed:', error);
      throw error;
    }
  }

  /**
   * Read structure
   */
  async read(
    config: Partial<IStructureConfig>,
    version: 'active' | 'inactive' = 'active',
    options?: { withLongPolling?: boolean }
  ): Promise<IStructureState | undefined> {
    if (!config.structureName) {
      throw new Error('Structure name is required');
    }

    try {
      const response = await getStructureSource(
        this.connection,
        config.structureName,
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
   * Read structure metadata (object characteristics: package, responsible, description, etc.)
   */
  async readMetadata(
    config: Partial<IStructureConfig>,
    options?: { withLongPolling?: boolean }
  ): Promise<IStructureState> {
    const state: IStructureState = { errors: [] };
    if (!config.structureName) {
      const error = new Error('Structure name is required');
      state.errors.push({ method: 'readMetadata', error, timestamp: new Date() });
      throw error;
    }
    try {
      const response = await getStructureMetadata(
        this.connection,
        config.structureName,
        options?.withLongPolling !== undefined ? { withLongPolling: options.withLongPolling } : undefined
      );
      state.metadataResult = response;
      this.logger?.info?.('Structure metadata read successfully');
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({ method: 'readMetadata', error: err, timestamp: new Date() });
      this.logger?.error('readMetadata', err);
      throw err;
    }
  }

  /**
   * Read transport request information for the structure
   */
  async readTransport(
    config: Partial<IStructureConfig>,
    options?: { withLongPolling?: boolean }
  ): Promise<IStructureState> {
    const state: IStructureState = { errors: [] };
    if (!config.structureName) {
      const error = new Error('Structure name is required');
      state.errors.push({ method: 'readTransport', error, timestamp: new Date() });
      throw error;
    }
    try {
      const response = await getStructureTransport(
        this.connection,
        config.structureName,
        options?.withLongPolling !== undefined ? { withLongPolling: options.withLongPolling } : undefined
      );
      state.transportResult = response;
      this.logger?.info?.('Structure transport request read successfully');
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({ method: 'readTransport', error: err, timestamp: new Date() });
      this.logger?.error('readTransport', err);
      throw err;
    }
  }

  /**
   * Update structure with full operation chain
   * Always starts with lock
   */
  async update(
    config: Partial<IStructureConfig>,
    options?: IAdtOperationOptions
  ): Promise<IStructureState> {
    if (!config.structureName) {
      throw new Error('Structure name is required');
    }

    let lockHandle: string | undefined;

    try {
      // 1. Lock (update always starts with lock, stateful ONLY before lock)
      this.logger?.info?.('Step 1: Locking structure');
      this.connection.setSessionType('stateful');
      lockHandle = await lockStructure(this.connection, config.structureName);
      this.logger?.info?.('Structure locked, handle:', lockHandle);

      // 2. Check inactive with code for update (from options or config)
      const codeToCheck = options?.sourceCode || config.ddlCode;
      if (codeToCheck) {
        this.logger?.info?.('Step 2: Checking inactive version with update content');
        await checkStructure(this.connection, config.structureName, 'inactive', codeToCheck);
        this.logger?.info?.('Check inactive with update content passed');
      }

      // 3. Update
      if (codeToCheck && lockHandle) {
        this.logger?.info?.('Step 3: Updating structure');
        await upload(
          this.connection,
          {
            structureName: config.structureName,
            ddlCode: codeToCheck,
            transportRequest: config.transportRequest
          },
          lockHandle
        );
        this.logger?.info?.('Structure updated');

        // 3.5. Read with long polling to ensure object is ready after update
        this.logger?.info?.('read (wait for object ready after update)');
        try {
          await this.read(
            { structureName: config.structureName },
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
        this.logger?.info?.('Step 4: Unlocking structure');
        await unlockStructure(this.connection, config.structureName, lockHandle);
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger?.info?.('Structure unlocked');
      }

      // 5. Final check (no stateful needed)
      this.logger?.info?.('Step 5: Final check');
      await checkStructure(this.connection, config.structureName, 'inactive');
      this.logger?.info?.('Final check passed');

      // 6. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 6: Activating structure');
        const activateResponse = await activateStructure(this.connection, config.structureName);
        this.logger?.info?.('Structure activated, status:', activateResponse.status);

        // 6.5. Read with long polling to ensure object is ready after activation
        this.logger?.info?.('read (wait for object ready after activation)');
        try {
          const readState = await this.read(
            { structureName: config.structureName },
            'active',
            { withLongPolling: true }
          );
          if (readState) {
            return {
              activateResult: activateResponse,
              readResult: readState.readResult,
              errors: []
            };
          }
          this.logger?.info?.('object is ready after activation');
        } catch (readError) {
          this.logger?.warn?.('read with long polling failed after activation:', readError);
          // Continue anyway - activation was successful
        }
        return {
          activateResult: activateResponse,
          errors: []
        };
      }

      // Read and return result (no stateful needed)
      const readResponse = await getStructureSource(this.connection, config.structureName, 'inactive');
      return {
        readResult: readResponse,
        errors: []
      };
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger?.warn?.('Unlocking structure during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlockStructure(this.connection, config.structureName, lockHandle);
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
          this.logger?.warn?.('Deleting structure after failure');
          // No stateful needed - delete doesn't use lock/unlock
          await deleteStructure(this.connection, {
            structure_name: config.structureName,
            transport_request: config.transportRequest
          });
        } catch (deleteError) {
          this.logger?.warn?.('Failed to delete structure after failure:', deleteError);
        }
      }

      this.logger?.error('Update failed:', error);
      throw error;
    }
  }

  /**
   * Delete structure
   */
  async delete(config: Partial<IStructureConfig>): Promise<IStructureState> {
    if (!config.structureName) {
      throw new Error('Structure name is required');
    }

    try {
      // Check for deletion (no stateful needed)
      this.logger?.info?.('Checking structure for deletion');
      await checkDeletion(this.connection, {
        structure_name: config.structureName,
        transport_request: config.transportRequest
      });
      this.logger?.info?.('Deletion check passed');

      // Delete (no stateful needed - no lock/unlock)
      this.logger?.info?.('Deleting structure');
      const result = await deleteStructure(this.connection, {
        structure_name: config.structureName,
        transport_request: config.transportRequest
      });
      this.logger?.info?.('Structure deleted');

      return {
        deleteResult: result,
        errors: []
      };
    } catch (error: any) {
      this.logger?.error('Delete failed:', error);
      throw error;
    }
  }

  /**
   * Activate structure
   * No stateful needed - uses same session/cookies
   */
  async activate(config: Partial<IStructureConfig>): Promise<IStructureState> {
    if (!config.structureName) {
      throw new Error('Structure name is required');
    }

    try {
      const result = await activateStructure(this.connection, config.structureName);
      return {
        activateResult: result,
        errors: []
      };
    } catch (error: any) {
      this.logger?.error('Activate failed:', error);
      throw error;
    }
  }

  /**
   * Check structure
   */
  async check(
    config: Partial<IStructureConfig>,
    status?: string
  ): Promise<IStructureState> {
    if (!config.structureName) {
      throw new Error('Structure name is required');
    }

    // Map status to version
    const version: 'active' | 'inactive' = status === 'active' ? 'active' : 'inactive';
    return {
      checkResult: await checkStructure(this.connection, config.structureName, version),
      errors: []
    };
  }
}

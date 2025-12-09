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

import { IAbapConnection, IAdtObject, CreateOptions, UpdateOptions } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import { IAdtLogger, logErrorSafely } from '../../utils/logger';
import { InterfaceBuilderConfig } from './types';
import { validateInterfaceName } from './validation';
import { create as createInterface } from './create';
import { upload } from './create';
import { checkInterface } from './check';
import { lockInterface } from './lock';
import { unlockInterface } from './unlock';
import { activateInterface } from './activation';
import { checkDeletion, deleteInterface } from './delete';
import { getInterfaceSource } from './read';

export class AdtInterface implements IAdtObject<InterfaceBuilderConfig, InterfaceBuilderConfig> {
  private readonly connection: IAbapConnection;
  private readonly logger: IAdtLogger;
  public readonly objectType: string = 'Interface';

  constructor(connection: IAbapConnection, logger: IAdtLogger) {
    this.connection = connection;
    this.logger = logger;
  }

  /**
   * Validate interface configuration before creation
   */
  async validate(config: Partial<InterfaceBuilderConfig>): Promise<AxiosResponse> {
    if (!config.interfaceName) {
      throw new Error('Interface name is required for validation');
    }

    return await validateInterfaceName(
      this.connection,
      config.interfaceName,
      config.packageName,
      config.description
    );
  }

  /**
   * Create interface with full operation chain
   */
  async create(
    config: InterfaceBuilderConfig,
    options?: CreateOptions
  ): Promise<InterfaceBuilderConfig> {
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

    try {
      // 1. Validate (no stateful needed)
      this.logger.info?.('Step 1: Validating interface configuration');
      await validateInterfaceName(
        this.connection,
        config.interfaceName,
        config.packageName,
        config.description
      );
      this.logger.info?.('Validation passed');

      // 2. Create (no stateful needed)
      this.logger.info?.('Step 2: Creating interface');
      await createInterface(this.connection, {
        interfaceName: config.interfaceName,
        packageName: config.packageName,
        transportRequest: config.transportRequest,
        description: config.description
      });
      objectCreated = true;
      this.logger.info?.('Interface created');

      // 3. Check after create (no stateful needed)
      this.logger.info?.('Step 3: Checking created interface');
      await checkInterface(this.connection, config.interfaceName, 'inactive');
      this.logger.info?.('Check after create passed');

      // 4. Lock (stateful ТІЛЬКИ перед lock)
      this.logger.info?.('Step 4: Locking interface');
      this.connection.setSessionType('stateful');
      const lockResult = await lockInterface(this.connection, config.interfaceName);
      lockHandle = lockResult.lockHandle;
      this.logger.info?.('Interface locked, handle:', lockHandle);

      // 5. Check inactive with code for update
      const codeToCheck = options?.sourceCode || config.sourceCode;
      if (codeToCheck) {
        this.logger.info?.('Step 5: Checking inactive version with update content');
        await checkInterface(this.connection, config.interfaceName, 'inactive', codeToCheck);
        this.logger.info?.('Check inactive with update content passed');
      }

      // 6. Update
      if (codeToCheck && lockHandle) {
        this.logger.info?.('Step 6: Updating interface with source code');
        await upload(
          this.connection,
          config.interfaceName,
          codeToCheck,
          lockHandle,
          config.transportRequest
        );
        this.logger.info?.('Interface updated');
      }

      // 7. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger.info?.('Step 7: Unlocking interface');
        await unlockInterface(this.connection, config.interfaceName, lockHandle);
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger.info?.('Interface unlocked');
      }

      // 8. Final check (no stateful needed)
      this.logger.info?.('Step 8: Final check');
      await checkInterface(this.connection, config.interfaceName, 'inactive');
      this.logger.info?.('Final check passed');

      // 9. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnCreate) {
        this.logger.info?.('Step 9: Activating interface');
        const activateResponse = await activateInterface(this.connection, config.interfaceName);
        this.logger.info?.('Interface activated, status:', activateResponse.status);
        
        // Don't read after activation - object may not be ready yet
        // Return basic info without sourceCode (activation returns 201)
        return {
          interfaceName: config.interfaceName,
          packageName: config.packageName
        };
      }

      // Read and return result (no stateful needed)
      const readResponse = await getInterfaceSource(this.connection, config.interfaceName);
      const sourceCode = typeof readResponse.data === 'string'
        ? readResponse.data
        : JSON.stringify(readResponse.data);

      return {
        interfaceName: config.interfaceName,
        packageName: config.packageName,
        sourceCode
      };
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger.warn?.('Unlocking interface during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlockInterface(this.connection, config.interfaceName, lockHandle);
          this.connection.setSessionType('stateless');
        } catch (unlockError) {
          this.logger.warn?.('Failed to unlock during cleanup:', unlockError);
        }
      } else {
        // Ensure stateless if no lock was acquired
        this.connection.setSessionType('stateless');
      }

      if (objectCreated && options?.deleteOnFailure) {
        try {
          this.logger.warn?.('Deleting interface after failure');
          this.connection.setSessionType('stateful');
          await deleteInterface(this.connection, {
            interface_name: config.interfaceName,
            transport_request: config.transportRequest
          });
          this.connection.setSessionType('stateless');
        } catch (deleteError) {
          this.logger.warn?.('Failed to delete interface after failure:', deleteError);
        }
      }

      logErrorSafely(this.logger, 'Create', error);
      throw error;
    }
  }

  /**
   * Read interface
   */
  async read(
    config: Partial<InterfaceBuilderConfig>,
    version: 'active' | 'inactive' = 'active'
  ): Promise<InterfaceBuilderConfig | undefined> {
    if (!config.interfaceName) {
      throw new Error('Interface name is required');
    }

    try {
      const response = await getInterfaceSource(this.connection, config.interfaceName);
      const sourceCode = typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);

      return {
        interfaceName: config.interfaceName,
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
   * Update interface with full operation chain
   * Always starts with lock
   */
  async update(
    config: Partial<InterfaceBuilderConfig>,
    options?: UpdateOptions
  ): Promise<InterfaceBuilderConfig> {
    if (!config.interfaceName) {
      throw new Error('Interface name is required');
    }

    let lockHandle: string | undefined;

    try {
      // 1. Lock (update always starts with lock, stateful only for lock)
      this.logger.info?.('Step 1: Locking interface');
      this.connection.setSessionType('stateful');
      const lockResult = await lockInterface(this.connection, config.interfaceName);
      lockHandle = lockResult.lockHandle;
      this.logger.info?.('Interface locked, handle:', lockHandle);

      // 2. Check inactive with code for update
      if (config.sourceCode) {
        this.logger.info?.('Step 2: Checking inactive version with update content');
        await checkInterface(this.connection, config.interfaceName, 'inactive', config.sourceCode);
        this.logger.info?.('Check inactive with update content passed');
      }

      // 3. Update
      if (config.sourceCode && lockHandle) {
        this.logger.info?.('Step 3: Updating interface');
        await upload(
          this.connection,
          config.interfaceName,
          config.sourceCode,
          lockHandle,
          config.transportRequest
        );
        this.logger.info?.('Interface updated');
      }

      // 4. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger.info?.('Step 4: Unlocking interface');
        await unlockInterface(this.connection, config.interfaceName, lockHandle);
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger.info?.('Interface unlocked');
      }

      // 5. Final check (no stateful needed)
      this.logger.info?.('Step 5: Final check');
      await checkInterface(this.connection, config.interfaceName, 'inactive');
      this.logger.info?.('Final check passed');

      // 6. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnUpdate) {
        this.logger.info?.('Step 6: Activating interface');
        const activateResponse = await activateInterface(this.connection, config.interfaceName);
        this.logger.info?.('Interface activated, status:', activateResponse.status);
        
        // Don't read after activation - object may not be ready yet
        // Return basic info without sourceCode (activation returns 201)
        return {
          interfaceName: config.interfaceName
        };
      }

      // Read and return result (no stateful needed)
      const readResponse = await getInterfaceSource(this.connection, config.interfaceName);
      const sourceCode = typeof readResponse.data === 'string'
        ? readResponse.data
        : JSON.stringify(readResponse.data);

      return {
        interfaceName: config.interfaceName,
        sourceCode
      };
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger.warn?.('Unlocking interface during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlockInterface(this.connection, config.interfaceName, lockHandle);
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
          this.logger.warn?.('Deleting interface after failure');
          this.connection.setSessionType('stateful');
          await deleteInterface(this.connection, {
            interface_name: config.interfaceName,
            transport_request: config.transportRequest
          });
          this.connection.setSessionType('stateless');
        } catch (deleteError) {
          this.logger.warn?.('Failed to delete interface after failure:', deleteError);
        }
      }

      logErrorSafely(this.logger, 'Update', error);
      throw error;
    }
  }

  /**
   * Delete interface
   */
  async delete(config: Partial<InterfaceBuilderConfig>): Promise<AxiosResponse> {
    if (!config.interfaceName) {
      throw new Error('Interface name is required');
    }

    try {
      // Check for deletion (no stateful needed)
      this.logger.info?.('Checking interface for deletion');
      await checkDeletion(this.connection, {
        interface_name: config.interfaceName,
        transport_request: config.transportRequest
      });
      this.logger.info?.('Deletion check passed');

      // Delete (requires stateful, but no lock)
      this.logger.info?.('Deleting interface');
      this.connection.setSessionType('stateful');
      const result = await deleteInterface(this.connection, {
        interface_name: config.interfaceName,
        transport_request: config.transportRequest
      });
      this.logger.info?.('Interface deleted');

      return result;
    } catch (error: any) {
      logErrorSafely(this.logger, 'Delete', error);
      throw error;
    } finally {
      this.connection.setSessionType('stateless');
    }
  }

  /**
   * Activate interface
   * No stateful needed - uses same session/cookies
   */
  async activate(config: Partial<InterfaceBuilderConfig>): Promise<AxiosResponse> {
    if (!config.interfaceName) {
      throw new Error('Interface name is required');
    }

    try {
      const result = await activateInterface(this.connection, config.interfaceName);
      return result;
    } catch (error: any) {
      logErrorSafely(this.logger, 'Activate', error);
      throw error;
    }
  }

  /**
   * Check interface
   */
  async check(
    config: Partial<InterfaceBuilderConfig>,
    status?: string
  ): Promise<AxiosResponse> {
    if (!config.interfaceName) {
      throw new Error('Interface name is required');
    }

    // Map status to version
    const version: 'active' | 'inactive' = status === 'active' ? 'active' : 'inactive';
    return await checkInterface(this.connection, config.interfaceName, version, config.sourceCode);
  }
}

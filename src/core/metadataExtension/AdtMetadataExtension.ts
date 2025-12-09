/**
 * AdtMetadataExtension - High-level CRUD operations for Metadata Extension (DDLX) objects
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
import { MetadataExtensionBuilderConfig } from './types';
import { validateMetadataExtension } from './validation';
import { createMetadataExtension } from './create';
import { checkMetadataExtension } from './check';
import { lockMetadataExtension } from './lock';
import { updateMetadataExtension } from './update';
import { unlockMetadataExtension } from './unlock';
import { activateMetadataExtension } from './activate';
import { deleteMetadataExtension } from './delete';
import { readMetadataExtensionSource } from './read';

export class AdtMetadataExtension implements IAdtObject<MetadataExtensionBuilderConfig, MetadataExtensionBuilderConfig> {
  private readonly connection: IAbapConnection;
  private readonly logger: IAdtLogger;
  public readonly objectType: string = 'MetadataExtension';

  constructor(connection: IAbapConnection, logger: IAdtLogger) {
    this.connection = connection;
    this.logger = logger;
  }

  /**
   * Validate metadata extension configuration before creation
   */
  async validate(config: Partial<MetadataExtensionBuilderConfig>): Promise<AxiosResponse> {
    if (!config.name) {
      throw new Error('Metadata extension name is required for validation');
    }
    if (!config.packageName) {
      throw new Error('Package name is required for validation');
    }

    return await validateMetadataExtension(
      this.connection,
      {
        name: config.name,
        description: config.description || config.name,
        packageName: config.packageName
      }
    );
  }

  /**
   * Create metadata extension with full operation chain
   */
  async create(
    config: MetadataExtensionBuilderConfig,
    options?: IAdtOperationOptions
  ): Promise<MetadataExtensionBuilderConfig> {
    if (!config.name) {
      throw new Error('Metadata extension name is required');
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
      this.logger.info?.('Step 1: Validating metadata extension configuration');
      await validateMetadataExtension(
        this.connection,
        {
          name: config.name,
          description: config.description,
          packageName: config.packageName
        }
      );
      this.logger.info?.('Validation passed');

      // 2. Create (no stateful needed)
      this.logger.info?.('Step 2: Creating metadata extension');
      await createMetadataExtension(this.connection, {
        name: config.name,
        packageName: config.packageName,
        transportRequest: config.transportRequest,
        description: config.description,
        masterLanguage: config.masterLanguage,
        masterSystem: config.masterSystem,
        responsible: config.responsible
      });
      objectCreated = true;
      this.logger.info?.('Metadata extension created');

      // 3. Check after create (no stateful needed)
      this.logger.info?.('Step 3: Checking created metadata extension');
      await checkMetadataExtension(this.connection, config.name, 'inactive');
      this.logger.info?.('Check after create passed');

      // 4. Lock (stateful ONLY before lock)
      this.logger.info?.('Step 4: Locking metadata extension');
      this.connection.setSessionType('stateful');
      lockHandle = await lockMetadataExtension(this.connection, config.name);
      this.logger.info?.('Metadata extension locked, handle:', lockHandle);

      // 5. Check inactive with code for update (from options or config)
      const codeToCheck = options?.sourceCode || config.sourceCode;
      if (codeToCheck) {
        this.logger.info?.('Step 5: Checking inactive version with update content');
        await checkMetadataExtension(this.connection, config.name, 'inactive', codeToCheck);
        this.logger.info?.('Check inactive with update content passed');
      }

      // 6. Update
      if (codeToCheck && lockHandle) {
        this.logger.info?.('Step 6: Updating metadata extension with source code');
        await updateMetadataExtension(
          this.connection,
          config.name,
          codeToCheck,
          lockHandle
        );
        this.logger.info?.('Metadata extension updated');
      }

      // 7. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger.info?.('Step 7: Unlocking metadata extension');
        await unlockMetadataExtension(this.connection, config.name, lockHandle);
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger.info?.('Metadata extension unlocked');
      }

      // 8. Final check (no stateful needed)
      this.logger.info?.('Step 8: Final check');
      await checkMetadataExtension(this.connection, config.name, 'inactive');
      this.logger.info?.('Final check passed');

      // 9. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnCreate) {
        this.logger.info?.('Step 9: Activating metadata extension');
        const activateResponse = await activateMetadataExtension(this.connection, config.name);
        this.logger.info?.('Metadata extension activated, status:', activateResponse.status);
        
        // Don't read after activation - object may not be ready yet
        // Return basic info (activation returns 201)
        return {
          name: config.name,
          packageName: config.packageName
        };
      }

      // Read and return result (no stateful needed)
      const readResponse = await readMetadataExtensionSource(this.connection, config.name);
      const sourceCode = typeof readResponse.data === 'string'
        ? readResponse.data
        : JSON.stringify(readResponse.data);

      return {
        name: config.name,
        packageName: config.packageName,
        sourceCode
      };
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger.warn?.('Unlocking metadata extension during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlockMetadataExtension(this.connection, config.name, lockHandle);
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
          this.logger.warn?.('Deleting metadata extension after failure');
          // No stateful needed - delete doesn't use lock/unlock
          await deleteMetadataExtension(this.connection, config.name, config.transportRequest);
        } catch (deleteError) {
          this.logger.warn?.('Failed to delete metadata extension after failure:', deleteError);
        }
      }

      logErrorSafely(this.logger, 'Create', error);
      throw error;
    }
  }

  /**
   * Read metadata extension
   */
  async read(
    config: Partial<MetadataExtensionBuilderConfig>,
    version: 'active' | 'inactive' = 'active'
  ): Promise<MetadataExtensionBuilderConfig | undefined> {
    if (!config.name) {
      throw new Error('Metadata extension name is required');
    }

    try {
      const response = await readMetadataExtensionSource(this.connection, config.name, version);
      const sourceCode = typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);

      return {
        name: config.name,
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
   * Update metadata extension with full operation chain
   * Always starts with lock
   */
  async update(
    config: Partial<MetadataExtensionBuilderConfig>,
    options?: IAdtOperationOptions
  ): Promise<MetadataExtensionBuilderConfig> {
    if (!config.name) {
      throw new Error('Metadata extension name is required');
    }

    let lockHandle: string | undefined;

    try {
      // 1. Lock (update always starts with lock, stateful ONLY before lock)
      this.logger.info?.('Step 1: Locking metadata extension');
      this.connection.setSessionType('stateful');
      lockHandle = await lockMetadataExtension(this.connection, config.name);
      this.logger.info?.('Metadata extension locked, handle:', lockHandle);

      // 2. Check inactive with code for update (from options or config)
      const codeToCheck = options?.sourceCode || config.sourceCode;
      if (codeToCheck) {
        this.logger.info?.('Step 2: Checking inactive version with update content');
        await checkMetadataExtension(this.connection, config.name, 'inactive', codeToCheck);
        this.logger.info?.('Check inactive with update content passed');
      }

      // 3. Update
      if (codeToCheck && lockHandle) {
        this.logger.info?.('Step 3: Updating metadata extension');
        await updateMetadataExtension(
          this.connection,
          config.name,
          codeToCheck,
          lockHandle
        );
        this.logger.info?.('Metadata extension updated');
      }

      // 4. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger.info?.('Step 4: Unlocking metadata extension');
        await unlockMetadataExtension(this.connection, config.name, lockHandle);
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger.info?.('Metadata extension unlocked');
      }

      // 5. Final check (no stateful needed)
      this.logger.info?.('Step 5: Final check');
      await checkMetadataExtension(this.connection, config.name, 'inactive');
      this.logger.info?.('Final check passed');

      // 6. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnUpdate) {
        this.logger.info?.('Step 6: Activating metadata extension');
        const activateResponse = await activateMetadataExtension(this.connection, config.name);
        this.logger.info?.('Metadata extension activated, status:', activateResponse.status);
        
        // Don't read after activation - object may not be ready yet
        // Return basic info (activation returns 201)
        return {
          name: config.name
        };
      }

      // Read and return result (no stateful needed)
      const readResponse = await readMetadataExtensionSource(this.connection, config.name);
      const sourceCode = typeof readResponse.data === 'string'
        ? readResponse.data
        : JSON.stringify(readResponse.data);

      return {
        name: config.name,
        sourceCode
      };
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger.warn?.('Unlocking metadata extension during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlockMetadataExtension(this.connection, config.name, lockHandle);
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
          this.logger.warn?.('Deleting metadata extension after failure');
          // No stateful needed - delete doesn't use lock/unlock
          await deleteMetadataExtension(this.connection, config.name, config.transportRequest);
        } catch (deleteError) {
          this.logger.warn?.('Failed to delete metadata extension after failure:', deleteError);
        }
      }

      logErrorSafely(this.logger, 'Update', error);
      throw error;
    }
  }

  /**
   * Delete metadata extension
   */
  async delete(config: Partial<MetadataExtensionBuilderConfig>): Promise<AxiosResponse> {
    if (!config.name) {
      throw new Error('Metadata extension name is required');
    }

    try {
      // Delete (no stateful needed - no lock/unlock, no deletion check for metadata extensions)
      this.logger.info?.('Deleting metadata extension');
      const result = await deleteMetadataExtension(this.connection, config.name, config.transportRequest);
      this.logger.info?.('Metadata extension deleted');

      return result;
    } catch (error: any) {
      logErrorSafely(this.logger, 'Delete', error);
      throw error;
    }
  }

  /**
   * Activate metadata extension
   * No stateful needed - uses same session/cookies
   */
  async activate(config: Partial<MetadataExtensionBuilderConfig>): Promise<AxiosResponse> {
    if (!config.name) {
      throw new Error('Metadata extension name is required');
    }

    try {
      const result = await activateMetadataExtension(this.connection, config.name);
      return result;
    } catch (error: any) {
      logErrorSafely(this.logger, 'Activate', error);
      throw error;
    }
  }

  /**
   * Check metadata extension
   */
  async check(
    config: Partial<MetadataExtensionBuilderConfig>,
    status?: string
  ): Promise<AxiosResponse> {
    if (!config.name) {
      throw new Error('Metadata extension name is required');
    }

    // Map status to version
    const version: 'active' | 'inactive' = status === 'active' ? 'active' : 'inactive';
    return await checkMetadataExtension(this.connection, config.name, version);
  }
}

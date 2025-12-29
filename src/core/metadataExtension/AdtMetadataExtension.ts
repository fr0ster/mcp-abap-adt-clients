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

import type {
  IAbapConnection,
  IAdtObject,
  IAdtOperationOptions,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IReadOptions } from '../shared/types';
import { activateMetadataExtension } from './activate';
import { checkMetadataExtension } from './check';
import { createMetadataExtension } from './create';
import { deleteMetadataExtension } from './delete';
import { lockMetadataExtension } from './lock';
import {
  getMetadataExtensionTransport,
  readMetadataExtension,
  readMetadataExtensionSource,
} from './read';
import type {
  IMetadataExtensionConfig,
  IMetadataExtensionState,
} from './types';
import { unlockMetadataExtension } from './unlock';
import { updateMetadataExtension } from './update';
import { validateMetadataExtension } from './validation';

export class AdtMetadataExtension
  implements IAdtObject<IMetadataExtensionConfig, IMetadataExtensionState>
{
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  public readonly objectType: string = 'MetadataExtension';

  constructor(connection: IAbapConnection, logger?: ILogger) {
    this.connection = connection;
    this.logger = logger;
  }

  /**
   * Validate metadata extension configuration before creation
   */
  async validate(
    config: Partial<IMetadataExtensionConfig>,
  ): Promise<IMetadataExtensionState> {
    const state: IMetadataExtensionState = { errors: [] };
    if (!config.name) {
      const error = new Error(
        'Metadata extension name is required for validation',
      );
      state.errors.push({ method: 'validate', error, timestamp: new Date() });
      throw error;
    }
    if (!config.packageName) {
      const error = new Error('Package name is required for validation');
      state.errors.push({ method: 'validate', error, timestamp: new Date() });
      throw error;
    }

    const response = await validateMetadataExtension(this.connection, {
      name: config.name,
      description: config.description || config.name,
      packageName: config.packageName,
    });
    state.validationResponse = response;
    return state;
  }

  /**
   * Create metadata extension with full operation chain
   */
  async create(
    config: IMetadataExtensionConfig,
    _options?: IAdtOperationOptions,
  ): Promise<IMetadataExtensionState> {
    const state: IMetadataExtensionState = { errors: [] };
    if (!config.name) {
      const error = new Error('Metadata extension name is required');
      state.errors.push({ method: 'create', error, timestamp: new Date() });
      throw error;
    }
    if (!config.packageName) {
      const error = new Error('Package name is required');
      state.errors.push({ method: 'create', error, timestamp: new Date() });
      throw error;
    }
    if (!config.description) {
      const error = new Error('Description is required');
      state.errors.push({ method: 'create', error, timestamp: new Date() });
      throw error;
    }

    try {
      // Create metadata extension
      this.logger?.info?.('Creating metadata extension');
      const createResponse = await createMetadataExtension(this.connection, {
        name: config.name,
        packageName: config.packageName,
        transportRequest: config.transportRequest,
        description: config.description,
        masterLanguage: config.masterLanguage,
        masterSystem: config.masterSystem,
        responsible: config.responsible,
      });
      state.createResult = createResponse;
      this.logger?.info?.('Metadata extension created');

      return state;
    } catch (error: any) {
      this.logger?.error('Create failed:', error);
      throw error;
    }
  }

  /**
   * Read metadata extension
   */
  async read(
    config: Partial<IMetadataExtensionConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions,
  ): Promise<IMetadataExtensionState | undefined> {
    const state: IMetadataExtensionState = { errors: [] };
    if (!config.name) {
      const error = new Error('Metadata extension name is required');
      state.errors.push({ method: 'read', error, timestamp: new Date() });
      throw error;
    }

    try {
      const response = await readMetadataExtensionSource(
        this.connection,
        config.name,
        version,
        options,
        this.logger,
      );
      const _sourceCode =
        typeof response.data === 'string'
          ? response.data
          : JSON.stringify(response.data);

      return {
        readResult: response,
        errors: [],
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return state;
      }
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({ method: 'read', error: err, timestamp: new Date() });
      this.logger?.error('read', err);
      throw err;
    }
  }

  /**
   * Read metadata extension metadata (object characteristics: package, responsible, description, etc.)
   */
  async readMetadata(
    config: Partial<IMetadataExtensionConfig>,
    options?: IReadOptions,
  ): Promise<IMetadataExtensionState> {
    const state: IMetadataExtensionState = { errors: [] };
    if (!config.name) {
      const error = new Error('Metadata extension name is required');
      state.errors.push({
        method: 'readMetadata',
        error,
        timestamp: new Date(),
      });
      throw error;
    }
    try {
      const response = await readMetadataExtension(
        this.connection,
        config.name,
        options,
        this.logger,
      );
      state.metadataResult = response;
      this.logger?.info?.('Metadata extension metadata read successfully');
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
   * Read transport request information for the metadata extension
   */
  async readTransport(
    config: Partial<IMetadataExtensionConfig>,
    options?: { withLongPolling?: boolean },
  ): Promise<IMetadataExtensionState> {
    const state: IMetadataExtensionState = { errors: [] };
    if (!config.name) {
      const error = new Error('Metadata extension name is required');
      state.errors.push({
        method: 'readTransport',
        error,
        timestamp: new Date(),
      });
      throw error;
    }
    try {
      const response = await getMetadataExtensionTransport(
        this.connection,
        config.name,
        options?.withLongPolling !== undefined
          ? { withLongPolling: options.withLongPolling }
          : undefined,
      );
      state.transportResult = response;
      this.logger?.info?.(
        'Metadata extension transport request read successfully',
      );
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
   * Update metadata extension with full operation chain
   * Always starts with lock
   * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
   */
  async update(
    config: Partial<IMetadataExtensionConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IMetadataExtensionState> {
    const state: IMetadataExtensionState = { errors: [] };
    if (!config.name) {
      const error = new Error('Metadata extension name is required');
      state.errors.push({ method: 'update', error, timestamp: new Date() });
      throw error;
    }

    // Low-level mode: if lockHandle is provided, perform only update operation
    if (options?.lockHandle) {
      const codeToUpdate = options?.sourceCode || config.sourceCode;
      if (!codeToUpdate) {
        throw new Error('Source code is required for update');
      }

      this.logger?.info?.(
        'Low-level update: performing update only (lockHandle provided)',
      );
      const updateResponse = await updateMetadataExtension(
        this.connection,
        config.name,
        codeToUpdate,
        options.lockHandle,
      );
      this.logger?.info?.('Metadata extension updated (low-level)');
      return {
        updateResult: updateResponse,
        errors: [],
      };
    }

    let lockHandle: string | undefined;

    try {
      // 1. Lock (update always starts with lock, stateful ONLY before lock)
      this.logger?.info?.('Step 1: Locking metadata extension');
      this.connection.setSessionType('stateful');
      lockHandle = await lockMetadataExtension(this.connection, config.name);
      this.logger?.info?.('Metadata extension locked, handle:', lockHandle);

      // 2. Check inactive with code for update (from options or config)
      const codeToCheck = options?.sourceCode || config.sourceCode;
      if (codeToCheck) {
        this.logger?.info?.(
          'Step 2: Checking inactive version with update content',
        );
        await checkMetadataExtension(
          this.connection,
          config.name,
          'inactive',
          codeToCheck,
        );
        this.logger?.info?.('Check inactive with update content passed');
      }

      // 3. Update
      if (codeToCheck && lockHandle) {
        this.logger?.info?.('Step 3: Updating metadata extension');
        await updateMetadataExtension(
          this.connection,
          config.name,
          codeToCheck,
          lockHandle,
        );
        this.logger?.info?.('Metadata extension updated');

        // 3.5. Read with long polling (wait for object to be ready after update)
        this.logger?.info?.('read (wait for object ready after update)');
        try {
          await this.read({ name: config.name }, 'active', {
            withLongPolling: true,
          });
          this.logger?.info?.('object is ready after update');
        } catch (readError) {
          this.logger?.warn?.(
            'read with long polling failed (object may not be ready yet):',
            readError,
          );
          // Continue anyway - unlock might still work
        }
      }

      // 4. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger?.info?.('Step 4: Unlocking metadata extension');
        await unlockMetadataExtension(this.connection, config.name, lockHandle);
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger?.info?.('Metadata extension unlocked');
      }

      // 5. Final check (no stateful needed)
      this.logger?.info?.('Step 5: Final check');
      await checkMetadataExtension(this.connection, config.name, 'inactive');
      this.logger?.info?.('Final check passed');

      // 6. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 6: Activating metadata extension');
        const activateResponse = await activateMetadataExtension(
          this.connection,
          config.name,
        );
        this.logger?.info?.(
          'Metadata extension activated, status:',
          activateResponse.status,
        );

        // 6.5. Read with long polling (wait for object to be ready after activation)
        this.logger?.info?.('read (wait for object ready after activation)');
        try {
          await this.read({ name: config.name }, 'active', {
            withLongPolling: true,
          });
          this.logger?.info?.('object is ready after activation');
        } catch (readError) {
          this.logger?.warn?.(
            'read with long polling failed (object may not be ready yet):',
            readError,
          );
          // Continue anyway - return activation response
        }

        return {
          activateResult: activateResponse,
          errors: [],
        };
      }

      // Read and return result (no stateful needed)
      const readResponse = await readMetadataExtensionSource(
        this.connection,
        config.name,
      );
      const _sourceCode =
        typeof readResponse.data === 'string'
          ? readResponse.data
          : JSON.stringify(readResponse.data);

      return {
        readResult: readResponse,
        errors: [],
      };
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger?.warn?.(
            'Unlocking metadata extension during error cleanup',
          );
          // We're already in stateful after lock, just unlock and set stateless
          await unlockMetadataExtension(
            this.connection,
            config.name,
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
          this.logger?.warn?.('Deleting metadata extension after failure');
          // No stateful needed - delete doesn't use lock/unlock
          await deleteMetadataExtension(
            this.connection,
            config.name,
            config.transportRequest,
          );
        } catch (deleteError) {
          this.logger?.warn?.(
            'Failed to delete metadata extension after failure:',
            deleteError,
          );
        }
      }

      this.logger?.error('Update failed:', error);
      throw error;
    }
  }

  /**
   * Delete metadata extension
   */
  async delete(
    config: Partial<IMetadataExtensionConfig>,
  ): Promise<IMetadataExtensionState> {
    const state: IMetadataExtensionState = { errors: [] };
    if (!config.name) {
      const error = new Error('Metadata extension name is required');
      state.errors.push({ method: 'delete', error, timestamp: new Date() });
      throw error;
    }

    try {
      // Delete (no stateful needed - no lock/unlock, no deletion check for metadata extensions)
      this.logger?.info?.('Deleting metadata extension');
      const result = await deleteMetadataExtension(
        this.connection,
        config.name,
        config.transportRequest,
      );
      this.logger?.info?.('Metadata extension deleted');

      return {
        deleteResult: result,
        errors: [],
      };
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({
        method: 'delete',
        error: err,
        timestamp: new Date(),
      });
      this.logger?.error('Delete', err);
      throw err;
    }
  }

  /**
   * Activate metadata extension
   * No stateful needed - uses same session/cookies
   */
  async activate(
    config: Partial<IMetadataExtensionConfig>,
  ): Promise<IMetadataExtensionState> {
    const state: IMetadataExtensionState = { errors: [] };
    if (!config.name) {
      const error = new Error('Metadata extension name is required');
      state.errors.push({ method: 'activate', error, timestamp: new Date() });
      throw error;
    }

    try {
      const result = await activateMetadataExtension(
        this.connection,
        config.name,
      );
      return {
        activateResult: result,
        errors: [],
      };
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({
        method: 'activate',
        error: err,
        timestamp: new Date(),
      });
      this.logger?.error('Activate', err);
      throw err;
    }
  }

  /**
   * Check metadata extension
   */
  async check(
    config: Partial<IMetadataExtensionConfig>,
    status?: string,
  ): Promise<IMetadataExtensionState> {
    const state: IMetadataExtensionState = { errors: [] };
    if (!config.name) {
      const error = new Error('Metadata extension name is required');
      state.errors.push({ method: 'check', error, timestamp: new Date() });
      throw error;
    }

    // Map status to version
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';
    const result = await checkMetadataExtension(
      this.connection,
      config.name,
      version,
    );
    state.checkResult = result;
    return state;
  }

  /**
   * Lock metadata extension for modification
   */
  async lock(config: Partial<IMetadataExtensionConfig>): Promise<string> {
    if (!config.name) {
      throw new Error('Metadata extension name is required');
    }

    this.connection.setSessionType('stateful');
    return await lockMetadataExtension(this.connection, config.name);
  }

  /**
   * Unlock metadata extension
   */
  async unlock(
    config: Partial<IMetadataExtensionConfig>,
    lockHandle: string,
  ): Promise<IMetadataExtensionState> {
    if (!config.name) {
      throw new Error('Metadata extension name is required');
    }

    const result = await unlockMetadataExtension(
      this.connection,
      config.name,
      lockHandle,
    );
    this.connection.setSessionType('stateless');
    return {
      unlockResult: result,
      errors: [],
    };
  }
}

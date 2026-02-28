/**
 * AdtEnhancement - High-level CRUD operations for Enhancement objects
 *
 * Implements IAdtObject interface with automatic operation chains,
 * error handling, and resource cleanup.
 *
 * Uses low-level functions directly (not Builder classes).
 *
 * Supports multiple enhancement types:
 * - enhoxh: Enhancement Implementation (ENHO)
 * - enhoxhb: BAdI Implementation
 * - enhoxhh: Source Code Plugin (has source code)
 * - enhsxs: Enhancement Spot (ENHS)
 * - enhsxsb: BAdI Enhancement Spot
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
import { activateEnhancement } from './activation';
import { check as checkEnhancement } from './check';
import { create as createEnhancement } from './create';
import { checkDeletion, deleteEnhancement } from './delete';
import { lockEnhancement } from './lock';
import {
  getEnhancementMetadata,
  getEnhancementSource,
  getEnhancementTransport,
} from './read';
import {
  type IEnhancementConfig,
  type IEnhancementState,
  supportsSourceCode,
} from './types';
import { unlockEnhancement } from './unlock';
import { update } from './update';
import { validate } from './validation';

export class AdtEnhancement
  implements IAdtObject<IEnhancementConfig, IEnhancementState>
{
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  private readonly systemContext: IAdtSystemContext;
  public readonly objectType: string = 'Enhancement';

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
  }

  /**
   * Validate enhancement configuration before creation
   */
  async validate(
    config: Partial<IEnhancementConfig>,
  ): Promise<IEnhancementState> {
    const state: IEnhancementState = { errors: [] };

    if (!config.enhancementName) {
      const error = new Error('Enhancement name is required for validation');
      state.errors.push({ method: 'validate', error, timestamp: new Date() });
      throw error;
    }
    if (!config.enhancementType) {
      const error = new Error('Enhancement type is required for validation');
      state.errors.push({ method: 'validate', error, timestamp: new Date() });
      throw error;
    }

    try {
      const response = await validate(
        this.connection,
        config.enhancementType,
        config.enhancementName,
        config.packageName,
        config.description,
      );
      state.validationResponse = response;
      state.enhancementType = config.enhancementType;
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({
        method: 'validate',
        error: err,
        timestamp: new Date(),
      });
      this.logger?.error('Validate failed:', err);
      throw err;
    }
  }

  /**
   * Create enhancement with full operation chain
   */
  async create(
    config: IEnhancementConfig,
    options?: IAdtOperationOptions,
  ): Promise<IEnhancementState> {
    const state: IEnhancementState = {
      errors: [],
      enhancementType: config.enhancementType,
    };

    if (!config.enhancementName) {
      throw new Error('Enhancement name is required');
    }
    if (!config.enhancementType) {
      throw new Error('Enhancement type is required');
    }
    if (!config.packageName) {
      throw new Error('Package name is required');
    }

    let objectCreated = false;

    try {
      // Create enhancement
      this.logger?.info?.('Creating enhancement');
      const createResponse = await createEnhancement(
        this.connection,
        {
          enhancement_name: config.enhancementName,
          enhancement_type: config.enhancementType,
          package_name: config.packageName,
          description: config.description,
          transport_request: config.transportRequest,
          enhancement_spot: config.enhancementSpot,
          badi_definition: config.badiDefinition,
          masterSystem: this.systemContext.masterSystem,
          responsible: this.systemContext.responsible,
        },
        this.logger,
      );
      state.createResult = createResponse;
      objectCreated = true;
      this.logger?.info?.('Enhancement created');

      return state;
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({
        method: 'create',
        error: err,
        timestamp: new Date(),
      });

      // Cleanup on error - ensure stateless
      this.connection.setSessionType('stateless');

      if (objectCreated && options?.deleteOnFailure) {
        try {
          this.logger?.warn?.('Deleting enhancement after failure');
          await deleteEnhancement(this.connection, {
            enhancement_name: config.enhancementName,
            enhancement_type: config.enhancementType,
            transport_request: config.transportRequest,
          });
        } catch (deleteError) {
          this.logger?.warn?.(
            'Failed to delete enhancement after failure:',
            deleteError,
          );
        }
      }

      this.logger?.error('Create failed:', err);
      throw err;
    }
  }

  /**
   * Read enhancement
   */
  async read(
    config: Partial<IEnhancementConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions,
  ): Promise<IEnhancementState | undefined> {
    const state: IEnhancementState = {
      errors: [],
      enhancementType: config.enhancementType,
    };

    if (!config.enhancementName) {
      const error = new Error('Enhancement name is required');
      state.errors.push({ method: 'read', error, timestamp: new Date() });
      throw error;
    }
    if (!config.enhancementType) {
      const error = new Error('Enhancement type is required');
      state.errors.push({ method: 'read', error, timestamp: new Date() });
      throw error;
    }

    try {
      // For enhoxhh, read source code; for others, read metadata
      if (supportsSourceCode(config.enhancementType)) {
        const response = await getEnhancementSource(
          this.connection,
          config.enhancementType,
          config.enhancementName,
          version,
          options,
          this.logger,
        );
        state.readResult = response;
        state.sourceCode = response.data;
      } else {
        const response = await getEnhancementMetadata(
          this.connection,
          config.enhancementType,
          config.enhancementName,
          options,
          this.logger,
        );
        state.readResult = response;
      }
      return state;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return undefined;
      }
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({ method: 'read', error: err, timestamp: new Date() });
      this.logger?.error('Read failed:', err);
      throw err;
    }
  }

  /**
   * Read enhancement metadata (object characteristics: package, responsible, description, etc.)
   */
  async readMetadata(
    config: Partial<IEnhancementConfig>,
    options?: IReadOptions,
  ): Promise<IEnhancementState> {
    const state: IEnhancementState = {
      errors: [],
      enhancementType: config.enhancementType,
    };

    if (!config.enhancementName) {
      const error = new Error('Enhancement name is required');
      state.errors.push({
        method: 'readMetadata',
        error,
        timestamp: new Date(),
      });
      throw error;
    }
    if (!config.enhancementType) {
      const error = new Error('Enhancement type is required');
      state.errors.push({
        method: 'readMetadata',
        error,
        timestamp: new Date(),
      });
      throw error;
    }

    try {
      const response = await getEnhancementMetadata(
        this.connection,
        config.enhancementType,
        config.enhancementName,
        options,
        this.logger,
      );
      state.metadataResult = response;
      this.logger?.info?.('Enhancement metadata read successfully');
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({
        method: 'readMetadata',
        error: err,
        timestamp: new Date(),
      });
      this.logger?.error('Read metadata failed:', err);
      throw err;
    }
  }

  /**
   * Read transport request information for the enhancement
   */
  async readTransport(
    config: Partial<IEnhancementConfig>,
    options?: { withLongPolling?: boolean },
  ): Promise<IEnhancementState> {
    const state: IEnhancementState = {
      errors: [],
      enhancementType: config.enhancementType,
    };

    if (!config.enhancementName) {
      const error = new Error('Enhancement name is required');
      state.errors.push({
        method: 'readTransport',
        error,
        timestamp: new Date(),
      });
      throw error;
    }
    if (!config.enhancementType) {
      const error = new Error('Enhancement type is required');
      state.errors.push({
        method: 'readTransport',
        error,
        timestamp: new Date(),
      });
      throw error;
    }

    try {
      const response = await getEnhancementTransport(
        this.connection,
        config.enhancementType,
        config.enhancementName,
        options,
      );
      state.transportResult = response;
      this.logger?.info?.('Enhancement transport request read successfully');
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({
        method: 'readTransport',
        error: err,
        timestamp: new Date(),
      });
      this.logger?.error('Read transport failed:', err);
      throw err;
    }
  }

  /**
   * Update enhancement with full operation chain
   * Always starts with lock
   * Only available for enhoxhh (Source Code Plugin) type
   * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
   */
  async update(
    config: Partial<IEnhancementConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IEnhancementState> {
    const state: IEnhancementState = {
      errors: [],
      enhancementType: config.enhancementType,
    };

    if (!config.enhancementName) {
      const error = new Error('Enhancement name is required');
      state.errors.push({ method: 'update', error, timestamp: new Date() });
      throw error;
    }
    if (!config.enhancementType) {
      const error = new Error('Enhancement type is required');
      state.errors.push({ method: 'update', error, timestamp: new Date() });
      throw error;
    }

    if (!supportsSourceCode(config.enhancementType)) {
      const error = new Error(
        `Enhancement type '${config.enhancementType}' does not support source code update. Only 'enhoxhh' supports source code.`,
      );
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
      const updateResponse = await update(
        this.connection,
        {
          enhancement_name: config.enhancementName,
          enhancement_type: config.enhancementType,
          source_code: codeToUpdate,
          lock_handle: options.lockHandle,
          transport_request: config.transportRequest,
        },
        this.logger,
      );
      this.logger?.info?.('Enhancement updated (low-level)');
      return {
        updateResult: updateResponse,
        errors: [],
        enhancementType: config.enhancementType,
      };
    }

    let lockHandle: string | undefined;

    try {
      // 1. Lock (update always starts with lock, stateful ONLY before lock)
      this.logger?.info?.('Step 1: Locking enhancement');
      this.connection.setSessionType('stateful');
      lockHandle = await lockEnhancement(
        this.connection,
        config.enhancementType,
        config.enhancementName,
      );
      state.lockHandle = lockHandle;
      this.logger?.info?.('Enhancement locked, handle:', lockHandle);

      // 2. Check inactive with code for update (from options or config)
      const codeToCheck = options?.sourceCode || config.sourceCode;
      if (codeToCheck) {
        this.logger?.info?.(
          'Step 2: Checking inactive version with update content',
        );
        const checkInactiveResponse = await checkEnhancement(
          this.connection,
          config.enhancementType,
          config.enhancementName,
          'inactive',
          codeToCheck,
        );
        state.checkResult = checkInactiveResponse;
        this.logger?.info?.('Check inactive with update content passed');
      }

      // 3. Update
      if (codeToCheck && lockHandle) {
        this.logger?.info?.('Step 3: Updating enhancement');
        const updateResponse = await update(
          this.connection,
          {
            enhancement_name: config.enhancementName,
            enhancement_type: config.enhancementType,
            source_code: codeToCheck,
            lock_handle: lockHandle,
            transport_request: config.transportRequest,
          },
          this.logger,
        );
        state.updateResult = updateResponse;
        this.logger?.info?.('Enhancement updated');

        // 3.5. Read with long polling (wait for object to be ready after update)
        this.logger?.info?.('read (wait for object ready after update)');
        try {
          await this.read(
            {
              enhancementName: config.enhancementName,
              enhancementType: config.enhancementType,
            },
            'active',
            { withLongPolling: true },
          );
          this.logger?.info?.('object is ready after update');
        } catch (readError) {
          this.logger?.warn?.(
            'read with long polling failed (object may not be ready yet):',
            readError,
          );
        }
      }

      // 4. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger?.info?.('Step 4: Unlocking enhancement');
        const unlockResponse = await unlockEnhancement(
          this.connection,
          config.enhancementType,
          config.enhancementName,
          lockHandle,
        );
        state.unlockResult = unlockResponse;
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger?.info?.('Enhancement unlocked');
      }

      // 5. Final check (no stateful needed)
      this.logger?.info?.('Step 5: Final check');
      const finalCheckResponse = await checkEnhancement(
        this.connection,
        config.enhancementType,
        config.enhancementName,
        'inactive',
      );
      state.checkResult = finalCheckResponse;
      this.logger?.info?.('Final check passed');

      // 6. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 6: Activating enhancement');
        const activateResponse = await activateEnhancement(
          this.connection,
          config.enhancementType,
          config.enhancementName,
        );
        state.activateResult = activateResponse;
        this.logger?.info?.(
          'Enhancement activated, status:',
          activateResponse.status,
        );

        // 6.5. Read with long polling (wait for object to be ready after activation)
        this.logger?.info?.('read (wait for object ready after activation)');
        try {
          await this.read(
            {
              enhancementName: config.enhancementName,
              enhancementType: config.enhancementType,
            },
            'active',
            { withLongPolling: true },
          );
          this.logger?.info?.('object is ready after activation');
        } catch (readError) {
          this.logger?.warn?.(
            'read with long polling failed (object may not be ready yet):',
            readError,
          );
        }

        return state;
      }

      // Read and return result (no stateful needed)
      const readResponse = await getEnhancementSource(
        this.connection,
        config.enhancementType,
        config.enhancementName,
      );
      state.readResult = readResponse;

      return state;
    } catch (error: any) {
      // Cleanup on error - unlock if locked
      if (lockHandle && config.enhancementType && config.enhancementName) {
        try {
          this.logger?.warn?.('Unlocking enhancement during error cleanup');
          await unlockEnhancement(
            this.connection,
            config.enhancementType,
            config.enhancementName,
            lockHandle,
          );
          this.connection.setSessionType('stateless');
        } catch (unlockError) {
          this.logger?.warn?.('Failed to unlock during cleanup:', unlockError);
        }
      } else {
        this.connection.setSessionType('stateless');
      }

      if (
        options?.deleteOnFailure &&
        config.enhancementName &&
        config.enhancementType
      ) {
        try {
          this.logger?.warn?.('Deleting enhancement after failure');
          await deleteEnhancement(this.connection, {
            enhancement_name: config.enhancementName,
            enhancement_type: config.enhancementType,
            transport_request: config.transportRequest,
          });
        } catch (deleteError) {
          this.logger?.warn?.(
            'Failed to delete enhancement after failure:',
            deleteError,
          );
        }
      }

      this.logger?.error('Update failed:', error);
      throw error;
    }
  }

  /**
   * Delete enhancement
   */
  async delete(
    config: Partial<IEnhancementConfig>,
  ): Promise<IEnhancementState> {
    const state: IEnhancementState = {
      errors: [],
      enhancementType: config.enhancementType,
    };

    if (!config.enhancementName) {
      const error = new Error('Enhancement name is required');
      state.errors.push({ method: 'delete', error, timestamp: new Date() });
      throw error;
    }
    if (!config.enhancementType) {
      const error = new Error('Enhancement type is required');
      state.errors.push({ method: 'delete', error, timestamp: new Date() });
      throw error;
    }

    try {
      // Check for deletion (no stateful needed)
      this.logger?.info?.('Checking enhancement for deletion');
      await checkDeletion(this.connection, {
        enhancement_name: config.enhancementName,
        enhancement_type: config.enhancementType,
      });
      this.logger?.info?.('Deletion check passed');

      // Delete (no stateful needed - no lock/unlock)
      this.logger?.info?.('Deleting enhancement');
      const result = await deleteEnhancement(this.connection, {
        enhancement_name: config.enhancementName,
        enhancement_type: config.enhancementType,
        transport_request: config.transportRequest,
      });
      state.deleteResult = result;
      this.logger?.info?.('Enhancement deleted');

      return state;
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({
        method: 'delete',
        error: err,
        timestamp: new Date(),
      });
      this.logger?.error('Delete failed:', err);
      throw err;
    }
  }

  /**
   * Activate enhancement
   * No stateful needed - uses same session/cookies
   */
  async activate(
    config: Partial<IEnhancementConfig>,
  ): Promise<IEnhancementState> {
    const state: IEnhancementState = {
      errors: [],
      enhancementType: config.enhancementType,
    };

    if (!config.enhancementName) {
      const error = new Error('Enhancement name is required');
      state.errors.push({ method: 'activate', error, timestamp: new Date() });
      throw error;
    }
    if (!config.enhancementType) {
      const error = new Error('Enhancement type is required');
      state.errors.push({ method: 'activate', error, timestamp: new Date() });
      throw error;
    }

    try {
      const result = await activateEnhancement(
        this.connection,
        config.enhancementType,
        config.enhancementName,
      );
      state.activateResult = result;
      return state;
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({
        method: 'activate',
        error: err,
        timestamp: new Date(),
      });
      this.logger?.error('Activate failed:', err);
      throw err;
    }
  }

  /**
   * Check enhancement
   */
  async check(
    config: Partial<IEnhancementConfig>,
    status?: string,
  ): Promise<IEnhancementState> {
    const state: IEnhancementState = {
      errors: [],
      enhancementType: config.enhancementType,
    };

    if (!config.enhancementName) {
      const error = new Error('Enhancement name is required');
      state.errors.push({ method: 'check', error, timestamp: new Date() });
      throw error;
    }
    if (!config.enhancementType) {
      const error = new Error('Enhancement type is required');
      state.errors.push({ method: 'check', error, timestamp: new Date() });
      throw error;
    }

    try {
      const version: 'active' | 'inactive' =
        status === 'active' ? 'active' : 'inactive';
      const response = await checkEnhancement(
        this.connection,
        config.enhancementType,
        config.enhancementName,
        version,
      );
      state.checkResult = response;
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({ method: 'check', error: err, timestamp: new Date() });
      this.logger?.error('Check failed:', err);
      throw err;
    }
  }

  /**
   * Lock enhancement for modification
   */
  async lock(config: Partial<IEnhancementConfig>): Promise<string> {
    if (!config.enhancementName || !config.enhancementType) {
      throw new Error('Enhancement name and type are required');
    }

    this.connection.setSessionType('stateful');
    return await lockEnhancement(
      this.connection,
      config.enhancementType,
      config.enhancementName,
    );
  }

  /**
   * Unlock enhancement
   */
  async unlock(
    config: Partial<IEnhancementConfig>,
    lockHandle: string,
  ): Promise<IEnhancementState> {
    if (!config.enhancementName || !config.enhancementType) {
      throw new Error('Enhancement name and type are required');
    }

    const result = await unlockEnhancement(
      this.connection,
      config.enhancementType,
      config.enhancementName,
      lockHandle,
    );
    this.connection.setSessionType('stateless');
    return {
      unlockResult: result,
      errors: [],
      enhancementType: config.enhancementType,
    };
  }
}

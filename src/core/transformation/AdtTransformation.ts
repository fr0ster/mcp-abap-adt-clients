/**
 * AdtTransformation - High-level CRUD operations for XSLT Transformation objects
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
 * - Create: validate → create → (return state, no auto source update)
 * - Update: lock → check(inactive with source) → update → read(longPolling) → unlock → check → activate(optional)
 * - Delete: check(deletion) → delete
 */

import type {
  HttpError,
  IAbapConnection,
  IAdtObject,
  IAdtOperationOptions,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IAdtSystemContext } from '../../clients/AdtClient';
import { safeErrorMessage } from '../../utils/internalUtils';
import type { IReadOptions } from '../shared/types';
import { activateTransformation } from './activation';
import { checkTransformation } from './check';
import { create as createTransformation } from './create';
import { checkDeletion, deleteTransformation } from './delete';
import { lockTransformation } from './lock';
import {
  getTransformation,
  getTransformationSource,
  getTransformationTransport,
} from './read';
import type { ITransformationConfig, ITransformationState } from './types';
import { unlockTransformation } from './unlock';
import { updateTransformation } from './update';
import { validateTransformationName } from './validation';

export class AdtTransformation
  implements IAdtObject<ITransformationConfig, ITransformationState>
{
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  private readonly systemContext: IAdtSystemContext;
  public readonly objectType: string = 'Transformation';

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
   * Validate transformation configuration before creation
   */
  async validate(
    config: Partial<ITransformationConfig>,
  ): Promise<ITransformationState> {
    const state: ITransformationState = { errors: [] };
    if (!config.transformationName) {
      const error = new Error('Transformation name is required for validation');
      state.errors.push({ method: 'validate', error, timestamp: new Date() });
      throw error;
    }

    try {
      const response = await validateTransformationName(
        this.connection,
        config.transformationName,
        config.packageName,
        config.description,
      );
      state.validationResponse = response;
      return state;
    } catch (error) {
      // Validation endpoint may not exist on all systems (e.g. cloud trial)
      const e = error as HttpError;
      if (e.response?.status === 404) {
        this.logger?.warn?.(
          'Validation endpoint not available, skipping validation',
        );
        state.validationResponse = { status: 200, data: '' } as any;
        return state;
      }
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({
        method: 'validate',
        error: err,
        timestamp: new Date(),
      });
      this.logger?.error('validate', safeErrorMessage(err));
      throw err;
    }
  }

  /**
   * Create transformation with full operation chain
   */
  async create(
    config: ITransformationConfig,
    _options?: IAdtOperationOptions,
  ): Promise<ITransformationState> {
    const state: ITransformationState = { errors: [] };
    if (!config.transformationName) {
      const error = new Error('Transformation name is required');
      state.errors.push({ method: 'create', error, timestamp: new Date() });
      throw error;
    }
    if (!config.packageName) {
      throw new Error('Package name is required');
    }
    if (!config.description) {
      throw new Error('Description is required');
    }
    if (!config.transformationType) {
      throw new Error('Transformation type is required');
    }

    try {
      // Create transformation
      this.logger?.info?.('Creating transformation');
      const createResponse = await createTransformation(this.connection, {
        transformation_name: config.transformationName,
        transformation_type: config.transformationType,
        package_name: config.packageName,
        transport_request: config.transportRequest,
        description: config.description,
        masterSystem: this.systemContext.masterSystem,
        responsible: this.systemContext.responsible,
      });
      state.createResult = createResponse;
      this.logger?.info?.('Transformation created');

      return state;
    } catch (error: unknown) {
      this.logger?.error('Create failed:', safeErrorMessage(error));
      throw error;
    }
  }

  /**
   * Read transformation source code
   */
  async read(
    config: Partial<ITransformationConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions,
  ): Promise<ITransformationState | undefined> {
    const state: ITransformationState = { errors: [] };
    if (!config.transformationName) {
      const error = new Error('Transformation name is required');
      state.errors.push({ method: 'read', error, timestamp: new Date() });
      throw error;
    }

    try {
      const response = await getTransformationSource(
        this.connection,
        config.transformationName,
        version,
        options,
        this.logger,
      );
      state.readResult = response;
      return state;
    } catch (error: unknown) {
      const e = error as HttpError;
      if (e.response?.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Read transformation metadata (object characteristics: package, responsible, description, etc.)
   */
  async readMetadata(
    config: Partial<ITransformationConfig>,
    options?: IReadOptions,
  ): Promise<ITransformationState> {
    const state: ITransformationState = { errors: [] };
    if (!config.transformationName) {
      const error = new Error('Transformation name is required');
      state.errors.push({
        method: 'readMetadata',
        error,
        timestamp: new Date(),
      });
      throw error;
    }
    try {
      const response = await getTransformation(
        this.connection,
        config.transformationName,
        'inactive',
        options,
        this.logger,
      );
      state.metadataResult = response;
      this.logger?.info?.('Transformation metadata read successfully');
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({
        method: 'readMetadata',
        error: err,
        timestamp: new Date(),
      });
      this.logger?.error('readMetadata', safeErrorMessage(err));
      throw err;
    }
  }

  /**
   * Read transport request information for the transformation
   */
  async readTransport(
    config: Partial<ITransformationConfig>,
    options?: { withLongPolling?: boolean },
  ): Promise<ITransformationState> {
    const state: ITransformationState = { errors: [] };
    if (!config.transformationName) {
      const error = new Error('Transformation name is required');
      state.errors.push({
        method: 'readTransport',
        error,
        timestamp: new Date(),
      });
      throw error;
    }
    try {
      const response = await getTransformationTransport(
        this.connection,
        config.transformationName,
        options?.withLongPolling !== undefined
          ? { withLongPolling: options.withLongPolling }
          : undefined,
      );
      state.transportResult = response;
      this.logger?.info?.('Transformation transport request read successfully');
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({
        method: 'readTransport',
        error: err,
        timestamp: new Date(),
      });
      this.logger?.error('readTransport', safeErrorMessage(err));
      throw err;
    }
  }

  /**
   * Update transformation with full operation chain
   * Always starts with lock
   * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
   */
  async update(
    config: Partial<ITransformationConfig>,
    options?: IAdtOperationOptions,
  ): Promise<ITransformationState> {
    const state: ITransformationState = { errors: [] };
    if (!config.transformationName) {
      const error = new Error('Transformation name is required');
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
      const updateResponse = await updateTransformation(
        this.connection,
        {
          transformation_name: config.transformationName,
          source_code: codeToUpdate,
          transport_request: config.transportRequest,
        },
        options.lockHandle,
      );
      this.logger?.info?.('Transformation updated (low-level)');
      return {
        updateResult: updateResponse,
        errors: [],
      };
    }

    let lockHandle: string | undefined;

    try {
      // 1. Lock (update always starts with lock, stateful ONLY before lock)
      this.logger?.info?.('Step 1: Locking transformation');
      this.connection.setSessionType('stateful');
      lockHandle = await lockTransformation(
        this.connection,
        config.transformationName,
      );
      this.connection.setSessionType('stateless');
      this.logger?.info?.('Transformation locked, handle:', lockHandle);

      // 2. Check inactive with code for update (from options or config)
      const codeToCheck = options?.sourceCode || config.sourceCode;
      if (codeToCheck) {
        this.logger?.info?.(
          'Step 2: Checking inactive version with update content',
        );
        await checkTransformation(
          this.connection,
          config.transformationName,
          'inactive',
          codeToCheck,
        );
        this.logger?.info?.('Check inactive with update content passed');
      }

      // 3. Update
      if (codeToCheck && lockHandle) {
        this.logger?.info?.('Step 3: Updating transformation');
        await updateTransformation(
          this.connection,
          {
            transformation_name: config.transformationName,
            source_code: codeToCheck,
            transport_request: config.transportRequest,
          },
          lockHandle,
        );
        this.logger?.info?.('Transformation updated');

        // 3.5. Read with long polling (wait for object to be ready after update)
        this.logger?.info?.('read (wait for object ready after update)');
        try {
          await this.read(
            { transformationName: config.transformationName },
            'active',
            { withLongPolling: true },
          );
          this.logger?.info?.('object is ready after update');
        } catch (readError) {
          this.logger?.warn?.(
            'read with long polling failed (object may not be ready yet):',
            safeErrorMessage(readError),
          );
          // Continue anyway - unlock might still work
        }
      }

      // 4. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger?.info?.('Step 4: Unlocking transformation');
        this.connection.setSessionType('stateful');
        await unlockTransformation(
          this.connection,
          config.transformationName,
          lockHandle,
        );
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger?.info?.('Transformation unlocked');
      }

      // 5. Final check (no stateful needed)
      this.logger?.info?.('Step 5: Final check');
      await checkTransformation(
        this.connection,
        config.transformationName,
        'inactive',
      );
      this.logger?.info?.('Final check passed');

      // 6. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 6: Activating transformation');
        const activateResponse = await activateTransformation(
          this.connection,
          config.transformationName,
        );
        this.logger?.info?.(
          'Transformation activated, status:',
          activateResponse.status,
        );

        // 6.5. Read with long polling (wait for object to be ready after activation)
        this.logger?.info?.('read (wait for object ready after activation)');
        try {
          await this.read(
            { transformationName: config.transformationName },
            'active',
            { withLongPolling: true },
          );
          this.logger?.info?.('object is ready after activation');
        } catch (readError) {
          this.logger?.warn?.(
            'read with long polling failed (object may not be ready yet):',
            safeErrorMessage(readError),
          );
          // Continue anyway - return activation response
        }

        return {
          activateResult: activateResponse,
          errors: [],
        };
      }

      // Read and return result (no stateful needed)
      const readResponse = await getTransformationSource(
        this.connection,
        config.transformationName,
      );

      return {
        readResult: readResponse,
        errors: [],
      };
    } catch (error: unknown) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger?.warn?.('Unlocking transformation during error cleanup');
          this.connection.setSessionType('stateful');
          await unlockTransformation(
            this.connection,
            config.transformationName,
            lockHandle,
          );
          this.connection.setSessionType('stateless');
        } catch (unlockError) {
          this.logger?.warn?.(
            'Failed to unlock during cleanup:',
            safeErrorMessage(unlockError),
          );
        }
      } else {
        // Ensure stateless if lock failed
        this.connection.setSessionType('stateless');
      }

      if (options?.deleteOnFailure) {
        try {
          this.logger?.warn?.('Deleting transformation after failure');
          // No stateful needed - delete doesn't use lock/unlock
          await deleteTransformation(this.connection, {
            transformation_name: config.transformationName,
            transport_request: config.transportRequest,
          });
        } catch (deleteError) {
          this.logger?.warn?.(
            'Failed to delete transformation after failure:',
            safeErrorMessage(deleteError),
          );
        }
      }

      this.logger?.error('Update failed:', safeErrorMessage(error));
      throw error;
    }
  }

  /**
   * Delete transformation
   */
  async delete(
    config: Partial<ITransformationConfig>,
  ): Promise<ITransformationState> {
    const state: ITransformationState = { errors: [] };
    if (!config.transformationName) {
      const error = new Error('Transformation name is required');
      state.errors.push({ method: 'delete', error, timestamp: new Date() });
      throw error;
    }

    try {
      // Check for deletion (no stateful needed)
      this.logger?.info?.('Checking transformation for deletion');
      await checkDeletion(this.connection, {
        transformation_name: config.transformationName,
        transport_request: config.transportRequest,
      });
      this.logger?.info?.('Deletion check passed');

      // Delete (no stateful needed - no lock/unlock)
      this.logger?.info?.('Deleting transformation');
      const result = await deleteTransformation(this.connection, {
        transformation_name: config.transformationName,
        transport_request: config.transportRequest,
      });
      this.logger?.info?.('Transformation deleted');

      return {
        deleteResult: result,
        errors: [],
      };
    } catch (error: unknown) {
      this.logger?.error('Delete failed:', safeErrorMessage(error));
      throw error;
    }
  }

  /**
   * Activate transformation
   * No stateful needed - uses same session/cookies
   */
  async activate(
    config: Partial<ITransformationConfig>,
  ): Promise<ITransformationState> {
    const state: ITransformationState = { errors: [] };
    if (!config.transformationName) {
      const error = new Error('Transformation name is required');
      state.errors.push({ method: 'activate', error, timestamp: new Date() });
      throw error;
    }

    try {
      const result = await activateTransformation(
        this.connection,
        config.transformationName,
      );
      state.activateResult = result;
      return state;
    } catch (error: unknown) {
      this.logger?.error('Activate failed:', safeErrorMessage(error));
      throw error;
    }
  }

  /**
   * Check transformation
   */
  async check(
    config: Partial<ITransformationConfig>,
    status?: string,
  ): Promise<ITransformationState> {
    const state: ITransformationState = { errors: [] };
    if (!config.transformationName) {
      const error = new Error('Transformation name is required');
      state.errors.push({ method: 'check', error, timestamp: new Date() });
      throw error;
    }

    // Map status to version
    const version: string = status === 'active' ? 'active' : 'inactive';
    state.checkResult = await checkTransformation(
      this.connection,
      config.transformationName,
      version,
    );
    return state;
  }

  /**
   * Lock transformation for modification
   */
  async lock(config: Partial<ITransformationConfig>): Promise<string> {
    if (!config.transformationName) {
      throw new Error('Transformation name is required');
    }

    this.connection.setSessionType('stateful');
    const lockHandle = await lockTransformation(
      this.connection,
      config.transformationName,
    );
    this.connection.setSessionType('stateless');
    return lockHandle;
  }

  /**
   * Unlock transformation
   */
  async unlock(
    config: Partial<ITransformationConfig>,
    lockHandle: string,
  ): Promise<ITransformationState> {
    if (!config.transformationName) {
      throw new Error('Transformation name is required');
    }

    this.connection.setSessionType('stateful');
    const result = await unlockTransformation(
      this.connection,
      config.transformationName,
      lockHandle,
    );
    this.connection.setSessionType('stateless');
    return {
      unlockResult: result,
      errors: [],
    };
  }
}

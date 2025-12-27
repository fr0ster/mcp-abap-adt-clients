/**
 * AdtBehaviorImplementation - High-level CRUD operations for Behavior Implementation objects
 *
 * Implements IAdtObject interface with automatic operation chains,
 * error handling, and resource cleanup.
 *
 * Behavior Implementation is a special form of class (CLAS/OC) with:
 * - Empty main class source
 * - Special implementations include (local handler class)
 *
 * Uses composition with AdtClass for most operations, overriding only
 * methods that work with implementations include (update, read).
 *
 * Session management:
 * - stateful: only when doing lock/update/unlock operations
 * - stateless: obligatory after unlock
 * - If no lock/unlock, no stateful needed
 * - activate uses same session/cookies (no stateful needed)
 *
 * Operation chains:
 * - Create: validate → create (via AdtClass) → check → lock → check(inactive) → update (implementations) → unlock → check → activate
 * - Update: lock → check(inactive) → update (implementations) → unlock → check → activate
 * - Delete: check(deletion) → delete (via AdtClass)
 */

import type {
  IAbapConnection,
  IAdtObject,
  IAdtOperationOptions,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { getSystemInformation } from '../../utils/systemInfo';
import { AdtClass } from '../class';
import { updateClass } from '../class/update';
import type { IReadOptions } from '../shared/types';
import {
  getBehaviorImplementationMetadata,
  getBehaviorImplementationSource,
  getBehaviorImplementationTransport,
} from './read';
import type {
  IBehaviorImplementationConfig,
  IBehaviorImplementationState,
} from './types';
import { updateBehaviorImplementation } from './update';
import { validateBehaviorImplementationName } from './validation';

export class AdtBehaviorImplementation
  implements
    IAdtObject<IBehaviorImplementationConfig, IBehaviorImplementationState>
{
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  private readonly class: AdtClass;
  public readonly objectType: string = 'BehaviorImplementation';

  constructor(connection: IAbapConnection, logger?: ILogger) {
    this.connection = connection;
    this.logger = logger;
    this.class = new AdtClass(connection, logger);
  }

  /**
   * Validate behavior implementation configuration before creation
   */
  async validate(
    config: Partial<IBehaviorImplementationConfig>,
  ): Promise<IBehaviorImplementationState> {
    const state: IBehaviorImplementationState = { errors: [] };
    if (!config.className) {
      const error = new Error('Class name is required for validation');
      state.errors.push({ method: 'validate', error, timestamp: new Date() });
      throw error;
    }
    if (!config.behaviorDefinition) {
      const error = new Error('Behavior definition is required for validation');
      state.errors.push({ method: 'validate', error, timestamp: new Date() });
      throw error;
    }

    try {
      const response = await validateBehaviorImplementationName(
        this.connection,
        config.className,
        config.packageName,
        config.description,
        config.behaviorDefinition,
      );
      state.validationResponse = response;
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({
        method: 'validate',
        error: err,
        timestamp: new Date(),
      });
      this.logger?.error('validate', err);
      throw err;
    }
  }

  /**
   * Create behavior implementation with full operation chain
   */
  async create(
    config: IBehaviorImplementationConfig,
    _options?: IAdtOperationOptions,
  ): Promise<IBehaviorImplementationState> {
    const state: IBehaviorImplementationState = { errors: [] };
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.packageName) {
      throw new Error('Package name is required');
    }
    if (!config.description) {
      throw new Error('Description is required');
    }
    if (!config.behaviorDefinition) {
      throw new Error('Behavior definition is required');
    }

    let _objectCreated = false;
    const systemInfo = await getSystemInformation(this.connection);
    const username = systemInfo?.userName || '';
    const masterSystem = systemInfo?.systemID;

    try {
      // Create behavior implementation class
      this.logger?.info?.('Creating behavior implementation class');
      const createState = await this.class.create(
        {
          className: config.className,
          packageName: config.packageName,
          transportRequest: config.transportRequest,
          description: config.description,
          masterSystem: masterSystem,
          responsible: username,
        },
        { activateOnCreate: false },
      );
      state.createResult = createState.createResult;
      _objectCreated = true;
      this.logger?.info?.('Behavior implementation class created');
      return state;
    } catch (error: any) {
      this.logger?.error('Create failed:', error);
      throw error;
    }
  }

  /**
   * Read behavior implementation
   */
  async read(
    config: Partial<IBehaviorImplementationConfig>,
    version: 'active' | 'inactive' = 'active',
    options?: IReadOptions,
  ): Promise<IBehaviorImplementationState | undefined> {
    const state: IBehaviorImplementationState = { errors: [] };
    if (!config.className) {
      const error = new Error('Class name is required');
      state.errors.push({ method: 'read', error, timestamp: new Date() });
      throw error;
    }

    try {
      const response = await getBehaviorImplementationSource(
        this.connection,
        config.className,
        version,
        options,
        this.logger,
      );
      state.readResult = response;
      return state;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return undefined;
      }
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({ method: 'read', error: err, timestamp: new Date() });
      this.logger?.error('read', err);
      throw err;
    }
  }

  /**
   * Read behavior implementation metadata (object characteristics: package, responsible, description, etc.)
   */
  async readMetadata(
    config: Partial<IBehaviorImplementationConfig>,
    options?: IReadOptions,
  ): Promise<IBehaviorImplementationState> {
    const state: IBehaviorImplementationState = { errors: [] };
    if (!config.className) {
      const error = new Error('Class name is required');
      state.errors.push({
        method: 'readMetadata',
        error,
        timestamp: new Date(),
      });
      throw error;
    }
    try {
      const response = await getBehaviorImplementationMetadata(
        this.connection,
        config.className,
        options,
        this.logger,
      );
      state.metadataResult = response;
      this.logger?.info?.('Behavior implementation metadata read successfully');
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
   * Read transport request information for the behavior implementation
   */
  async readTransport(
    config: Partial<IBehaviorImplementationConfig>,
    options?: { withLongPolling?: boolean },
  ): Promise<IBehaviorImplementationState> {
    const state: IBehaviorImplementationState = { errors: [] };
    if (!config.className) {
      const error = new Error('Class name is required');
      state.errors.push({
        method: 'readTransport',
        error,
        timestamp: new Date(),
      });
      throw error;
    }
    try {
      const response = await getBehaviorImplementationTransport(
        this.connection,
        config.className,
        options?.withLongPolling !== undefined
          ? { withLongPolling: options.withLongPolling }
          : undefined,
      );
      state.transportResult = response;
      this.logger?.info?.(
        'Behavior implementation transport request read successfully',
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
   * Update behavior implementation with full operation chain
   * Always starts with lock
   * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
   */
  async update(
    config: Partial<IBehaviorImplementationConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IBehaviorImplementationState> {
    const state: IBehaviorImplementationState = { errors: [] };
    if (!config.className) {
      const error = new Error('Class name is required');
      state.errors.push({ method: 'update', error, timestamp: new Date() });
      throw error;
    }

    // Low-level mode: if lockHandle is provided, perform only update operation
    if (options?.lockHandle) {
      const codeToUpdate =
        options?.sourceCode || config.implementationCode || config.sourceCode;
      if (!codeToUpdate) {
        throw new Error('Implementation code is required for update');
      }
      if (!config.behaviorDefinition) {
        throw new Error('behaviorDefinition is required for update');
      }

      this.logger?.info?.(
        'Low-level update: performing update only (lockHandle provided)',
      );

      // Update main source with "FOR BEHAVIOR OF" clause
      const mainSource = `CLASS ${config.className} DEFINITION PUBLIC ABSTRACT FINAL FOR BEHAVIOR OF ${config.behaviorDefinition}.

ENDCLASS.

CLASS ${config.className} IMPLEMENTATION.

ENDCLASS.`;
      await updateClass(
        this.connection,
        config.className,
        mainSource,
        options.lockHandle,
        config.transportRequest,
      );

      // Update implementations include
      const updateResponse = await updateBehaviorImplementation(
        this.connection,
        config.className,
        codeToUpdate,
        options.lockHandle,
        config.transportRequest,
      );
      this.logger?.info?.('Behavior implementation updated (low-level)');
      return {
        updateResult: updateResponse,
        errors: [],
      };
    }

    let lockHandle: string | undefined;

    try {
      // 1. Lock (update always starts with lock, stateful set inside lock method)
      this.logger?.info?.('Step 1: Locking behavior implementation class');
      lockHandle = await this.class.lock({ className: config.className });
      state.lockHandle = lockHandle;
      this.logger?.info?.(
        'Behavior implementation class locked, handle:',
        lockHandle,
      );

      // 2. Get code for update (from options or config)
      const codeToCheck =
        options?.sourceCode || config.implementationCode || config.sourceCode;

      // 3. Check inactive version (without sourceCode - implementations include code is not full class code)
      // Note: We don't check with implementations include code because it's not the full class code
      // The implementations include code will be validated when we update it
      this.logger?.info?.('Step 2: Checking inactive version');
      const checkInactiveState = await this.class.check(
        { className: config.className },
        'inactive',
      );
      state.checkResult = checkInactiveState.checkResult;
      this.logger?.info?.('Check inactive passed');

      // 4. Update main source with "FOR BEHAVIOR OF" clause (required before updating implementations)
      if (!config.behaviorDefinition) {
        throw new Error('behaviorDefinition is required for update');
      }
      if (lockHandle) {
        this.logger?.info?.(
          'Step 3: Updating main source with FOR BEHAVIOR OF clause',
        );
        const mainSource = `CLASS ${config.className} DEFINITION PUBLIC ABSTRACT FINAL FOR BEHAVIOR OF ${config.behaviorDefinition}.

ENDCLASS.

CLASS ${config.className} IMPLEMENTATION.

ENDCLASS.`;
        const _mainSourceUpdateResponse = await updateClass(
          this.connection,
          config.className,
          mainSource,
          lockHandle,
          config.transportRequest,
        );
        this.logger?.info?.('Main source updated with FOR BEHAVIOR OF clause');
      }

      // 5. Update implementations include
      if (codeToCheck && lockHandle) {
        this.logger?.info?.(
          'Step 4: Updating behavior implementation implementations include',
        );
        const updateResponse = await updateBehaviorImplementation(
          this.connection,
          config.className,
          codeToCheck,
          lockHandle,
          config.transportRequest,
        );
        state.updateResult = updateResponse;
        this.logger?.info?.(
          'Behavior implementation implementations include updated',
        );

        // 5.5. Read with long polling (wait for object to be ready after update)
        this.logger?.info?.('read (wait for object ready after update)');
        try {
          await this.read({ className: config.className }, 'active', {
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

      // 6. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger?.info?.('Step 5: Unlocking behavior implementation class');
        const unlockState = await this.class.unlock(
          { className: config.className },
          lockHandle,
        );
        state.unlockResult = unlockState.unlockResult;
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger?.info?.('Behavior implementation class unlocked');
      }

      // 7. Final check (no stateful needed)
      this.logger?.info?.('Step 6: Final check');
      const finalCheckState = await this.class.check(
        { className: config.className },
        'inactive',
      );
      state.checkResult = finalCheckState.checkResult;
      this.logger?.info?.('Final check passed');

      // 8. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 7: Activating behavior implementation class');
        const activateState = await this.class.activate({
          className: config.className,
        });
        state.activateResult = activateState.activateResult;
        this.logger?.info?.(
          'Behavior implementation class activated, status:',
          activateState.activateResult?.status,
        );

        // 6.5. Read with long polling (wait for object to be ready after activation)
        this.logger?.info?.('read (wait for object ready after activation)');
        try {
          await this.read({ className: config.className }, 'active', {
            withLongPolling: true,
          });
          this.logger?.info?.('object is ready after activation');
        } catch (readError) {
          this.logger?.warn?.(
            'read with long polling failed (object may not be ready yet):',
            readError,
          );
          // Continue anyway - return state with activation result
        }

        return state;
      }

      // Read and return result (no stateful needed)
      const readResponse = await getBehaviorImplementationSource(
        this.connection,
        config.className,
      );
      state.readResult = readResponse;

      return state;
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger?.warn?.(
            'Unlocking behavior implementation class during error cleanup',
          );
          await this.class.unlock({ className: config.className }, lockHandle);
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
          this.logger?.warn?.(
            'Deleting behavior implementation class after failure',
          );
          await this.class.delete({
            className: config.className,
            transportRequest: config.transportRequest,
          });
        } catch (deleteError) {
          this.logger?.warn?.(
            'Failed to delete behavior implementation class after failure:',
            deleteError,
          );
        }
      }

      this.logger?.error('Update failed:', error);
      throw error;
    }
  }

  /**
   * Delete behavior implementation
   */
  async delete(
    config: Partial<IBehaviorImplementationConfig>,
  ): Promise<IBehaviorImplementationState> {
    const state: IBehaviorImplementationState = { errors: [] };
    if (!config.className) {
      const error = new Error('Class name is required');
      state.errors.push({ method: 'delete', error, timestamp: new Date() });
      throw error;
    }

    try {
      // Delete via AdtClass (handles check and delete)
      this.logger?.info?.('Deleting behavior implementation class');
      const deleteState = await this.class.delete({
        className: config.className,
        transportRequest: config.transportRequest,
      });
      state.deleteResult = deleteState.deleteResult;
      this.logger?.info?.('Behavior implementation class deleted');

      return state;
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
   * Activate behavior implementation
   * No stateful needed - uses same session/cookies
   */
  async activate(
    config: Partial<IBehaviorImplementationConfig>,
  ): Promise<IBehaviorImplementationState> {
    const state: IBehaviorImplementationState = { errors: [] };
    if (!config.className) {
      const error = new Error('Class name is required');
      state.errors.push({ method: 'activate', error, timestamp: new Date() });
      throw error;
    }

    try {
      const activateState = await this.class.activate({
        className: config.className,
      });
      state.activateResult = activateState.activateResult;
      return state;
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
   * Check behavior implementation
   */
  async check(
    config: Partial<IBehaviorImplementationConfig>,
    status?: string,
  ): Promise<IBehaviorImplementationState> {
    const state: IBehaviorImplementationState = { errors: [] };
    if (!config.className) {
      const error = new Error('Class name is required');
      state.errors.push({ method: 'check', error, timestamp: new Date() });
      throw error;
    }

    try {
      const checkState = await this.class.check(
        { className: config.className },
        status,
      );
      state.checkResult = checkState.checkResult;
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({ method: 'check', error: err, timestamp: new Date() });
      this.logger?.error('check', err);
      throw err;
    }
  }

  /**
   * Lock behavior implementation for modification
   * Delegates to AdtClass since behavior implementation is a class
   */
  async lock(config: Partial<IBehaviorImplementationConfig>): Promise<string> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    return await this.class.lock({ className: config.className });
  }

  /**
   * Unlock behavior implementation
   * Delegates to AdtClass since behavior implementation is a class
   */
  async unlock(
    config: Partial<IBehaviorImplementationConfig>,
    lockHandle: string,
  ): Promise<IBehaviorImplementationState> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    const unlockState = await this.class.unlock(
      { className: config.className },
      lockHandle,
    );
    return {
      unlockResult: unlockState.unlockResult,
      errors: [],
    };
  }
}

/**
 * AdtBehaviorDefinition - High-level CRUD operations for Behavior Definition objects
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
import { IBehaviorDefinitionConfig, IBehaviorDefinitionState } from './types';
import { validate } from './validation';
import { create as createBehaviorDefinition } from './create';
import { check as checkBehaviorDefinition } from './check';
import { lock } from './lock';
import { update } from './update';
import { unlock } from './unlock';
import { activate } from './activation';
import { checkDeletion, deleteBehaviorDefinition } from './delete';
import { readSource, read as readBehaviorDefinition, getBehaviorDefinitionTransport } from './read';

export class AdtBehaviorDefinition implements IAdtObject<IBehaviorDefinitionConfig, IBehaviorDefinitionState> {
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  public readonly objectType: string = 'BehaviorDefinition';

  constructor(connection: IAbapConnection, logger?: ILogger) {
    this.connection = connection;
    this.logger = logger;
  }

  /**
   * Validate behavior definition configuration before creation
   */
  async validate(config: Partial<IBehaviorDefinitionConfig>): Promise<IBehaviorDefinitionState> {
    const state: IBehaviorDefinitionState = { errors: [] };
    if (!config.name) {
      const error = new Error('Behavior definition name is required for validation');
      state.errors.push({ method: 'validate', error, timestamp: new Date() });
      throw error;
    }
    if (!config.rootEntity) {
      const error = new Error('Root entity is required for validation');
      state.errors.push({ method: 'validate', error, timestamp: new Date() });
      throw error;
    }
    if (!config.packageName) {
      const error = new Error('Package name is required for validation');
      state.errors.push({ method: 'validate', error, timestamp: new Date() });
      throw error;
    }
    if (!config.implementationType) {
      const error = new Error('Implementation type is required for validation');
      state.errors.push({ method: 'validate', error, timestamp: new Date() });
      throw error;
    }

    try {
      const response = await validate(
        this.connection,
        {
          objname: config.name,
          rootEntity: config.rootEntity,
          description: config.description || config.name,
          package: config.packageName,
          implementationType: config.implementationType
        }
      );
      state.validationResponse = response;
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({ method: 'validate', error: err, timestamp: new Date() });
      this.logger?.error('Validate failed:', err);
      throw err;
    }
  }

  /**
   * Create behavior definition with full operation chain
   */
  async create(
    config: IBehaviorDefinitionConfig,
    options?: IAdtOperationOptions
  ): Promise<IBehaviorDefinitionState> {
    const state: IBehaviorDefinitionState = { errors: [] };
    if (!config.name) {
      throw new Error('Behavior definition name is required');
    }
    if (!config.packageName) {
      throw new Error('Package name is required');
    }
    if (!config.description) {
      throw new Error('Description is required');
    }
    if (!config.rootEntity) {
      throw new Error('Root entity is required');
    }
    if (!config.implementationType) {
      throw new Error('Implementation type is required');
    }

    let objectCreated = false;

    try {
      // Create behavior definition
      this.logger?.info?.('Creating behavior definition');
      const createResponse = await createBehaviorDefinition(this.connection, {
        name: config.name,
        package: config.packageName,
        description: config.description,
        implementationType: config.implementationType,
      });
      state.createResult = createResponse;
      objectCreated = true;
      this.logger?.info?.('Behavior definition created');

      return state;
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({ method: 'create', error: err, timestamp: new Date() });
      
      // Cleanup on error - ensure stateless
      this.connection.setSessionType('stateless');

      if (objectCreated && options?.deleteOnFailure) {
        try {
          this.logger?.warn?.('Deleting behavior definition after failure');
          // No stateful needed - delete doesn't use lock/unlock
          await deleteBehaviorDefinition(this.connection, config.name, config.transportRequest);
        } catch (deleteError) {
          this.logger?.warn?.('Failed to delete behavior definition after failure:', deleteError);
        }
      }

      this.logger?.error('Create failed:', err);
      throw err;
    }
  }

  /**
   * Read behavior definition
   */
  async read(
    config: Partial<IBehaviorDefinitionConfig>,
    version: 'active' | 'inactive' = 'active',
    options?: { withLongPolling?: boolean }
  ): Promise<IBehaviorDefinitionState | undefined> {
    const state: IBehaviorDefinitionState = { errors: [] };
    if (!config.name) {
      const error = new Error('Behavior definition name is required');
      state.errors.push({ method: 'read', error, timestamp: new Date() });
      throw error;
    }

    try {
      const response = await readSource(
        this.connection,
        config.name,
        version,
        options?.withLongPolling !== undefined ? { withLongPolling: options.withLongPolling } : undefined
      );
      state.readResult = response;
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
   * Read behavior definition metadata (object characteristics: package, responsible, description, etc.)
   */
  async readMetadata(
    config: Partial<IBehaviorDefinitionConfig>,
    options?: { withLongPolling?: boolean }
  ): Promise<IBehaviorDefinitionState> {
    const state: IBehaviorDefinitionState = { errors: [] };
    if (!config.name) {
      const error = new Error('Behavior definition name is required');
      state.errors.push({ method: 'readMetadata', error, timestamp: new Date() });
      throw error;
    }
    try {
      // Use empty sessionId for metadata read
      const response = await readBehaviorDefinition(
        this.connection,
        config.name,
        '',
        'inactive',
        options?.withLongPolling !== undefined ? { withLongPolling: options.withLongPolling } : undefined
      );
      state.metadataResult = response;
      this.logger?.info?.('Behavior definition metadata read successfully');
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({ method: 'readMetadata', error: err, timestamp: new Date() });
      this.logger?.error('Read metadata failed:', err);
      throw err;
    }
  }

  /**
   * Read transport request information for the behavior definition
   */
  async readTransport(
    config: Partial<IBehaviorDefinitionConfig>,
    options?: { withLongPolling?: boolean }
  ): Promise<IBehaviorDefinitionState> {
    const state: IBehaviorDefinitionState = { errors: [] };
    if (!config.name) {
      const error = new Error('Behavior definition name is required');
      state.errors.push({ method: 'readTransport', error, timestamp: new Date() });
      throw error;
    }
    try {
      const response = await getBehaviorDefinitionTransport(
        this.connection,
        config.name,
        options?.withLongPolling !== undefined ? { withLongPolling: options.withLongPolling } : undefined
      );
      state.transportResult = response;
      this.logger?.info?.('Behavior definition transport request read successfully');
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({ method: 'readTransport', error: err, timestamp: new Date() });
      this.logger?.error('Read transport failed:', err);
      throw err;
    }
  }

  /**
   * Update behavior definition with full operation chain
   * Always starts with lock
   */
  async update(
    config: Partial<IBehaviorDefinitionConfig>,
    options?: IAdtOperationOptions
  ): Promise<IBehaviorDefinitionState> {
    const state: IBehaviorDefinitionState = { errors: [] };
    if (!config.name) {
      const error = new Error('Behavior definition name is required');
      state.errors.push({ method: 'update', error, timestamp: new Date() });
      throw error;
    }

    let lockHandle: string | undefined;

    try {
      // 1. Lock (update always starts with lock, stateful ONLY before lock)
      this.logger?.info?.('Step 1: Locking behavior definition');
      this.connection.setSessionType('stateful');
      lockHandle = await lock(this.connection, config.name);
      state.lockHandle = lockHandle;
      this.logger?.info?.('Behavior definition locked, handle:', lockHandle);

      // 2. Check inactive with code for update (from options or config)
      const codeToCheck = options?.sourceCode || config.sourceCode;
      if (codeToCheck) {
        this.logger?.info?.('Step 2: Checking inactive version with update content');
        const checkInactiveResponse = await checkBehaviorDefinition(this.connection, config.name, 'abapCheckRun', '', 'inactive', codeToCheck);
        state.checkResult = checkInactiveResponse;
        this.logger?.info?.('Check inactive with update content passed');
      }

      // 3. Update
      if (codeToCheck && lockHandle) {
        this.logger?.info?.('Step 3: Updating behavior definition');
        const updateResponse = await update(
          this.connection,
          {
            name: config.name,
            sourceCode: codeToCheck,
            lockHandle,
            transportRequest: config.transportRequest
          }
        );
        state.updateResult = updateResponse;
        this.logger?.info?.('Behavior definition updated');

        // 3.5. Read with long polling (wait for object to be ready after update)
        this.logger?.info?.('read (wait for object ready after update)');
        try {
          await this.read(
            { name: config.name },
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
        this.logger?.info?.('Step 4: Unlocking behavior definition');
        const unlockResponse = await unlock(this.connection, config.name, lockHandle);
        state.unlockResult = unlockResponse;
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger?.info?.('Behavior definition unlocked');
      }

      // 5. Final check (no stateful needed)
      this.logger?.info?.('Step 5: Final check');
      const finalCheckResponse = await checkBehaviorDefinition(this.connection, config.name, 'bdefImplementationCheck', '', 'inactive');
      state.checkResult = finalCheckResponse;
      this.logger?.info?.('Final check passed');

      // 6. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 6: Activating behavior definition');
        const activateResponse = await activate(this.connection, config.name);
        state.activateResult = activateResponse;
        this.logger?.info?.('Behavior definition activated, status:', activateResponse.status);

        // 6.5. Read with long polling (wait for object to be ready after activation)
        this.logger?.info?.('read (wait for object ready after activation)');
        try {
          await this.read(
            { name: config.name },
            'active',
            { withLongPolling: true }
          );
          this.logger?.info?.('object is ready after activation');
        } catch (readError) {
          this.logger?.warn?.('read with long polling failed (object may not be ready yet):', readError);
          // Continue anyway - return state with activation result
        }
        
        return state;
      }

      // Read and return result (no stateful needed)
      const readResponse = await readSource(this.connection, config.name);
      state.readResult = readResponse;

      return state;
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger?.warn?.('Unlocking behavior definition during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlock(this.connection, config.name, lockHandle);
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
          this.logger?.warn?.('Deleting behavior definition after failure');
          // No stateful needed - delete doesn't use lock/unlock
          await deleteBehaviorDefinition(this.connection, config.name, config.transportRequest);
        } catch (deleteError) {
          this.logger?.warn?.('Failed to delete behavior definition after failure:', deleteError);
        }
      }

      this.logger?.error('Update failed:', error);
      throw error;
    }
  }

  /**
   * Delete behavior definition
   */
  async delete(config: Partial<IBehaviorDefinitionConfig>): Promise<IBehaviorDefinitionState> {
    const state: IBehaviorDefinitionState = { errors: [] };
    if (!config.name) {
      const error = new Error('Behavior definition name is required');
      state.errors.push({ method: 'delete', error, timestamp: new Date() });
      throw error;
    }

    try {
      // Check for deletion (no stateful needed)
      this.logger?.info?.('Checking behavior definition for deletion');
      await checkDeletion(this.connection, config.name);
      this.logger?.info?.('Deletion check passed');

      // Delete (no stateful needed - no lock/unlock)
      this.logger?.info?.('Deleting behavior definition');
      const result = await deleteBehaviorDefinition(this.connection, config.name, config.transportRequest);
      state.deleteResult = result;
      this.logger?.info?.('Behavior definition deleted');

      return state;
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({ method: 'delete', error: err, timestamp: new Date() });
      this.logger?.error('Delete failed:', err);
      throw err;
    }
  }

  /**
   * Activate behavior definition
   * No stateful needed - uses same session/cookies
   */
  async activate(config: Partial<IBehaviorDefinitionConfig>): Promise<IBehaviorDefinitionState> {
    const state: IBehaviorDefinitionState = { errors: [] };
    if (!config.name) {
      const error = new Error('Behavior definition name is required');
      state.errors.push({ method: 'activate', error, timestamp: new Date() });
      throw error;
    }

    try {
      const result = await activate(this.connection, config.name);
      state.activateResult = result;
      return state;
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({ method: 'activate', error: err, timestamp: new Date() });
      this.logger?.error('Activate failed:', err);
      throw err;
    }
  }

  /**
   * Check behavior definition
   */
  async check(
    config: Partial<IBehaviorDefinitionConfig>,
    status?: string
  ): Promise<IBehaviorDefinitionState> {
    const state: IBehaviorDefinitionState = { errors: [] };
    if (!config.name) {
      const error = new Error('Behavior definition name is required');
      state.errors.push({ method: 'check', error, timestamp: new Date() });
      throw error;
    }

    try {
      // Map status to version
      const version: string = status === 'active' ? 'active' : 'inactive';
      const response = await checkBehaviorDefinition(this.connection, config.name, 'bdefImplementationCheck', '', version);
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
   * Lock behavior definition for modification
   */
  async lock(config: Partial<IBehaviorDefinitionConfig>): Promise<string> {
    if (!config.name) {
      throw new Error('Behavior definition name is required');
    }

    this.connection.setSessionType('stateful');
    return await lock(this.connection, config.name);
  }

  /**
   * Unlock behavior definition
   */
  async unlock(config: Partial<IBehaviorDefinitionConfig>, lockHandle: string): Promise<IBehaviorDefinitionState> {
    if (!config.name) {
      throw new Error('Behavior definition name is required');
    }

    const result = await unlock(this.connection, config.name, lockHandle);
    this.connection.setSessionType('stateless');
    return {
      unlockResult: result,
      errors: []
    };
  }
}

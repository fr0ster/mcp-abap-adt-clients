/**
 * AdtAccessControl - High-level CRUD operations for Access Control (DCLS) objects
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
import { activateAccessControl } from './activation';
import { checkAccessControl } from './check';
import { create as createAccessControl } from './create';
import { checkDeletion, deleteAccessControl } from './delete';
import { lockAccessControl } from './lock';
import {
  getAccessControl,
  getAccessControlSource,
  getAccessControlTransport,
} from './read';
import type { IAccessControlConfig, IAccessControlState } from './types';
import { unlockAccessControl } from './unlock';
import { updateAccessControl } from './update';
import { validateAccessControlName } from './validation';

export class AdtAccessControl
  implements IAdtObject<IAccessControlConfig, IAccessControlState>
{
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  public readonly objectType: string = 'AccessControl';

  constructor(connection: IAbapConnection, logger?: ILogger) {
    this.connection = connection;
    this.logger = logger;
  }

  /**
   * Validate access control configuration before creation
   */
  async validate(
    config: Partial<IAccessControlConfig>,
  ): Promise<IAccessControlState> {
    const state: IAccessControlState = { errors: [] };
    if (!config.accessControlName) {
      const error = new Error('Access control name is required for validation');
      state.errors.push({ method: 'validate', error, timestamp: new Date() });
      throw error;
    }

    try {
      const response = await validateAccessControlName(
        this.connection,
        config.accessControlName,
        config.packageName,
        config.description,
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
   * Create access control with full operation chain
   */
  async create(
    config: IAccessControlConfig,
    options?: IAdtOperationOptions,
  ): Promise<IAccessControlState> {
    const state: IAccessControlState = { errors: [] };
    if (!config.accessControlName) {
      const error = new Error('Access control name is required');
      state.errors.push({ method: 'create', error, timestamp: new Date() });
      throw error;
    }
    if (!config.packageName) {
      throw new Error('Package name is required');
    }
    if (!config.description) {
      throw new Error('Description is required');
    }

    try {
      // Create access control
      this.logger?.info?.('Creating access control');
      const createResponse = await createAccessControl(this.connection, {
        access_control_name: config.accessControlName,
        package_name: config.packageName,
        transport_request: config.transportRequest,
        description: config.description,
        source_code: options?.sourceCode || config.sourceCode,
      });
      state.createResult = createResponse;
      this.logger?.info?.('Access control created');

      return state;
    } catch (error: any) {
      this.logger?.error('Create failed:', error);
      throw error;
    }
  }

  /**
   * Read access control
   */
  async read(
    config: Partial<IAccessControlConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions,
  ): Promise<IAccessControlState | undefined> {
    const state: IAccessControlState = { errors: [] };
    if (!config.accessControlName) {
      const error = new Error('Access control name is required');
      state.errors.push({ method: 'read', error, timestamp: new Date() });
      throw error;
    }

    try {
      const response = await getAccessControlSource(
        this.connection,
        config.accessControlName,
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
      throw error;
    }
  }

  /**
   * Read access control metadata (object characteristics: package, responsible, description, etc.)
   */
  async readMetadata(
    config: Partial<IAccessControlConfig>,
    options?: IReadOptions,
  ): Promise<IAccessControlState> {
    const state: IAccessControlState = { errors: [] };
    if (!config.accessControlName) {
      const error = new Error('Access control name is required');
      state.errors.push({
        method: 'readMetadata',
        error,
        timestamp: new Date(),
      });
      throw error;
    }
    try {
      const response = await getAccessControl(
        this.connection,
        config.accessControlName,
        'inactive',
        options,
        this.logger,
      );
      state.metadataResult = response;
      this.logger?.info?.('Access control metadata read successfully');
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
   * Read transport request information for the access control
   */
  async readTransport(
    config: Partial<IAccessControlConfig>,
    options?: { withLongPolling?: boolean },
  ): Promise<IAccessControlState> {
    const state: IAccessControlState = { errors: [] };
    if (!config.accessControlName) {
      const error = new Error('Access control name is required');
      state.errors.push({
        method: 'readTransport',
        error,
        timestamp: new Date(),
      });
      throw error;
    }
    try {
      const response = await getAccessControlTransport(
        this.connection,
        config.accessControlName,
        options?.withLongPolling !== undefined
          ? { withLongPolling: options.withLongPolling }
          : undefined,
      );
      state.transportResult = response;
      this.logger?.info?.('Access control transport request read successfully');
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
   * Update access control with full operation chain
   * Always starts with lock
   * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
   */
  async update(
    config: Partial<IAccessControlConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAccessControlState> {
    const state: IAccessControlState = { errors: [] };
    if (!config.accessControlName) {
      const error = new Error('Access control name is required');
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
      const updateResponse = await updateAccessControl(
        this.connection,
        {
          access_control_name: config.accessControlName,
          source_code: codeToUpdate,
          transport_request: config.transportRequest,
        },
        options.lockHandle,
      );
      this.logger?.info?.('Access control updated (low-level)');
      return {
        updateResult: updateResponse,
        errors: [],
      };
    }

    let lockHandle: string | undefined;

    try {
      // 1. Lock (update always starts with lock, stateful ONLY before lock)
      this.logger?.info?.('Step 1: Locking access control');
      this.connection.setSessionType('stateful');
      lockHandle = await lockAccessControl(
        this.connection,
        config.accessControlName,
      );
      this.logger?.info?.('Access control locked, handle:', lockHandle);

      // 2. Check inactive with code for update (from options or config)
      const codeToCheck = options?.sourceCode || config.sourceCode;
      if (codeToCheck) {
        this.logger?.info?.(
          'Step 2: Checking inactive version with update content',
        );
        await checkAccessControl(
          this.connection,
          config.accessControlName,
          'inactive',
          codeToCheck,
        );
        this.logger?.info?.('Check inactive with update content passed');
      }

      // 3. Update
      if (codeToCheck && lockHandle) {
        this.logger?.info?.('Step 3: Updating access control');
        await updateAccessControl(
          this.connection,
          {
            access_control_name: config.accessControlName,
            source_code: codeToCheck,
            transport_request: config.transportRequest,
          },
          lockHandle,
        );
        this.logger?.info?.('Access control updated');

        // 3.5. Read with long polling (wait for object to be ready after update)
        this.logger?.info?.('read (wait for object ready after update)');
        try {
          await this.read(
            { accessControlName: config.accessControlName },
            'active',
            { withLongPolling: true },
          );
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
        this.logger?.info?.('Step 4: Unlocking access control');
        await unlockAccessControl(
          this.connection,
          config.accessControlName,
          lockHandle,
        );
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger?.info?.('Access control unlocked');
      }

      // 5. Final check (no stateful needed)
      this.logger?.info?.('Step 5: Final check');
      await checkAccessControl(
        this.connection,
        config.accessControlName,
        'inactive',
      );
      this.logger?.info?.('Final check passed');

      // 6. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 6: Activating access control');
        const activateResponse = await activateAccessControl(
          this.connection,
          config.accessControlName,
        );
        this.logger?.info?.(
          'Access control activated, status:',
          activateResponse.status,
        );

        // 6.5. Read with long polling (wait for object to be ready after activation)
        this.logger?.info?.('read (wait for object ready after activation)');
        try {
          await this.read(
            { accessControlName: config.accessControlName },
            'active',
            { withLongPolling: true },
          );
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
      const readResponse = await getAccessControlSource(
        this.connection,
        config.accessControlName,
      );

      return {
        readResult: readResponse,
        errors: [],
      };
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger?.warn?.('Unlocking access control during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlockAccessControl(
            this.connection,
            config.accessControlName,
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
          this.logger?.warn?.('Deleting access control after failure');
          // No stateful needed - delete doesn't use lock/unlock
          await deleteAccessControl(this.connection, {
            access_control_name: config.accessControlName,
            transport_request: config.transportRequest,
          });
        } catch (deleteError) {
          this.logger?.warn?.(
            'Failed to delete access control after failure:',
            deleteError,
          );
        }
      }

      this.logger?.error('Update failed:', error);
      throw error;
    }
  }

  /**
   * Delete access control
   */
  async delete(
    config: Partial<IAccessControlConfig>,
  ): Promise<IAccessControlState> {
    const state: IAccessControlState = { errors: [] };
    if (!config.accessControlName) {
      const error = new Error('Access control name is required');
      state.errors.push({ method: 'delete', error, timestamp: new Date() });
      throw error;
    }

    try {
      // Check for deletion (no stateful needed)
      this.logger?.info?.('Checking access control for deletion');
      await checkDeletion(this.connection, {
        access_control_name: config.accessControlName,
        transport_request: config.transportRequest,
      });
      this.logger?.info?.('Deletion check passed');

      // Delete (no stateful needed - no lock/unlock)
      this.logger?.info?.('Deleting access control');
      const result = await deleteAccessControl(this.connection, {
        access_control_name: config.accessControlName,
        transport_request: config.transportRequest,
      });
      this.logger?.info?.('Access control deleted');

      return {
        deleteResult: result,
        errors: [],
      };
    } catch (error: any) {
      this.logger?.error('Delete failed:', error);
      throw error;
    }
  }

  /**
   * Activate access control
   * No stateful needed - uses same session/cookies
   */
  async activate(
    config: Partial<IAccessControlConfig>,
  ): Promise<IAccessControlState> {
    const state: IAccessControlState = { errors: [] };
    if (!config.accessControlName) {
      const error = new Error('Access control name is required');
      state.errors.push({ method: 'activate', error, timestamp: new Date() });
      throw error;
    }

    try {
      const result = await activateAccessControl(
        this.connection,
        config.accessControlName,
      );
      state.activateResult = result;
      return state;
    } catch (error: any) {
      this.logger?.error('Activate failed:', error);
      throw error;
    }
  }

  /**
   * Check access control
   */
  async check(
    config: Partial<IAccessControlConfig>,
    status?: string,
  ): Promise<IAccessControlState> {
    const state: IAccessControlState = { errors: [] };
    if (!config.accessControlName) {
      const error = new Error('Access control name is required');
      state.errors.push({ method: 'check', error, timestamp: new Date() });
      throw error;
    }

    // Map status to version
    const version: string = status === 'active' ? 'active' : 'inactive';
    state.checkResult = await checkAccessControl(
      this.connection,
      config.accessControlName,
      version,
    );
    return state;
  }

  /**
   * Lock access control for modification
   */
  async lock(config: Partial<IAccessControlConfig>): Promise<string> {
    if (!config.accessControlName) {
      throw new Error('Access control name is required');
    }

    this.connection.setSessionType('stateful');
    return await lockAccessControl(this.connection, config.accessControlName);
  }

  /**
   * Unlock access control
   */
  async unlock(
    config: Partial<IAccessControlConfig>,
    lockHandle: string,
  ): Promise<IAccessControlState> {
    if (!config.accessControlName) {
      throw new Error('Access control name is required');
    }

    const result = await unlockAccessControl(
      this.connection,
      config.accessControlName,
      lockHandle,
    );
    this.connection.setSessionType('stateless');
    return {
      unlockResult: result,
      errors: [],
    };
  }
}

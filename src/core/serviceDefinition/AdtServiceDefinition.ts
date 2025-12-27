/**
 * AdtServiceDefinition - High-level CRUD operations for Service Definition (DDLS) objects
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
import { activateServiceDefinition } from './activation';
import { checkServiceDefinition } from './check';
import { create as createServiceDefinition } from './create';
import { checkDeletion, deleteServiceDefinition } from './delete';
import { lockServiceDefinition } from './lock';
import {
  getServiceDefinition,
  getServiceDefinitionSource,
  getServiceDefinitionTransport,
} from './read';
import type {
  IServiceDefinitionConfig,
  IServiceDefinitionState,
} from './types';
import { unlockServiceDefinition } from './unlock';
import { updateServiceDefinition } from './update';
import { validateServiceDefinitionName } from './validation';

export class AdtServiceDefinition
  implements IAdtObject<IServiceDefinitionConfig, IServiceDefinitionState>
{
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  public readonly objectType: string = 'ServiceDefinition';

  constructor(connection: IAbapConnection, logger?: ILogger) {
    this.connection = connection;
    this.logger = logger;
  }

  /**
   * Validate service definition configuration before creation
   */
  async validate(
    config: Partial<IServiceDefinitionConfig>,
  ): Promise<IServiceDefinitionState> {
    const state: IServiceDefinitionState = { errors: [] };
    if (!config.serviceDefinitionName) {
      const error = new Error(
        'Service definition name is required for validation',
      );
      state.errors.push({ method: 'validate', error, timestamp: new Date() });
      throw error;
    }

    try {
      const response = await validateServiceDefinitionName(
        this.connection,
        config.serviceDefinitionName,
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
   * Create service definition with full operation chain
   */
  async create(
    config: IServiceDefinitionConfig,
    options?: IAdtOperationOptions,
  ): Promise<IServiceDefinitionState> {
    const state: IServiceDefinitionState = { errors: [] };
    if (!config.serviceDefinitionName) {
      const error = new Error('Service definition name is required');
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
      // Create service definition
      this.logger?.info?.('Creating service definition');
      const createResponse = await createServiceDefinition(this.connection, {
        service_definition_name: config.serviceDefinitionName,
        package_name: config.packageName,
        transport_request: config.transportRequest,
        description: config.description,
        source_code: options?.sourceCode || config.sourceCode,
      });
      state.createResult = createResponse;
      this.logger?.info?.('Service definition created');

      return state;
    } catch (error: any) {
      this.logger?.error('Create failed:', error);
      throw error;
    }
  }

  /**
   * Read service definition
   */
  async read(
    config: Partial<IServiceDefinitionConfig>,
    version: 'active' | 'inactive' = 'active',
    options?: IReadOptions,
  ): Promise<IServiceDefinitionState | undefined> {
    const state: IServiceDefinitionState = { errors: [] };
    if (!config.serviceDefinitionName) {
      const error = new Error('Service definition name is required');
      state.errors.push({ method: 'read', error, timestamp: new Date() });
      throw error;
    }

    try {
      const response = await getServiceDefinitionSource(
        this.connection,
        config.serviceDefinitionName,
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
   * Read service definition metadata (object characteristics: package, responsible, description, etc.)
   */
  async readMetadata(
    config: Partial<IServiceDefinitionConfig>,
    options?: IReadOptions,
  ): Promise<IServiceDefinitionState> {
    const state: IServiceDefinitionState = { errors: [] };
    if (!config.serviceDefinitionName) {
      const error = new Error('Service definition name is required');
      state.errors.push({
        method: 'readMetadata',
        error,
        timestamp: new Date(),
      });
      throw error;
    }
    try {
      const response = await getServiceDefinition(
        this.connection,
        config.serviceDefinitionName,
        'inactive',
        options,
        this.logger,
      );
      state.metadataResult = response;
      this.logger?.info?.('Service definition metadata read successfully');
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
   * Read transport request information for the service definition
   */
  async readTransport(
    config: Partial<IServiceDefinitionConfig>,
    options?: { withLongPolling?: boolean },
  ): Promise<IServiceDefinitionState> {
    const state: IServiceDefinitionState = { errors: [] };
    if (!config.serviceDefinitionName) {
      const error = new Error('Service definition name is required');
      state.errors.push({
        method: 'readTransport',
        error,
        timestamp: new Date(),
      });
      throw error;
    }
    try {
      const response = await getServiceDefinitionTransport(
        this.connection,
        config.serviceDefinitionName,
        options?.withLongPolling !== undefined
          ? { withLongPolling: options.withLongPolling }
          : undefined,
      );
      state.transportResult = response;
      this.logger?.info?.(
        'Service definition transport request read successfully',
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
   * Update service definition with full operation chain
   * Always starts with lock
   * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
   */
  async update(
    config: Partial<IServiceDefinitionConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IServiceDefinitionState> {
    const state: IServiceDefinitionState = { errors: [] };
    if (!config.serviceDefinitionName) {
      const error = new Error('Service definition name is required');
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
      const updateResponse = await updateServiceDefinition(
        this.connection,
        {
          service_definition_name: config.serviceDefinitionName,
          source_code: codeToUpdate,
          transport_request: config.transportRequest,
        },
        options.lockHandle,
      );
      this.logger?.info?.('Service definition updated (low-level)');
      return {
        updateResult: updateResponse,
        errors: [],
      };
    }

    let lockHandle: string | undefined;

    try {
      // 1. Lock (update always starts with lock, stateful ONLY before lock)
      this.logger?.info?.('Step 1: Locking service definition');
      this.connection.setSessionType('stateful');
      lockHandle = await lockServiceDefinition(
        this.connection,
        config.serviceDefinitionName,
      );
      this.logger?.info?.('Service definition locked, handle:', lockHandle);

      // 2. Check inactive with code for update (from options or config)
      const codeToCheck = options?.sourceCode || config.sourceCode;
      if (codeToCheck) {
        this.logger?.info?.(
          'Step 2: Checking inactive version with update content',
        );
        await checkServiceDefinition(
          this.connection,
          config.serviceDefinitionName,
          'inactive',
          codeToCheck,
        );
        this.logger?.info?.('Check inactive with update content passed');
      }

      // 3. Update
      if (codeToCheck && lockHandle) {
        this.logger?.info?.('Step 3: Updating service definition');
        await updateServiceDefinition(
          this.connection,
          {
            service_definition_name: config.serviceDefinitionName,
            source_code: codeToCheck,
            transport_request: config.transportRequest,
          },
          lockHandle,
        );
        this.logger?.info?.('Service definition updated');

        // 3.5. Read with long polling (wait for object to be ready after update)
        this.logger?.info?.('read (wait for object ready after update)');
        try {
          await this.read(
            { serviceDefinitionName: config.serviceDefinitionName },
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
        this.logger?.info?.('Step 4: Unlocking service definition');
        await unlockServiceDefinition(
          this.connection,
          config.serviceDefinitionName,
          lockHandle,
        );
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger?.info?.('Service definition unlocked');
      }

      // 5. Final check (no stateful needed)
      this.logger?.info?.('Step 5: Final check');
      await checkServiceDefinition(
        this.connection,
        config.serviceDefinitionName,
        'inactive',
      );
      this.logger?.info?.('Final check passed');

      // 6. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 6: Activating service definition');
        const activateResponse = await activateServiceDefinition(
          this.connection,
          config.serviceDefinitionName,
        );
        this.logger?.info?.(
          'Service definition activated, status:',
          activateResponse.status,
        );

        // 6.5. Read with long polling (wait for object to be ready after activation)
        this.logger?.info?.('read (wait for object ready after activation)');
        try {
          await this.read(
            { serviceDefinitionName: config.serviceDefinitionName },
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
      const readResponse = await getServiceDefinitionSource(
        this.connection,
        config.serviceDefinitionName,
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
            'Unlocking service definition during error cleanup',
          );
          // We're already in stateful after lock, just unlock and set stateless
          await unlockServiceDefinition(
            this.connection,
            config.serviceDefinitionName,
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
          this.logger?.warn?.('Deleting service definition after failure');
          // No stateful needed - delete doesn't use lock/unlock
          await deleteServiceDefinition(this.connection, {
            service_definition_name: config.serviceDefinitionName,
            transport_request: config.transportRequest,
          });
        } catch (deleteError) {
          this.logger?.warn?.(
            'Failed to delete service definition after failure:',
            deleteError,
          );
        }
      }

      this.logger?.error('Update failed:', error);
      throw error;
    }
  }

  /**
   * Delete service definition
   */
  async delete(
    config: Partial<IServiceDefinitionConfig>,
  ): Promise<IServiceDefinitionState> {
    const state: IServiceDefinitionState = { errors: [] };
    if (!config.serviceDefinitionName) {
      const error = new Error('Service definition name is required');
      state.errors.push({ method: 'delete', error, timestamp: new Date() });
      throw error;
    }

    try {
      // Check for deletion (no stateful needed)
      this.logger?.info?.('Checking service definition for deletion');
      await checkDeletion(this.connection, {
        service_definition_name: config.serviceDefinitionName,
        transport_request: config.transportRequest,
      });
      this.logger?.info?.('Deletion check passed');

      // Delete (no stateful needed - no lock/unlock)
      this.logger?.info?.('Deleting service definition');
      const result = await deleteServiceDefinition(this.connection, {
        service_definition_name: config.serviceDefinitionName,
        transport_request: config.transportRequest,
      });
      this.logger?.info?.('Service definition deleted');

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
   * Activate service definition
   * No stateful needed - uses same session/cookies
   */
  async activate(
    config: Partial<IServiceDefinitionConfig>,
  ): Promise<IServiceDefinitionState> {
    const state: IServiceDefinitionState = { errors: [] };
    if (!config.serviceDefinitionName) {
      const error = new Error('Service definition name is required');
      state.errors.push({ method: 'activate', error, timestamp: new Date() });
      throw error;
    }

    try {
      const result = await activateServiceDefinition(
        this.connection,
        config.serviceDefinitionName,
      );
      state.activateResult = result;
      return state;
    } catch (error: any) {
      this.logger?.error('Activate failed:', error);
      throw error;
    }
  }

  /**
   * Check service definition
   */
  async check(
    config: Partial<IServiceDefinitionConfig>,
    status?: string,
  ): Promise<IServiceDefinitionState> {
    const state: IServiceDefinitionState = { errors: [] };
    if (!config.serviceDefinitionName) {
      const error = new Error('Service definition name is required');
      state.errors.push({ method: 'check', error, timestamp: new Date() });
      throw error;
    }

    // Map status to version
    const version: string = status === 'active' ? 'active' : 'inactive';
    state.checkResult = await checkServiceDefinition(
      this.connection,
      config.serviceDefinitionName,
      version,
    );
    return state;
  }

  /**
   * Lock service definition for modification
   */
  async lock(config: Partial<IServiceDefinitionConfig>): Promise<string> {
    if (!config.serviceDefinitionName) {
      throw new Error('Service definition name is required');
    }

    this.connection.setSessionType('stateful');
    return await lockServiceDefinition(
      this.connection,
      config.serviceDefinitionName,
    );
  }

  /**
   * Unlock service definition
   */
  async unlock(
    config: Partial<IServiceDefinitionConfig>,
    lockHandle: string,
  ): Promise<IServiceDefinitionState> {
    if (!config.serviceDefinitionName) {
      throw new Error('Service definition name is required');
    }

    const result = await unlockServiceDefinition(
      this.connection,
      config.serviceDefinitionName,
      lockHandle,
    );
    this.connection.setSessionType('stateless');
    return {
      unlockResult: result,
      errors: [],
    };
  }
}

/**
 * AdtServiceDefinition - High-level CRUD operations for Service Definition (SRVD/SRV) objects
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
 * - Create: create (POST metadata only — creates an empty source; the source
 *   code is written by a subsequent update(), mirroring what Eclipse ADT does)
 * - Update: lock → check(inactive) → update → unlock → check → activate
 * - Delete: check(deletion) → delete
 */

import type {
  HttpError,
  IAbapConnection,
  IAdtOperationOptions,
  IAdtSourceObject,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IAdtSystemContext } from '../../clients/AdtClient';
import { safeErrorMessage } from '../../utils/internalUtils';
import {
  type ICapabilityContext,
  LockCapability,
  VersionsCapability,
} from '../shared/capabilities';
import {
  createLockTracker,
  type LockRegistry,
  type LockTracker,
} from '../shared/LockRegistry';
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

import {
  getServiceDefinitionVersionSource,
  getServiceDefinitionVersions,
} from './versions';
export class AdtServiceDefinition
  implements IAdtSourceObject<IServiceDefinitionConfig, IServiceDefinitionState>
{
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  private readonly systemContext: IAdtSystemContext;
  private readonly lockTracker: LockTracker;
  public readonly objectType: string = 'ServiceDefinition';

  // LAZY thunk (not a getter that snapshots): captures `this` but reads
  // this.connection/this.logger only when invoked, after the constructor has
  // run — so building the capabilities below as class fields is safe.
  private readonly capCtx = (): ICapabilityContext => ({
    connection: this.connection,
    logger: this.logger,
  });

  private readonly lockCap = new LockCapability<
    IServiceDefinitionConfig,
    IServiceDefinitionState
  >(this.capCtx, {
    nameOf: (c) => {
      if (!c.serviceDefinitionName)
        throw new Error('Service definition name is required');
      return c.serviceDefinitionName;
    },
    acquire: async (ctx, name) => ({
      lockHandle: await lockServiceDefinition(ctx.connection, name),
    }),
    release: async (ctx, name, handle) => {
      const result = await unlockServiceDefinition(
        ctx.connection,
        name,
        handle,
      );
      return { unlockResult: result, errors: [] };
    },
  });

  private readonly versionsCap =
    new VersionsCapability<IServiceDefinitionConfig>(this.capCtx, {
      nameOf: (c) => {
        if (!c.serviceDefinitionName)
          throw new Error('serviceDefinitionName is required');
        return c.serviceDefinitionName;
      },
      // NOTE: getServiceDefinitionVersions takes a config, not a bare name —
      // the strategy re-wraps. (getClassIncludeVersions, by contrast, takes a
      // name; the two low-level shapes differ and the strategy absorbs that.)
      list: (ctx, name) =>
        getServiceDefinitionVersions(ctx.connection, {
          serviceDefinitionName: name,
        }),
      source: (ctx, uri) =>
        getServiceDefinitionVersionSource(ctx.connection, uri),
    });

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
    lockRegistry?: LockRegistry,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
    this.lockTracker = createLockTracker(
      lockRegistry,
      this.objectType,
      (name, lockHandle) =>
        unlockServiceDefinition(this.connection, name, lockHandle),
    );
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
      this.logger?.error('validate', safeErrorMessage(err));
      throw err;
    }
  }

  /**
   * Create service definition with full operation chain
   */
  async create(
    config: IServiceDefinitionConfig,
    _options?: IAdtOperationOptions,
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
        masterSystem: this.systemContext.masterSystem,
        responsible: this.systemContext.responsible,
        masterLanguage:
          config.masterLanguage ?? this.systemContext.masterLanguage,
      });
      state.createResult = createResponse;
      this.logger?.info?.('Service definition created');

      return state;
    } catch (error: unknown) {
      this.logger?.error('Create failed:', safeErrorMessage(error));
      throw error;
    }
  }

  /**
   * Read service definition
   */
  async read(
    config: Partial<IServiceDefinitionConfig>,
    version?: 'active' | 'inactive',
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
    } catch (error: unknown) {
      const e = error as HttpError;
      if (e.response?.status === 404) {
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
      this.logger?.error('readMetadata', safeErrorMessage(err));
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
      this.logger?.error('readTransport', safeErrorMessage(err));
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
      this.lockTracker.track(config.serviceDefinitionName, lockHandle);
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
        // Poll the inactive version: the write above produced it; the active version may not exist yet.
        this.logger?.info?.('read (wait for object ready after update)');
        try {
          await this.read(
            { serviceDefinitionName: config.serviceDefinitionName },
            'inactive',
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
        this.logger?.info?.('Step 4: Unlocking service definition');
        this.connection.setSessionType('stateful');
        await unlockServiceDefinition(
          this.connection,
          config.serviceDefinitionName,
          lockHandle,
        );
        this.connection.setSessionType('stateless');
        this.lockTracker.untrack(config.serviceDefinitionName);
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
    } catch (error: unknown) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger?.warn?.(
            'Unlocking service definition during error cleanup',
          );
          this.connection.setSessionType('stateful');
          await unlockServiceDefinition(
            this.connection,
            config.serviceDefinitionName,
            lockHandle,
          );
          this.connection.setSessionType('stateless');
          this.lockTracker.untrack(config.serviceDefinitionName);
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
          this.logger?.warn?.('Deleting service definition after failure');
          // No stateful needed - delete doesn't use lock/unlock
          await deleteServiceDefinition(this.connection, {
            service_definition_name: config.serviceDefinitionName,
            transport_request: config.transportRequest,
          });
        } catch (deleteError) {
          this.logger?.warn?.(
            'Failed to delete service definition after failure:',
            safeErrorMessage(deleteError),
          );
        }
      }

      this.logger?.error('Update failed:', safeErrorMessage(error));
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
    } catch (error: unknown) {
      this.logger?.error('Delete failed:', safeErrorMessage(error));
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
    } catch (error: unknown) {
      this.logger?.error('Activate failed:', safeErrorMessage(error));
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
    const lockHandle = await this.lockCap.lock(config);
    this.lockTracker.track(config.serviceDefinitionName as string, lockHandle);
    return lockHandle;
  }

  /**
   * Unlock service definition
   */
  async unlock(
    config: Partial<IServiceDefinitionConfig>,
    lockHandle: string,
  ): Promise<IServiceDefinitionState> {
    const state = await this.lockCap.unlock(config, lockHandle);
    this.lockTracker.untrack(config.serviceDefinitionName as string);
    return state;
  }

  getVersions(config: Partial<IServiceDefinitionConfig>) {
    return this.versionsCap.getVersions(config);
  }

  getVersionSource(contentUri: string) {
    return this.versionsCap.getVersionSource(contentUri);
  }
}

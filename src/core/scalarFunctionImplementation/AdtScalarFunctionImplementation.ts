/**
 * AdtScalarFunctionImplementation - High-level CRUD for CDS scalar function implementations (DSFI/SFI).
 * Mirrors AdtScalarFunction; create() is metadata-only, source via update().
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
import {
  createLockTracker,
  type LockRegistry,
  type LockTracker,
} from '../shared/LockRegistry';
import type { IReadOptions } from '../shared/types';
import { activateScalarFunctionImplementation } from './activation';
import { checkScalarFunctionImplementation } from './check';
import { create as createScalarFunctionImplementation } from './create';
import { checkDeletion, deleteScalarFunctionImplementation } from './delete';
import { lockScalarFunctionImplementation } from './lock';
import {
  getScalarFunctionImplementation,
  getScalarFunctionImplementationSource,
  getScalarFunctionImplementationTransport,
} from './read';
import type {
  IScalarFunctionImplementationConfig,
  IScalarFunctionImplementationState,
} from './types';
import { unlockScalarFunctionImplementation } from './unlock';
import { updateScalarFunctionImplementation } from './update';
import { updateScalarFunctionImplementationMetadata } from './updateMetadata';
import { validateScalarFunctionImplementationName } from './validation';

const VALIDATION_UNSUPPORTED_STATUSES = new Set([404, 405, 501]);

import {
  getScalarFunctionImplementationVersionSource,
  getScalarFunctionImplementationVersions,
} from './versions';
export class AdtScalarFunctionImplementation
  implements
    IAdtObject<
      IScalarFunctionImplementationConfig,
      IScalarFunctionImplementationState
    >
{
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  private readonly systemContext: IAdtSystemContext;
  private readonly lockTracker: LockTracker;
  public readonly objectType: string = 'ScalarFunctionImplementation';

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
        unlockScalarFunctionImplementation(this.connection, name, lockHandle),
    );
  }

  async validate(
    config: Partial<IScalarFunctionImplementationConfig>,
  ): Promise<IScalarFunctionImplementationState> {
    const state: IScalarFunctionImplementationState = { errors: [] };
    if (!config.implementationName) {
      const error = new Error('Implementation name is required for validation');
      state.errors.push({ method: 'validate', error, timestamp: new Date() });
      throw error;
    }
    try {
      state.validationResponse = await validateScalarFunctionImplementationName(
        this.connection,
        config.implementationName,
        config.description,
      );
      state.validationSupported = true;
      return state;
    } catch (error) {
      const status = (error as HttpError)?.response?.status;
      if (status && VALIDATION_UNSUPPORTED_STATUSES.has(status)) {
        state.validationSupported = false;
        return state;
      }
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger?.error('validate', safeErrorMessage(err));
      throw err;
    }
  }

  async create(
    config: IScalarFunctionImplementationConfig,
    _options?: IAdtOperationOptions,
  ): Promise<IScalarFunctionImplementationState> {
    const state: IScalarFunctionImplementationState = { errors: [] };
    if (!config.implementationName)
      throw new Error('Implementation name is required');
    if (!config.scalarFunctionName)
      throw new Error('Scalar function name is required');
    if (!config.packageName) throw new Error('Package name is required');
    if (!config.description) throw new Error('Description is required');
    try {
      state.createResult = await createScalarFunctionImplementation(
        this.connection,
        {
          implementation_name: config.implementationName,
          scalar_function_name: config.scalarFunctionName,
          engine_value: config.engineValue,
          package_name: config.packageName,
          transport_request: config.transportRequest,
          description: config.description,
          masterSystem: this.systemContext.masterSystem,
          responsible: this.systemContext.responsible,
          masterLanguage:
            config.masterLanguage ?? this.systemContext.masterLanguage,
        },
      );
      return state;
    } catch (error) {
      this.logger?.error('Create failed:', safeErrorMessage(error));
      throw error;
    }
  }

  async read(
    config: Partial<IScalarFunctionImplementationConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions,
  ): Promise<IScalarFunctionImplementationState | undefined> {
    if (!config.implementationName)
      throw new Error('Implementation name is required');
    try {
      const response = await getScalarFunctionImplementationSource(
        this.connection,
        config.implementationName,
        version,
        options,
        this.logger,
      );
      return { readResult: response, errors: [] };
    } catch (error) {
      if ((error as HttpError).response?.status === 404) return undefined;
      throw error;
    }
  }

  async readMetadata(
    config: Partial<IScalarFunctionImplementationConfig>,
    options?: IReadOptions,
  ): Promise<IScalarFunctionImplementationState> {
    if (!config.implementationName)
      throw new Error('Implementation name is required');
    const response = await getScalarFunctionImplementation(
      this.connection,
      config.implementationName,
      'inactive',
      options,
      this.logger,
    );
    return { metadataResult: response, errors: [] };
  }

  async readTransport(
    config: Partial<IScalarFunctionImplementationConfig>,
    options?: { withLongPolling?: boolean },
  ): Promise<IScalarFunctionImplementationState> {
    if (!config.implementationName)
      throw new Error('Implementation name is required');
    const response = await getScalarFunctionImplementationTransport(
      this.connection,
      config.implementationName,
      options?.withLongPolling !== undefined
        ? { withLongPolling: options.withLongPolling }
        : undefined,
    );
    return { transportResult: response, errors: [] };
  }

  /**
   * Update the implementation source (JSON) via PUT /source/main.
   * No check/long-poll/auto-activate — those don't apply to DSFI.
   * Trio activation (DSFD+AMDP+DSFI) is the consumer's responsibility.
   */
  async update(
    config: Partial<IScalarFunctionImplementationConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IScalarFunctionImplementationState> {
    if (!config.implementationName)
      throw new Error('Implementation name is required');

    const sourceCode = options?.sourceCode ?? config.sourceCode;
    if (!sourceCode) throw new Error('Source code is required for update');

    if (options?.lockHandle) {
      const updateResult = await updateScalarFunctionImplementation(
        this.connection,
        {
          implementation_name: config.implementationName,
          source_code: sourceCode,
          transport_request: config.transportRequest,
        },
        options.lockHandle,
      );
      return { updateResult, errors: [] };
    }

    let lockHandle: string | undefined;
    try {
      this.connection.setSessionType('stateful');
      lockHandle = await lockScalarFunctionImplementation(
        this.connection,
        config.implementationName,
      );
      this.lockTracker.track(config.implementationName, lockHandle);
      const updateResult = await updateScalarFunctionImplementation(
        this.connection,
        {
          implementation_name: config.implementationName,
          source_code: sourceCode,
          transport_request: config.transportRequest,
        },
        lockHandle,
      );
      await unlockScalarFunctionImplementation(
        this.connection,
        config.implementationName,
        lockHandle,
      );
      this.lockTracker.untrack(config.implementationName);
      lockHandle = undefined;
      return { updateResult, errors: [] };
    } catch (error) {
      if (lockHandle) {
        try {
          await unlockScalarFunctionImplementation(
            this.connection,
            config.implementationName,
            lockHandle,
          );
          this.lockTracker.untrack(config.implementationName);
        } catch (unlockError) {
          this.logger?.warn?.(
            'Failed to unlock during cleanup:',
            safeErrorMessage(unlockError),
          );
        }
      }
      this.logger?.error('Update failed:', safeErrorMessage(error));
      throw error;
    } finally {
      this.connection.setSessionType('stateless');
    }
  }

  /**
   * Update the metadata (blues v2 XML) via PUT /dsfi/{name}.
   * Same lock/unlock/finally-stateless hardening as update().
   */
  async updateMetadata(
    config: Partial<IScalarFunctionImplementationConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IScalarFunctionImplementationState> {
    if (!config.implementationName)
      throw new Error('Implementation name is required');

    const sourceCode = options?.sourceCode ?? config.sourceCode;
    if (!sourceCode)
      throw new Error('Source code is required for updateMetadata');

    if (options?.lockHandle) {
      const updateResult = await updateScalarFunctionImplementationMetadata(
        this.connection,
        {
          implementation_name: config.implementationName,
          source_code: sourceCode,
          transport_request: config.transportRequest,
        },
        options.lockHandle,
      );
      return { updateResult, errors: [] };
    }

    let lockHandle: string | undefined;
    try {
      this.connection.setSessionType('stateful');
      lockHandle = await lockScalarFunctionImplementation(
        this.connection,
        config.implementationName,
      );
      this.lockTracker.track(config.implementationName, lockHandle);
      const updateResult = await updateScalarFunctionImplementationMetadata(
        this.connection,
        {
          implementation_name: config.implementationName,
          source_code: sourceCode,
          transport_request: config.transportRequest,
        },
        lockHandle,
      );
      await unlockScalarFunctionImplementation(
        this.connection,
        config.implementationName,
        lockHandle,
      );
      this.lockTracker.untrack(config.implementationName);
      lockHandle = undefined;
      return { updateResult, errors: [] };
    } catch (error) {
      if (lockHandle) {
        try {
          await unlockScalarFunctionImplementation(
            this.connection,
            config.implementationName,
            lockHandle,
          );
          this.lockTracker.untrack(config.implementationName);
        } catch (unlockError) {
          this.logger?.warn?.(
            'Failed to unlock during cleanup:',
            safeErrorMessage(unlockError),
          );
        }
      }
      this.logger?.error('UpdateMetadata failed:', safeErrorMessage(error));
      throw error;
    } finally {
      this.connection.setSessionType('stateless');
    }
  }

  async delete(
    config: Partial<IScalarFunctionImplementationConfig>,
  ): Promise<IScalarFunctionImplementationState> {
    if (!config.implementationName)
      throw new Error('Implementation name is required');
    try {
      await checkDeletion(this.connection, {
        implementation_name: config.implementationName,
        transport_request: config.transportRequest,
      });
      const deleteResult = await deleteScalarFunctionImplementation(
        this.connection,
        {
          implementation_name: config.implementationName,
          transport_request: config.transportRequest,
        },
      );
      return { deleteResult, errors: [] };
    } catch (error) {
      this.logger?.error('Delete failed:', safeErrorMessage(error));
      throw error;
    }
  }

  async activate(
    config: Partial<IScalarFunctionImplementationConfig>,
  ): Promise<IScalarFunctionImplementationState> {
    if (!config.implementationName)
      throw new Error('Implementation name is required');
    const result = await activateScalarFunctionImplementation(
      this.connection,
      config.implementationName,
    );
    return { activateResult: result, errors: [] };
  }

  async check(
    config: Partial<IScalarFunctionImplementationConfig>,
    status?: string,
  ): Promise<IScalarFunctionImplementationState> {
    if (!config.implementationName)
      throw new Error('Implementation name is required');
    const version = status === 'active' ? 'active' : 'inactive';
    const checkResult = await checkScalarFunctionImplementation(
      this.connection,
      config.implementationName,
      version,
    );
    return { checkResult, errors: [] };
  }

  async lock(
    config: Partial<IScalarFunctionImplementationConfig>,
  ): Promise<string> {
    if (!config.implementationName)
      throw new Error('Implementation name is required');
    this.connection.setSessionType('stateful');
    const lockHandle = await lockScalarFunctionImplementation(
      this.connection,
      config.implementationName,
    );
    this.lockTracker.track(config.implementationName, lockHandle);
    return lockHandle;
  }

  async unlock(
    config: Partial<IScalarFunctionImplementationConfig>,
    lockHandle: string,
  ): Promise<IScalarFunctionImplementationState> {
    if (!config.implementationName)
      throw new Error('Implementation name is required');
    this.connection.setSessionType('stateful');
    try {
      const unlockResult = await unlockScalarFunctionImplementation(
        this.connection,
        config.implementationName,
        lockHandle,
      );
      this.lockTracker.untrack(config.implementationName);
      return { unlockResult, errors: [] };
    } finally {
      this.connection.setSessionType('stateless');
    }
  }

  getVersions(config: Partial<IScalarFunctionImplementationConfig>) {
    return getScalarFunctionImplementationVersions(this.connection, config);
  }

  getVersionSource(contentUri: string) {
    return getScalarFunctionImplementationVersionSource(
      this.connection,
      contentUri,
    );
  }
}

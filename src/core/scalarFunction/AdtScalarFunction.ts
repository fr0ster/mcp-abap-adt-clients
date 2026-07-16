/**
 * AdtScalarFunction - High-level CRUD for CDS scalar functions (DSFD/SCF).
 * Mirrors AdtServiceDefinition; create() is metadata-only, source via update().
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
import { activateScalarFunction } from './activation';
import { checkScalarFunction } from './check';
import { create as createScalarFunction } from './create';
import { checkDeletion, deleteScalarFunction } from './delete';
import { lockScalarFunction } from './lock';
import {
  getScalarFunction,
  getScalarFunctionSource,
  getScalarFunctionTransport,
} from './read';
import type { IScalarFunctionConfig, IScalarFunctionState } from './types';
import { unlockScalarFunction } from './unlock';
import { updateScalarFunction } from './update';
import { validateScalarFunctionName } from './validation';

const VALIDATION_UNSUPPORTED_STATUSES = new Set([404, 405, 501]);

import {
  getScalarFunctionVersionSource,
  getScalarFunctionVersions,
} from './versions';
export class AdtScalarFunction
  implements IAdtObject<IScalarFunctionConfig, IScalarFunctionState>
{
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  private readonly systemContext: IAdtSystemContext;
  private readonly lockTracker: LockTracker;
  public readonly objectType: string = 'ScalarFunction';

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
      async (name, lockHandle) => {
        this.connection.setSessionType('stateful');
        try {
          await unlockScalarFunction(this.connection, name, lockHandle);
        } finally {
          this.connection.setSessionType('stateless');
        }
      },
    );
  }

  async validate(
    config: Partial<IScalarFunctionConfig>,
  ): Promise<IScalarFunctionState> {
    const state: IScalarFunctionState = { errors: [] };
    if (!config.scalarFunctionName) {
      const error = new Error(
        'Scalar function name is required for validation',
      );
      state.errors.push({ method: 'validate', error, timestamp: new Date() });
      throw error;
    }
    try {
      state.validationResponse = await validateScalarFunctionName(
        this.connection,
        config.scalarFunctionName,
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
    config: IScalarFunctionConfig,
    _options?: IAdtOperationOptions,
  ): Promise<IScalarFunctionState> {
    const state: IScalarFunctionState = { errors: [] };
    if (!config.scalarFunctionName)
      throw new Error('Scalar function name is required');
    if (!config.packageName) throw new Error('Package name is required');
    if (!config.description) throw new Error('Description is required');
    try {
      state.createResult = await createScalarFunction(this.connection, {
        scalar_function_name: config.scalarFunctionName,
        package_name: config.packageName,
        transport_request: config.transportRequest,
        description: config.description,
        masterSystem: this.systemContext.masterSystem,
        responsible: this.systemContext.responsible,
        masterLanguage:
          config.masterLanguage ?? this.systemContext.masterLanguage,
      });
      return state;
    } catch (error) {
      this.logger?.error('Create failed:', safeErrorMessage(error));
      throw error;
    }
  }

  async read(
    config: Partial<IScalarFunctionConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions,
  ): Promise<IScalarFunctionState | undefined> {
    if (!config.scalarFunctionName)
      throw new Error('Scalar function name is required');
    try {
      const response = await getScalarFunctionSource(
        this.connection,
        config.scalarFunctionName,
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
    config: Partial<IScalarFunctionConfig>,
    options?: IReadOptions,
  ): Promise<IScalarFunctionState> {
    if (!config.scalarFunctionName)
      throw new Error('Scalar function name is required');
    const response = await getScalarFunction(
      this.connection,
      config.scalarFunctionName,
      'inactive',
      options,
      this.logger,
    );
    return { metadataResult: response, errors: [] };
  }

  async readTransport(
    config: Partial<IScalarFunctionConfig>,
    options?: { withLongPolling?: boolean },
  ): Promise<IScalarFunctionState> {
    if (!config.scalarFunctionName)
      throw new Error('Scalar function name is required');
    const response = await getScalarFunctionTransport(
      this.connection,
      config.scalarFunctionName,
      options?.withLongPolling !== undefined
        ? { withLongPolling: options.withLongPolling }
        : undefined,
    );
    return { transportResult: response, errors: [] };
  }

  async update(
    config: Partial<IScalarFunctionConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IScalarFunctionState> {
    if (!config.scalarFunctionName)
      throw new Error('Scalar function name is required');

    if (options?.lockHandle) {
      const codeToUpdate = options?.sourceCode || config.sourceCode;
      if (!codeToUpdate) throw new Error('Source code is required for update');
      const updateResult = await updateScalarFunction(
        this.connection,
        {
          scalar_function_name: config.scalarFunctionName,
          source_code: codeToUpdate,
          transport_request: config.transportRequest,
        },
        options.lockHandle,
      );
      return { updateResult, errors: [] };
    }

    let lockHandle: string | undefined;
    try {
      this.connection.setSessionType('stateful');
      lockHandle = await lockScalarFunction(
        this.connection,
        config.scalarFunctionName,
      );
      this.lockTracker.track(config.scalarFunctionName, lockHandle);

      const codeToCheck = options?.sourceCode || config.sourceCode;
      if (codeToCheck) {
        await checkScalarFunction(
          this.connection,
          config.scalarFunctionName,
          'inactive',
          codeToCheck,
        );
        await updateScalarFunction(
          this.connection,
          {
            scalar_function_name: config.scalarFunctionName,
            source_code: codeToCheck,
            transport_request: config.transportRequest,
          },
          lockHandle,
        );
        try {
          await this.read(
            { scalarFunctionName: config.scalarFunctionName },
            'active',
            { withLongPolling: true },
          );
        } catch (readError) {
          this.logger?.warn?.(
            'read with long polling failed (object may not be ready yet):',
            safeErrorMessage(readError),
          );
        }
      }

      if (lockHandle) {
        this.connection.setSessionType('stateful');
        try {
          await unlockScalarFunction(
            this.connection,
            config.scalarFunctionName,
            lockHandle,
          );
        } finally {
          this.connection.setSessionType('stateless');
        }
        this.lockTracker.untrack(config.scalarFunctionName);
        lockHandle = undefined;
      }

      await checkScalarFunction(
        this.connection,
        config.scalarFunctionName,
        'inactive',
      );

      if (options?.activateOnUpdate) {
        const activateResult = await activateScalarFunction(
          this.connection,
          config.scalarFunctionName,
        );
        try {
          await this.read(
            { scalarFunctionName: config.scalarFunctionName },
            'active',
            { withLongPolling: true },
          );
        } catch (readError) {
          this.logger?.warn?.(
            'read with long polling failed (object may not be ready yet):',
            safeErrorMessage(readError),
          );
        }
        return { activateResult, errors: [] };
      }

      const readResult = await getScalarFunctionSource(
        this.connection,
        config.scalarFunctionName,
      );
      return { readResult, errors: [] };
    } catch (error) {
      if (lockHandle) {
        try {
          this.connection.setSessionType('stateful');
          await unlockScalarFunction(
            this.connection,
            config.scalarFunctionName,
            lockHandle,
          );
          this.lockTracker.untrack(config.scalarFunctionName);
        } catch (unlockError) {
          this.logger?.warn?.(
            'Failed to unlock during cleanup:',
            safeErrorMessage(unlockError),
          );
        } finally {
          this.connection.setSessionType('stateless');
        }
      } else {
        this.connection.setSessionType('stateless');
      }
      if (options?.deleteOnFailure) {
        try {
          await deleteScalarFunction(this.connection, {
            scalar_function_name: config.scalarFunctionName,
            transport_request: config.transportRequest,
          });
        } catch (deleteError) {
          this.logger?.warn?.(
            'Failed to delete after failure:',
            safeErrorMessage(deleteError),
          );
        }
      }
      this.logger?.error('Update failed:', safeErrorMessage(error));
      throw error;
    }
  }

  async delete(
    config: Partial<IScalarFunctionConfig>,
  ): Promise<IScalarFunctionState> {
    if (!config.scalarFunctionName)
      throw new Error('Scalar function name is required');
    try {
      await checkDeletion(this.connection, {
        scalar_function_name: config.scalarFunctionName,
        transport_request: config.transportRequest,
      });
      const deleteResult = await deleteScalarFunction(this.connection, {
        scalar_function_name: config.scalarFunctionName,
        transport_request: config.transportRequest,
      });
      return { deleteResult, errors: [] };
    } catch (error) {
      this.logger?.error('Delete failed:', safeErrorMessage(error));
      throw error;
    }
  }

  async activate(
    config: Partial<IScalarFunctionConfig>,
  ): Promise<IScalarFunctionState> {
    if (!config.scalarFunctionName)
      throw new Error('Scalar function name is required');
    const result = await activateScalarFunction(
      this.connection,
      config.scalarFunctionName,
    );
    return { activateResult: result, errors: [] };
  }

  async check(
    config: Partial<IScalarFunctionConfig>,
    status?: string,
  ): Promise<IScalarFunctionState> {
    if (!config.scalarFunctionName)
      throw new Error('Scalar function name is required');
    const version = status === 'active' ? 'active' : 'inactive';
    const checkResult = await checkScalarFunction(
      this.connection,
      config.scalarFunctionName,
      version,
    );
    return { checkResult, errors: [] };
  }

  async lock(config: Partial<IScalarFunctionConfig>): Promise<string> {
    if (!config.scalarFunctionName)
      throw new Error('Scalar function name is required');
    this.connection.setSessionType('stateful');
    const lockHandle = await lockScalarFunction(
      this.connection,
      config.scalarFunctionName,
    );
    this.lockTracker.track(config.scalarFunctionName, lockHandle);
    return lockHandle;
  }

  async unlock(
    config: Partial<IScalarFunctionConfig>,
    lockHandle: string,
  ): Promise<IScalarFunctionState> {
    if (!config.scalarFunctionName)
      throw new Error('Scalar function name is required');
    this.connection.setSessionType('stateful');
    try {
      const unlockResult = await unlockScalarFunction(
        this.connection,
        config.scalarFunctionName,
        lockHandle,
      );
      this.lockTracker.untrack(config.scalarFunctionName);
      return { unlockResult, errors: [] };
    } finally {
      this.connection.setSessionType('stateless');
    }
  }

  getVersions(config: Partial<IScalarFunctionConfig>) {
    return getScalarFunctionVersions(this.connection, config);
  }

  getVersionSource(contentUri: string) {
    return getScalarFunctionVersionSource(this.connection, contentUri);
  }
}

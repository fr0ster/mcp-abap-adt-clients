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
import { validateScalarFunctionImplementationName } from './validation';

const VALIDATION_UNSUPPORTED_STATUSES = new Set([404, 405, 501]);

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
  public readonly objectType: string = 'ScalarFunctionImplementation';

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
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

  async update(
    config: Partial<IScalarFunctionImplementationConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IScalarFunctionImplementationState> {
    if (!config.implementationName)
      throw new Error('Implementation name is required');

    if (options?.lockHandle) {
      const codeToUpdate = options?.sourceCode || config.sourceCode;
      if (!codeToUpdate) throw new Error('Source code is required for update');
      const updateResult = await updateScalarFunctionImplementation(
        this.connection,
        {
          implementation_name: config.implementationName,
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
      lockHandle = await lockScalarFunctionImplementation(
        this.connection,
        config.implementationName,
      );

      const codeToCheck = options?.sourceCode || config.sourceCode;
      if (codeToCheck) {
        await checkScalarFunctionImplementation(
          this.connection,
          config.implementationName,
          'inactive',
          codeToCheck,
        );
        await updateScalarFunctionImplementation(
          this.connection,
          {
            implementation_name: config.implementationName,
            source_code: codeToCheck,
            transport_request: config.transportRequest,
          },
          lockHandle,
        );
        try {
          await this.read(
            { implementationName: config.implementationName },
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
          await unlockScalarFunctionImplementation(
            this.connection,
            config.implementationName,
            lockHandle,
          );
        } finally {
          this.connection.setSessionType('stateless');
        }
        lockHandle = undefined;
      }

      await checkScalarFunctionImplementation(
        this.connection,
        config.implementationName,
        'inactive',
      );

      if (options?.activateOnUpdate) {
        const activateResult = await activateScalarFunctionImplementation(
          this.connection,
          config.implementationName,
        );
        try {
          await this.read(
            { implementationName: config.implementationName },
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

      const readResult = await getScalarFunctionImplementationSource(
        this.connection,
        config.implementationName,
      );
      return { readResult, errors: [] };
    } catch (error) {
      if (lockHandle) {
        try {
          this.connection.setSessionType('stateful');
          await unlockScalarFunctionImplementation(
            this.connection,
            config.implementationName,
            lockHandle,
          );
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
          await deleteScalarFunctionImplementation(this.connection, {
            implementation_name: config.implementationName,
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
    return lockScalarFunctionImplementation(
      this.connection,
      config.implementationName,
    );
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
      return { unlockResult, errors: [] };
    } finally {
      this.connection.setSessionType('stateless');
    }
  }
}

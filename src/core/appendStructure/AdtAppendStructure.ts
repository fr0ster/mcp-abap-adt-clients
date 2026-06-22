/**
 * AdtAppendStructure - High-level CRUD for append structures (TABL/DS).
 * create() is metadata-only (requires baseObject); source via update().
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
import { activateAppendStructure } from './activation';
import { checkAppendStructure } from './check';
import { create as createAppendStructure } from './create';
import { checkDeletion, deleteAppendStructure } from './delete';
import { lockAppendStructure } from './lock';
import {
  getAppendStructure,
  getAppendStructureSource,
  getAppendStructureTransport,
} from './read';
import type { IAppendStructureConfig, IAppendStructureState } from './types';
import { unlockAppendStructure } from './unlock';
import { updateAppendStructure } from './update';
import { validateAppendStructureName } from './validation';

const VALIDATION_UNSUPPORTED_STATUSES = new Set([404, 405, 501]);

export class AdtAppendStructure
  implements IAdtObject<IAppendStructureConfig, IAppendStructureState>
{
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  private readonly systemContext: IAdtSystemContext;
  public readonly objectType: string = 'AppendStructure';

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
    config: Partial<IAppendStructureConfig>,
  ): Promise<IAppendStructureState> {
    const state: IAppendStructureState = { errors: [] };
    if (!config.appendStructureName) {
      const error = new Error(
        'Append structure name is required for validation',
      );
      state.errors.push({ method: 'validate', error, timestamp: new Date() });
      throw error;
    }
    try {
      state.validationResponse = await validateAppendStructureName(
        this.connection,
        config.appendStructureName,
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
    config: IAppendStructureConfig,
    _options?: IAdtOperationOptions,
  ): Promise<IAppendStructureState> {
    const state: IAppendStructureState = { errors: [] };
    if (!config.appendStructureName)
      throw new Error('Append structure name is required');
    if (!config.baseObject) throw new Error('Base object is required');
    if (!config.packageName) throw new Error('Package name is required');
    if (!config.description) throw new Error('Description is required');
    try {
      state.createResult = await createAppendStructure(this.connection, {
        append_structure_name: config.appendStructureName,
        base_object: config.baseObject,
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
    config: Partial<IAppendStructureConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions,
  ): Promise<IAppendStructureState | undefined> {
    if (!config.appendStructureName)
      throw new Error('Append structure name is required');
    try {
      const response = await getAppendStructureSource(
        this.connection,
        config.appendStructureName,
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
    config: Partial<IAppendStructureConfig>,
    options?: IReadOptions,
  ): Promise<IAppendStructureState> {
    if (!config.appendStructureName)
      throw new Error('Append structure name is required');
    const response = await getAppendStructure(
      this.connection,
      config.appendStructureName,
      'inactive',
      options,
      this.logger,
    );
    return { metadataResult: response, errors: [] };
  }

  async readTransport(
    config: Partial<IAppendStructureConfig>,
    options?: { withLongPolling?: boolean },
  ): Promise<IAppendStructureState> {
    if (!config.appendStructureName)
      throw new Error('Append structure name is required');
    const response = await getAppendStructureTransport(
      this.connection,
      config.appendStructureName,
      options?.withLongPolling !== undefined
        ? { withLongPolling: options.withLongPolling }
        : undefined,
    );
    return { transportResult: response, errors: [] };
  }

  async update(
    config: Partial<IAppendStructureConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAppendStructureState> {
    if (!config.appendStructureName)
      throw new Error('Append structure name is required');

    if (options?.lockHandle) {
      const codeToUpdate = options?.sourceCode || config.sourceCode;
      if (!codeToUpdate) throw new Error('Source code is required for update');
      const updateResult = await updateAppendStructure(
        this.connection,
        {
          append_structure_name: config.appendStructureName,
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
      lockHandle = await lockAppendStructure(
        this.connection,
        config.appendStructureName,
      );

      const codeToCheck = options?.sourceCode || config.sourceCode;
      if (codeToCheck) {
        await checkAppendStructure(
          this.connection,
          config.appendStructureName,
          'inactive',
          codeToCheck,
        );
        await updateAppendStructure(
          this.connection,
          {
            append_structure_name: config.appendStructureName,
            source_code: codeToCheck,
            transport_request: config.transportRequest,
          },
          lockHandle,
        );
      }

      if (lockHandle) {
        this.connection.setSessionType('stateful');
        try {
          await unlockAppendStructure(
            this.connection,
            config.appendStructureName,
            lockHandle,
          );
        } finally {
          this.connection.setSessionType('stateless');
        }
        lockHandle = undefined;
      }

      await checkAppendStructure(
        this.connection,
        config.appendStructureName,
        'inactive',
      );

      if (options?.activateOnUpdate) {
        const activateResult = await activateAppendStructure(
          this.connection,
          config.appendStructureName,
        );
        return { activateResult, errors: [] };
      }

      const readResult = await getAppendStructureSource(
        this.connection,
        config.appendStructureName,
      );
      return { readResult, errors: [] };
    } catch (error) {
      if (lockHandle) {
        try {
          this.connection.setSessionType('stateful');
          await unlockAppendStructure(
            this.connection,
            config.appendStructureName,
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
          await deleteAppendStructure(this.connection, {
            append_structure_name: config.appendStructureName,
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
    config: Partial<IAppendStructureConfig>,
  ): Promise<IAppendStructureState> {
    if (!config.appendStructureName)
      throw new Error('Append structure name is required');
    try {
      await checkDeletion(this.connection, {
        append_structure_name: config.appendStructureName,
        transport_request: config.transportRequest,
      });
      const deleteResult = await deleteAppendStructure(this.connection, {
        append_structure_name: config.appendStructureName,
        transport_request: config.transportRequest,
      });
      return { deleteResult, errors: [] };
    } catch (error) {
      this.logger?.error('Delete failed:', safeErrorMessage(error));
      throw error;
    }
  }

  async activate(
    config: Partial<IAppendStructureConfig>,
  ): Promise<IAppendStructureState> {
    if (!config.appendStructureName)
      throw new Error('Append structure name is required');
    const result = await activateAppendStructure(
      this.connection,
      config.appendStructureName,
    );
    return { activateResult: result, errors: [] };
  }

  async check(
    config: Partial<IAppendStructureConfig>,
    status?: string,
  ): Promise<IAppendStructureState> {
    if (!config.appendStructureName)
      throw new Error('Append structure name is required');
    const version = status === 'active' ? 'active' : 'inactive';
    const checkResult = await checkAppendStructure(
      this.connection,
      config.appendStructureName,
      version,
    );
    return { checkResult, errors: [] };
  }

  async lock(config: Partial<IAppendStructureConfig>): Promise<string> {
    if (!config.appendStructureName)
      throw new Error('Append structure name is required');
    this.connection.setSessionType('stateful');
    return lockAppendStructure(this.connection, config.appendStructureName);
  }

  async unlock(
    config: Partial<IAppendStructureConfig>,
    lockHandle: string,
  ): Promise<IAppendStructureState> {
    if (!config.appendStructureName)
      throw new Error('Append structure name is required');
    this.connection.setSessionType('stateful');
    try {
      const unlockResult = await unlockAppendStructure(
        this.connection,
        config.appendStructureName,
        lockHandle,
      );
      return { unlockResult, errors: [] };
    } finally {
      this.connection.setSessionType('stateless');
    }
  }
}

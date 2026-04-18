/**
 * AdtAuthorizationField - High-level CRUD operations for SUSO / AUTH objects
 *
 * Implements IAdtObject with automatic operation chains, error handling,
 * and resource cleanup.
 *
 * Session management:
 * - stateful: only when doing lock / unlock
 * - stateless: obligatory after unlock
 * - activate uses the same session / cookies (no stateful required)
 *
 * Operation chains:
 * - Create: validate (caller) → create
 * - Update: lock → check(inactive, xmlContent?) → update → read(longPolling) → unlock → check(inactive) → optional activate + read
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
import { activateAuthorizationField } from './activation';
import { checkAuthorizationField } from './check';
import { create as createAuthorizationField } from './create';
import {
  checkDeletion,
  deleteAuthorizationField,
  type IDeleteAuthorizationFieldParams,
} from './delete';
import { lockAuthorizationField } from './lock';
import { type IReadOptions, readAuthorizationField } from './read';
import type {
  IAuthorizationFieldConfig,
  IAuthorizationFieldState,
  ICreateAuthorizationFieldParams,
} from './types';
import { unlockAuthorizationField } from './unlock';
import { updateAuthorizationField } from './update';
import { validateAuthorizationFieldName } from './validation';

export class AdtAuthorizationField
  implements IAdtObject<IAuthorizationFieldConfig, IAuthorizationFieldState>
{
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  private readonly systemContext: IAdtSystemContext;
  public readonly objectType: string = 'AuthorizationField';

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
   * Map camelCase config to the snake_case low-level params the functions expect.
   * Kept private — callers should always go through the handler.
   */
  private buildCreateParams(
    config: IAuthorizationFieldConfig,
  ): ICreateAuthorizationFieldParams {
    return {
      authorization_field_name: config.authorizationFieldName,
      description: config.description,
      package_name: config.packageName ?? '',
      transport_request: config.transportRequest,
      master_system: config.masterSystem ?? this.systemContext.masterSystem,
      responsible: config.responsible ?? this.systemContext.responsible,
      field_name: config.fieldName,
      roll_name: config.rollName,
      check_table: config.checkTable,
      exit_fb: config.exitFb,
      abap_language_version: config.abapLanguageVersion,
      search: config.search,
      objexit: config.objexit,
      domname: config.domname,
      outputlen: config.outputlen,
      convexit: config.convexit,
      orglvlinfo: config.orglvlinfo,
      col_searchhelp: config.colSearchhelp,
      col_searchhelp_name: config.colSearchhelpName,
      col_searchhelp_descr: config.colSearchhelpDescr,
    };
  }

  private buildDeleteParams(
    config: Partial<IAuthorizationFieldConfig>,
  ): IDeleteAuthorizationFieldParams {
    return {
      authorization_field_name: config.authorizationFieldName ?? '',
      transport_request: config.transportRequest,
    };
  }

  /**
   * Validate authorization field name against SAP naming rules.
   */
  async validate(
    config: Partial<IAuthorizationFieldConfig>,
  ): Promise<IAuthorizationFieldState> {
    if (!config.authorizationFieldName) {
      throw new Error('Authorization field name is required for validation');
    }

    const validationResponse = await validateAuthorizationFieldName(
      this.connection,
      config.authorizationFieldName,
      config.packageName,
      config.description,
    );

    return {
      validationResponse,
      errors: [],
    };
  }

  /**
   * Create authorization field.
   */
  async create(
    config: IAuthorizationFieldConfig,
    options?: IAdtOperationOptions,
  ): Promise<IAuthorizationFieldState> {
    if (!config.authorizationFieldName) {
      throw new Error('Authorization field name is required');
    }
    if (!config.packageName) {
      throw new Error('Package name is required');
    }
    if (!config.description) {
      throw new Error('Description is required');
    }

    let objectCreated = false;
    const state: IAuthorizationFieldState = { errors: [] };

    try {
      this.logger?.info?.('Creating authorization field');
      const createResponse = await createAuthorizationField(
        this.connection,
        this.buildCreateParams(config),
      );
      state.createResult = createResponse;
      objectCreated = true;
      this.logger?.info?.('Authorization field created');

      return state;
    } catch (error: unknown) {
      this.connection.setSessionType('stateless');

      if (objectCreated && options?.deleteOnFailure) {
        try {
          this.logger?.warn?.('Deleting authorization field after failure');
          await deleteAuthorizationField(
            this.connection,
            this.buildDeleteParams(config),
          );
        } catch (deleteError) {
          this.logger?.warn?.(
            'Failed to delete authorization field after failure:',
            safeErrorMessage(deleteError),
          );
        }
      }

      this.logger?.error('Create failed:', safeErrorMessage(error));
      throw error;
    }
  }

  /**
   * Read authorization field metadata.
   */
  async read(
    config: Partial<IAuthorizationFieldConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions,
  ): Promise<IAuthorizationFieldState | undefined> {
    if (!config.authorizationFieldName) {
      throw new Error('Authorization field name is required');
    }

    try {
      const response = await readAuthorizationField(
        this.connection,
        config.authorizationFieldName,
        version ?? 'active',
        options,
      );
      return {
        readResult: response,
        errors: [],
      };
    } catch (error: unknown) {
      const e = error as HttpError;
      if (e.response?.status === 404) {
        return undefined;
      }
      this.logger?.error('Read failed:', safeErrorMessage(error));
      throw error;
    }
  }

  /**
   * Read metadata — for metadata-only objects, read() already returns it.
   */
  async readMetadata(
    config: Partial<IAuthorizationFieldConfig>,
    options?: IReadOptions & { version?: 'active' | 'inactive' },
  ): Promise<IAuthorizationFieldState> {
    const state: IAuthorizationFieldState = { errors: [] };
    if (!config.authorizationFieldName) {
      const error = new Error('Authorization field name is required');
      state.errors.push({
        method: 'readMetadata',
        error,
        timestamp: new Date(),
      });
      throw error;
    }
    try {
      const readState = await this.read(
        config,
        options?.version ?? 'active',
        options,
      );
      if (readState) {
        state.metadataResult = readState.readResult;
        state.readResult = readState.readResult;
      } else {
        const error = new Error(
          `Authorization field '${config.authorizationFieldName}' not found`,
        );
        state.errors.push({
          method: 'readMetadata',
          error,
          timestamp: new Date(),
        });
        throw error;
      }
      this.logger?.info?.('Authorization field metadata read successfully');
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
   * Update authorization field with full operation chain.
   */
  async update(
    config: Partial<IAuthorizationFieldConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAuthorizationFieldState> {
    if (!config.authorizationFieldName) {
      throw new Error('Authorization field name is required');
    }
    if (!config.packageName) {
      throw new Error('Package name is required for update');
    }

    const fullConfig: IAuthorizationFieldConfig = {
      ...(config as IAuthorizationFieldConfig),
    };
    const params = this.buildCreateParams(fullConfig);

    // Low-level mode: if lockHandle is provided, perform only update
    if (options?.lockHandle) {
      this.logger?.info?.(
        'Low-level update: performing update only (lockHandle provided)',
      );
      await updateAuthorizationField(
        this.connection,
        params,
        options.lockHandle,
        this.logger,
      );
      this.logger?.info?.('Authorization field updated (low-level)');
      return { errors: [] };
    }

    let lockHandle: string | undefined;
    const state: IAuthorizationFieldState = { errors: [] };

    try {
      // 1. Lock
      this.logger?.info?.('Step 1: Locking authorization field');
      this.connection.setSessionType('stateful');
      lockHandle = await lockAuthorizationField(
        this.connection,
        fullConfig.authorizationFieldName,
        this.logger,
      );
      this.connection.setSessionType('stateless');
      state.lockHandle = lockHandle;
      fullConfig.onLock?.(lockHandle);
      this.logger?.info?.('Authorization field locked, handle:', lockHandle);

      // 2. Check inactive with XML for update (if provided)
      const xmlToCheck = options?.xmlContent;
      if (xmlToCheck) {
        this.logger?.info?.(
          'Step 2: Checking inactive version with update content',
        );
        const checkResponse = await checkAuthorizationField(
          this.connection,
          fullConfig.authorizationFieldName,
          'inactive',
          xmlToCheck,
        );
        state.checkResult = checkResponse;
        this.logger?.info?.('Check inactive with update content passed');
      }

      // 3. Update
      this.logger?.info?.('Step 3: Updating authorization field');
      await updateAuthorizationField(
        this.connection,
        params,
        lockHandle,
        this.logger,
      );
      this.logger?.info?.('Authorization field updated');

      // 3.5. Read with long polling to ensure object is ready after update
      this.logger?.info?.('read (wait for object ready after update)');
      try {
        await this.read(
          { authorizationFieldName: fullConfig.authorizationFieldName },
          'active',
          { withLongPolling: true },
        );
        this.logger?.info?.('object is ready after update');
      } catch (readError) {
        this.logger?.warn?.(
          'read with long polling failed after update:',
          safeErrorMessage(readError),
        );
      }

      // 4. Unlock
      this.logger?.info?.('Step 4: Unlocking authorization field');
      this.connection.setSessionType('stateful');
      await unlockAuthorizationField(
        this.connection,
        fullConfig.authorizationFieldName,
        lockHandle,
      );
      this.connection.setSessionType('stateless');
      lockHandle = undefined;
      this.logger?.info?.('Authorization field unlocked');

      // 5. Final check
      this.logger?.info?.('Step 5: Final check');
      const finalCheck = await checkAuthorizationField(
        this.connection,
        fullConfig.authorizationFieldName,
        'inactive',
      );
      state.checkResult = finalCheck;
      this.logger?.info?.('Final check passed');

      // 6. Activate (optional)
      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 6: Activating authorization field');
        const activateResponse = await activateAuthorizationField(
          this.connection,
          fullConfig.authorizationFieldName,
        );
        state.activateResult = activateResponse;
        this.logger?.info?.(
          'Authorization field activated, status:',
          activateResponse.status,
        );

        try {
          const readState = await this.read(
            { authorizationFieldName: fullConfig.authorizationFieldName },
            'active',
            { withLongPolling: true },
          );
          if (readState) {
            state.readResult = readState.readResult;
          }
          this.logger?.info?.('object is ready after activation');
        } catch (readError) {
          this.logger?.warn?.(
            'read with long polling failed after activation:',
            safeErrorMessage(readError),
          );
        }
      } else {
        const readResponse = await readAuthorizationField(
          this.connection,
          fullConfig.authorizationFieldName,
          'active',
        );
        state.readResult = readResponse;
      }

      return state;
    } catch (error: unknown) {
      // Error cleanup: try to unlock (lockHandle preserved for force unlock),
      // then make sure the session is stateless.
      if (lockHandle) {
        try {
          this.logger?.warn?.(
            'Unlocking authorization field during error cleanup',
          );
          this.connection.setSessionType('stateful');
          await unlockAuthorizationField(
            this.connection,
            fullConfig.authorizationFieldName,
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
        this.connection.setSessionType('stateless');
      }

      if (options?.deleteOnFailure) {
        try {
          this.logger?.warn?.('Deleting authorization field after failure');
          await deleteAuthorizationField(
            this.connection,
            this.buildDeleteParams(fullConfig),
          );
        } catch (deleteError) {
          this.logger?.warn?.(
            'Failed to delete authorization field after failure:',
            safeErrorMessage(deleteError),
          );
        }
      }

      this.logger?.error('Update failed:', safeErrorMessage(error));
      throw error;
    }
  }

  /**
   * Delete authorization field.
   */
  async delete(
    config: Partial<IAuthorizationFieldConfig>,
  ): Promise<IAuthorizationFieldState> {
    if (!config.authorizationFieldName) {
      throw new Error('Authorization field name is required');
    }

    const state: IAuthorizationFieldState = { errors: [] };

    try {
      this.logger?.info?.('Checking authorization field for deletion');
      const checkResponse = await checkDeletion(
        this.connection,
        this.buildDeleteParams(config),
      );
      state.checkResult = checkResponse;
      this.logger?.info?.('Deletion check passed');

      this.logger?.info?.('Deleting authorization field');
      const deleteResponse = await deleteAuthorizationField(
        this.connection,
        this.buildDeleteParams(config),
      );
      state.deleteResult = deleteResponse;
      this.logger?.info?.('Authorization field deleted');

      return state;
    } catch (error: unknown) {
      this.logger?.error('Delete failed:', safeErrorMessage(error));
      throw error;
    }
  }

  /**
   * Activate authorization field.
   */
  async activate(
    config: Partial<IAuthorizationFieldConfig>,
  ): Promise<IAuthorizationFieldState> {
    if (!config.authorizationFieldName) {
      throw new Error('Authorization field name is required');
    }

    const state: IAuthorizationFieldState = { errors: [] };

    try {
      const activateResponse = await activateAuthorizationField(
        this.connection,
        config.authorizationFieldName,
      );
      state.activateResult = activateResponse;
      return state;
    } catch (error: unknown) {
      this.logger?.error('Activate failed:', safeErrorMessage(error));
      throw error;
    }
  }

  /**
   * Check authorization field.
   */
  async check(
    config: Partial<IAuthorizationFieldConfig>,
    status?: string,
  ): Promise<IAuthorizationFieldState> {
    if (!config.authorizationFieldName) {
      throw new Error('Authorization field name is required');
    }

    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    const checkResponse = await checkAuthorizationField(
      this.connection,
      config.authorizationFieldName,
      version,
    );
    return {
      checkResult: checkResponse,
      errors: [],
    };
  }

  /**
   * Read transport info — not supported by the APS IAM endpoint yet.
   */
  async readTransport(): Promise<IAuthorizationFieldState> {
    const error = new Error(
      'readTransport is not supported for authorization fields',
    );
    return {
      errors: [{ method: 'readTransport', error, timestamp: new Date() }],
    };
  }

  /**
   * Lock authorization field for modification.
   */
  async lock(config: Partial<IAuthorizationFieldConfig>): Promise<string> {
    if (!config.authorizationFieldName) {
      throw new Error('Authorization field name is required');
    }

    this.connection.setSessionType('stateful');
    const lockHandle = await lockAuthorizationField(
      this.connection,
      config.authorizationFieldName,
      this.logger,
    );
    this.connection.setSessionType('stateless');
    return lockHandle;
  }

  /**
   * Unlock authorization field.
   */
  async unlock(
    config: Partial<IAuthorizationFieldConfig>,
    lockHandle: string,
  ): Promise<IAuthorizationFieldState> {
    if (!config.authorizationFieldName) {
      throw new Error('Authorization field name is required');
    }

    this.connection.setSessionType('stateful');
    await unlockAuthorizationField(
      this.connection,
      config.authorizationFieldName,
      lockHandle,
    );
    this.connection.setSessionType('stateless');
    return { errors: [] };
  }
}

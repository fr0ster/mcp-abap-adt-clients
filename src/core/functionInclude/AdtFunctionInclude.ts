/**
 * AdtFunctionInclude - High-level CRUD operations for Function Include (FUGR/I).
 *
 * Implements IAdtObject with automatic operation chains, error handling,
 * and resource cleanup.
 *
 * Session management:
 * - stateful: only when doing lock / unlock / source upload
 * - stateless: obligatory after unlock
 * - activate uses the same session / cookies (no stateful required)
 *
 * Operation chains:
 * - Create: validate (parent group) → create → (if sourceCode) lock → upload → unlock → activate
 * - Update: lock → check(inactive, sourceCode?) → updateMetadata → (optional sourceUpload) → read polling → unlock → check(inactive) → optional activate + read
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
import type { IAdtContentTypes } from '../shared/contentTypes';
import { activateFunctionInclude } from './activation';
import { checkFunctionInclude } from './check';
import { create as createFunctionInclude } from './create';
import {
  checkDeletion,
  deleteFunctionInclude,
  type IDeleteFunctionIncludeParams,
} from './delete';
import { lockFunctionInclude } from './lock';
import { type IReadOptions, readFunctionInclude } from './read';
import { readFunctionIncludeSource } from './readSource';
import type {
  ICreateFunctionIncludeParams,
  IFunctionIncludeConfig,
  IFunctionIncludeState,
} from './types';
import { unlockFunctionInclude } from './unlock';
import { updateFunctionInclude } from './update';
import { uploadFunctionIncludeSource } from './updateSource';
import { validateFunctionIncludeName } from './validation';

export class AdtFunctionInclude
  implements IAdtObject<IFunctionIncludeConfig, IFunctionIncludeState>
{
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  protected readonly systemContext: IAdtSystemContext;
  protected readonly contentTypes?: IAdtContentTypes;
  public readonly objectType: string = 'FunctionInclude';

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
    contentTypes?: IAdtContentTypes,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
    this.contentTypes = contentTypes;
  }

  /**
   * Map camelCase config to the snake_case low-level params.
   */
  private buildCreateParams(
    config: IFunctionIncludeConfig,
  ): ICreateFunctionIncludeParams {
    return {
      function_group_name: config.functionGroupName,
      include_name: config.includeName,
      description: config.description,
      transport_request: config.transportRequest,
      master_system: config.masterSystem ?? this.systemContext.masterSystem,
      responsible: config.responsible ?? this.systemContext.responsible,
      source_code: config.sourceCode,
    };
  }

  private buildDeleteParams(
    config: Partial<IFunctionIncludeConfig>,
  ): IDeleteFunctionIncludeParams {
    return {
      function_group_name: config.functionGroupName ?? '',
      include_name: config.includeName ?? '',
      transport_request: config.transportRequest,
    };
  }

  /**
   * Resolve source artifact content type — used both for the source-aware
   * checkrun payload and for the unicode flag of the source upload.
   */
  private sourceArtifactContentType(): string {
    return this.contentTypes?.sourceArtifactContentType() ?? 'text/plain';
  }

  private isUnicode(): boolean {
    return this.sourceArtifactContentType().includes('utf-8');
  }

  /**
   * Validate by probing parent function group's existence.
   */
  async validate(
    config: Partial<IFunctionIncludeConfig>,
  ): Promise<IFunctionIncludeState> {
    if (!config.functionGroupName) {
      throw new Error(
        'Function group name is required for function include validation',
      );
    }
    if (!config.includeName) {
      throw new Error(
        'Include name is required for function include validation',
      );
    }
    const validationResponse = await validateFunctionIncludeName(
      this.connection,
      config.functionGroupName,
      config.includeName,
    );
    return {
      validationResponse,
      errors: [],
    };
  }

  /**
   * Create function include (optionally uploading source and activating).
   */
  async create(
    config: IFunctionIncludeConfig,
    options?: IAdtOperationOptions,
  ): Promise<IFunctionIncludeState> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }
    if (!config.includeName) {
      throw new Error('Include name is required');
    }
    if (!config.description) {
      throw new Error('Description is required');
    }

    let objectCreated = false;
    let lockHandle: string | undefined;
    const state: IFunctionIncludeState = { errors: [] };

    try {
      // 0. Validate parent group existence
      this.logger?.info?.('Validating parent function group');
      await validateFunctionIncludeName(
        this.connection,
        config.functionGroupName,
        config.includeName,
      );

      // 1. Create include metadata
      this.logger?.info?.('Creating function include');
      const createResponse = await createFunctionInclude(
        this.connection,
        this.buildCreateParams(config),
      );
      state.createResult = createResponse;
      objectCreated = true;
      this.logger?.info?.('Function include created');

      // 2. Upload source (if provided)
      const sourceCode = options?.sourceCode || config.sourceCode;
      if (sourceCode) {
        this.logger?.info?.(
          'Step 2: Locking function include for source upload',
        );
        this.connection.setSessionType('stateful');
        lockHandle = await lockFunctionInclude(
          this.connection,
          config.functionGroupName,
          config.includeName,
          this.logger,
        );
        this.connection.setSessionType('stateless');
        state.lockHandle = lockHandle;
        config.onLock?.(lockHandle);

        this.logger?.info?.('Step 3: Uploading function include source');
        await uploadFunctionIncludeSource(
          this.connection,
          config.functionGroupName,
          config.includeName,
          sourceCode,
          lockHandle,
          this.isUnicode(),
          config.transportRequest,
        );

        this.logger?.info?.('Step 4: Unlocking function include');
        this.connection.setSessionType('stateful');
        await unlockFunctionInclude(
          this.connection,
          config.functionGroupName,
          config.includeName,
          lockHandle,
        );
        this.connection.setSessionType('stateless');
        lockHandle = undefined;

        this.logger?.info?.('Step 5: Activating function include');
        const activateResponse = await activateFunctionInclude(
          this.connection,
          config.functionGroupName,
          config.includeName,
        );
        state.activateResult = activateResponse;
      }

      return state;
    } catch (error: unknown) {
      // Error cleanup: unlock if still locked, then ensure stateless
      if (lockHandle) {
        try {
          this.logger?.warn?.(
            'Unlocking function include during error cleanup',
          );
          this.connection.setSessionType('stateful');
          await unlockFunctionInclude(
            this.connection,
            config.functionGroupName,
            config.includeName,
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

      if (objectCreated && options?.deleteOnFailure) {
        try {
          this.logger?.warn?.('Deleting function include after failure');
          await deleteFunctionInclude(
            this.connection,
            this.buildDeleteParams(config),
          );
        } catch (deleteError) {
          this.logger?.warn?.(
            'Failed to delete function include after failure:',
            safeErrorMessage(deleteError),
          );
        }
      }

      this.logger?.error('Create failed:', safeErrorMessage(error));
      throw error;
    }
  }

  /**
   * Read function include metadata.
   */
  async read(
    config: Partial<IFunctionIncludeConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions,
  ): Promise<IFunctionIncludeState | undefined> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }
    if (!config.includeName) {
      throw new Error('Include name is required');
    }

    try {
      const response = await readFunctionInclude(
        this.connection,
        config.functionGroupName,
        config.includeName,
        version ?? 'active',
        options,
      );
      return { readResult: response, errors: [] };
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
   * Read function include source code.
   */
  async readSource(
    config: Partial<IFunctionIncludeConfig>,
    version?: 'active' | 'inactive',
  ): Promise<IFunctionIncludeState | undefined> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }
    if (!config.includeName) {
      throw new Error('Include name is required');
    }

    try {
      const response = await readFunctionIncludeSource(
        this.connection,
        config.functionGroupName,
        config.includeName,
        version ?? 'active',
      );
      return { readResult: response, errors: [] };
    } catch (error: unknown) {
      const e = error as HttpError;
      if (e.response?.status === 404) {
        return undefined;
      }
      this.logger?.error('readSource failed:', safeErrorMessage(error));
      throw error;
    }
  }

  /**
   * Read metadata — for this object, read() already returns metadata.
   */
  async readMetadata(
    config: Partial<IFunctionIncludeConfig>,
    options?: IReadOptions & { version?: 'active' | 'inactive' },
  ): Promise<IFunctionIncludeState> {
    const state: IFunctionIncludeState = { errors: [] };
    if (!config.functionGroupName) {
      const error = new Error('Function group name is required');
      state.errors.push({
        method: 'readMetadata',
        error,
        timestamp: new Date(),
      });
      throw error;
    }
    if (!config.includeName) {
      const error = new Error('Include name is required');
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
          `Function include '${config.includeName}' not found in group '${config.functionGroupName}'`,
        );
        state.errors.push({
          method: 'readMetadata',
          error,
          timestamp: new Date(),
        });
        throw error;
      }
      this.logger?.info?.('Function include metadata read successfully');
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
   * Update function include with full operation chain.
   */
  async update(
    config: Partial<IFunctionIncludeConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IFunctionIncludeState> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }
    if (!config.includeName) {
      throw new Error('Include name is required');
    }

    const fullConfig: IFunctionIncludeConfig = {
      ...(config as IFunctionIncludeConfig),
    };
    const params = this.buildCreateParams(fullConfig);

    // Low-level mode: if lockHandle is provided, perform only update operation
    if (options?.lockHandle) {
      const codeToUpdate = options?.sourceCode || config.sourceCode;
      this.logger?.info?.(
        'Low-level update: performing update only (lockHandle provided)',
      );
      await updateFunctionInclude(
        this.connection,
        params,
        options.lockHandle,
        this.logger,
      );
      if (codeToUpdate) {
        await uploadFunctionIncludeSource(
          this.connection,
          fullConfig.functionGroupName,
          fullConfig.includeName,
          codeToUpdate,
          options.lockHandle,
          this.isUnicode(),
          fullConfig.transportRequest,
        );
      }
      this.logger?.info?.('Function include updated (low-level)');
      return { errors: [] };
    }

    let lockHandle: string | undefined;
    const state: IFunctionIncludeState = { errors: [] };

    try {
      // 1. Lock
      this.logger?.info?.('Step 1: Locking function include');
      this.connection.setSessionType('stateful');
      lockHandle = await lockFunctionInclude(
        this.connection,
        fullConfig.functionGroupName,
        fullConfig.includeName,
        this.logger,
      );
      this.connection.setSessionType('stateless');
      state.lockHandle = lockHandle;
      fullConfig.onLock?.(lockHandle);
      this.logger?.info?.('Function include locked, handle:', lockHandle);

      // 2. Check inactive with source code for update (if provided)
      const codeToCheck = options?.sourceCode || fullConfig.sourceCode;
      if (codeToCheck) {
        this.logger?.info?.(
          'Step 2: Checking inactive version with update content',
        );
        const checkResponse = await checkFunctionInclude(
          this.connection,
          fullConfig.functionGroupName,
          fullConfig.includeName,
          'inactive',
          codeToCheck,
          this.sourceArtifactContentType(),
        );
        state.checkResult = checkResponse;
        this.logger?.info?.('Check inactive with update content passed');
      }

      // 3. Update metadata
      this.logger?.info?.('Step 3: Updating function include metadata');
      await updateFunctionInclude(
        this.connection,
        params,
        lockHandle,
        this.logger,
      );

      // 3.5. Upload source if provided
      if (codeToCheck) {
        this.logger?.info?.('Step 3b: Uploading function include source');
        await uploadFunctionIncludeSource(
          this.connection,
          fullConfig.functionGroupName,
          fullConfig.includeName,
          codeToCheck,
          lockHandle,
          this.isUnicode(),
          fullConfig.transportRequest,
        );

        // Wait for object to be ready after update
        this.logger?.info?.('read (wait for object ready after update)');
        try {
          await this.read(
            {
              functionGroupName: fullConfig.functionGroupName,
              includeName: fullConfig.includeName,
            },
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
      }

      // 4. Unlock
      this.logger?.info?.('Step 4: Unlocking function include');
      this.connection.setSessionType('stateful');
      await unlockFunctionInclude(
        this.connection,
        fullConfig.functionGroupName,
        fullConfig.includeName,
        lockHandle,
      );
      this.connection.setSessionType('stateless');
      lockHandle = undefined;

      // 5. Final check
      this.logger?.info?.('Step 5: Final check');
      const finalCheck = await checkFunctionInclude(
        this.connection,
        fullConfig.functionGroupName,
        fullConfig.includeName,
        'inactive',
      );
      state.checkResult = finalCheck;

      // 6. Activate (optional)
      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 6: Activating function include');
        const activateResponse = await activateFunctionInclude(
          this.connection,
          fullConfig.functionGroupName,
          fullConfig.includeName,
        );
        state.activateResult = activateResponse;

        try {
          const readState = await this.read(
            {
              functionGroupName: fullConfig.functionGroupName,
              includeName: fullConfig.includeName,
            },
            'active',
            { withLongPolling: true },
          );
          if (readState) {
            state.readResult = readState.readResult;
          }
        } catch (readError) {
          this.logger?.warn?.(
            'read with long polling failed after activation:',
            safeErrorMessage(readError),
          );
        }
      } else {
        const readResponse = await readFunctionInclude(
          this.connection,
          fullConfig.functionGroupName,
          fullConfig.includeName,
          'active',
        );
        state.readResult = readResponse;
      }

      return state;
    } catch (error: unknown) {
      if (lockHandle) {
        try {
          this.logger?.warn?.(
            'Unlocking function include during error cleanup',
          );
          this.connection.setSessionType('stateful');
          await unlockFunctionInclude(
            this.connection,
            fullConfig.functionGroupName,
            fullConfig.includeName,
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
          this.logger?.warn?.('Deleting function include after failure');
          await deleteFunctionInclude(
            this.connection,
            this.buildDeleteParams(fullConfig),
          );
        } catch (deleteError) {
          this.logger?.warn?.(
            'Failed to delete function include after failure:',
            safeErrorMessage(deleteError),
          );
        }
      }

      this.logger?.error('Update failed:', safeErrorMessage(error));
      throw error;
    }
  }

  /**
   * Delete function include.
   */
  async delete(
    config: Partial<IFunctionIncludeConfig>,
  ): Promise<IFunctionIncludeState> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }
    if (!config.includeName) {
      throw new Error('Include name is required');
    }

    const state: IFunctionIncludeState = { errors: [] };

    try {
      this.logger?.info?.('Checking function include for deletion');
      const checkResponse = await checkDeletion(
        this.connection,
        this.buildDeleteParams(config),
      );
      state.checkResult = checkResponse;
      this.logger?.info?.('Deletion check passed');

      this.logger?.info?.('Deleting function include');
      const deleteResponse = await deleteFunctionInclude(
        this.connection,
        this.buildDeleteParams(config),
      );
      state.deleteResult = deleteResponse;
      this.logger?.info?.('Function include deleted');

      return state;
    } catch (error: unknown) {
      this.logger?.error('Delete failed:', safeErrorMessage(error));
      throw error;
    }
  }

  /**
   * Activate function include.
   */
  async activate(
    config: Partial<IFunctionIncludeConfig>,
  ): Promise<IFunctionIncludeState> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }
    if (!config.includeName) {
      throw new Error('Include name is required');
    }

    const state: IFunctionIncludeState = { errors: [] };
    try {
      const activateResponse = await activateFunctionInclude(
        this.connection,
        config.functionGroupName,
        config.includeName,
      );
      state.activateResult = activateResponse;
      return state;
    } catch (error: unknown) {
      this.logger?.error('Activate failed:', safeErrorMessage(error));
      throw error;
    }
  }

  /**
   * Check function include.
   */
  async check(
    config: Partial<IFunctionIncludeConfig>,
    status?: string,
  ): Promise<IFunctionIncludeState> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }
    if (!config.includeName) {
      throw new Error('Include name is required');
    }

    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';
    const checkResponse = await checkFunctionInclude(
      this.connection,
      config.functionGroupName,
      config.includeName,
      version,
      config.sourceCode,
      this.sourceArtifactContentType(),
    );
    return { checkResult: checkResponse, errors: [] };
  }

  /**
   * Read transport info — not supported for FUGR/I (transport tracked at group level).
   */
  async readTransport(): Promise<IFunctionIncludeState> {
    const error = new Error(
      'readTransport is not supported for function includes (tracked at function group level)',
    );
    return {
      errors: [{ method: 'readTransport', error, timestamp: new Date() }],
    };
  }

  /**
   * Lock function include for modification.
   */
  async lock(config: Partial<IFunctionIncludeConfig>): Promise<string> {
    if (!config.functionGroupName || !config.includeName) {
      throw new Error('Function group name and include name are required');
    }

    this.connection.setSessionType('stateful');
    const lockHandle = await lockFunctionInclude(
      this.connection,
      config.functionGroupName,
      config.includeName,
      this.logger,
    );
    this.connection.setSessionType('stateless');
    return lockHandle;
  }

  /**
   * Unlock function include.
   */
  async unlock(
    config: Partial<IFunctionIncludeConfig>,
    lockHandle: string,
  ): Promise<IFunctionIncludeState> {
    if (!config.functionGroupName || !config.includeName) {
      throw new Error('Function group name and include name are required');
    }

    this.connection.setSessionType('stateful');
    await unlockFunctionInclude(
      this.connection,
      config.functionGroupName,
      config.includeName,
      lockHandle,
    );
    this.connection.setSessionType('stateless');
    return { errors: [] };
  }
}

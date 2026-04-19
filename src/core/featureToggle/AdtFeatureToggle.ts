/**
 * AdtFeatureToggle - High-level CRUD + lifecycle + runtime operations for
 * Feature Toggle (FTG2/FT) objects.
 *
 * Implements IFeatureToggleObject which extends IAdtObject with five
 * domain methods: switchOn, switchOff, getRuntimeState, checkState, readSource.
 *
 * Session management mirrors AdtAuthorizationField:
 * - stateful: only during lock / unlock
 * - stateless: obligatory after unlock and in error cleanup
 *
 * Source handling is JSON (IFeatureToggleSource), uploaded via
 * uploadFeatureToggleSource which stringifies internally.
 *
 * Operation chains:
 * - Create: create (+ optional source upload: lock → upload → unlock → activate)
 * - Update: lock → check(inactive, xmlContent?) → update → [uploadSource?] →
 *           read(longPolling) → unlock → check(inactive) → activate(optional) + read
 * - Delete: check(deletion) → delete
 */

import type {
  HttpError,
  IAbapConnection,
  IAdtOperationOptions,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IAdtSystemContext } from '../../clients/AdtClient';
import { safeErrorMessage } from '../../utils/internalUtils';
import { activateFeatureToggle } from './activation';
import { checkFeatureToggle } from './check';
import { checkFeatureToggleState } from './checkState';
import { create as createFeatureToggle } from './create';
import { checkDeletion, deleteFeatureToggle } from './delete';
import { getFeatureToggleState } from './getState';
import { lockFeatureToggle } from './lock';
import { type IReadOptions, readFeatureToggle } from './read';
import { readFeatureToggleSource } from './readSource';
import { toggleFeatureToggle } from './switch';
import type {
  ICreateFeatureToggleParams,
  IDeleteFeatureToggleParams,
  IFeatureToggleConfig,
  IFeatureToggleObject,
  IFeatureToggleSource,
  IFeatureToggleState,
} from './types';
import { unlockFeatureToggle } from './unlock';
import { updateFeatureToggle } from './update';
import { uploadFeatureToggleSource } from './updateSource';
import { validateFeatureToggleName } from './validation';

export class AdtFeatureToggle implements IFeatureToggleObject {
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  private readonly systemContext: IAdtSystemContext;
  public readonly objectType: string = 'FeatureToggle';

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
   * Map camelCase config to the snake_case low-level params.
   * `source` is passed through unchanged (it is a structured JSON object,
   * not a snake_case DTO).
   */
  private buildCreateParams(
    config: IFeatureToggleConfig,
  ): ICreateFeatureToggleParams {
    return {
      feature_toggle_name: config.featureToggleName,
      package_name: config.packageName ?? '',
      description: config.description,
      transport_request: config.transportRequest,
      master_system: config.masterSystem ?? this.systemContext.masterSystem,
      responsible: config.responsible ?? this.systemContext.responsible,
      source: config.source,
    };
  }

  private buildDeleteParams(
    config: Partial<IFeatureToggleConfig>,
  ): IDeleteFeatureToggleParams {
    return {
      feature_toggle_name: config.featureToggleName ?? '',
      transport_request: config.transportRequest,
    };
  }

  /**
   * Validate feature toggle name against SAP naming rules.
   */
  async validate(
    config: Partial<IFeatureToggleConfig>,
  ): Promise<IFeatureToggleState> {
    if (!config.featureToggleName) {
      throw new Error('Feature toggle name is required for validation');
    }

    const validationResponse = await validateFeatureToggleName(
      this.connection,
      config.featureToggleName,
      config.packageName,
      config.description,
    );

    return {
      validationResponse,
      errors: [],
    };
  }

  /**
   * Create feature toggle. If config.source is provided, follows up with a
   * source-upload sub-chain (lock → upload → unlock → activate).
   */
  async create(
    config: IFeatureToggleConfig,
    options?: IAdtOperationOptions,
  ): Promise<IFeatureToggleState> {
    if (!config.featureToggleName) {
      throw new Error('Feature toggle name is required');
    }
    if (!config.packageName) {
      throw new Error('Package name is required');
    }
    if (!config.description) {
      throw new Error('Description is required');
    }

    let objectCreated = false;
    let lockHandle: string | undefined;
    const state: IFeatureToggleState = { errors: [] };
    const params = this.buildCreateParams(config);

    try {
      this.logger?.info?.('Creating feature toggle');
      const createResponse = await createFeatureToggle(this.connection, params);
      state.createResult = createResponse;
      objectCreated = true;
      this.logger?.info?.('Feature toggle created');

      if (config.source) {
        this.logger?.info?.(
          'Source provided — running source-upload sub-chain',
        );

        // 1. Lock
        this.connection.setSessionType('stateful');
        lockHandle = await lockFeatureToggle(
          this.connection,
          config.featureToggleName,
          this.logger,
        );
        this.connection.setSessionType('stateless');
        state.lockHandle = lockHandle;
        config.onLock?.(lockHandle);
        this.logger?.info?.('Feature toggle locked, handle:', lockHandle);

        // 2. Upload source
        await uploadFeatureToggleSource(
          this.connection,
          config.featureToggleName,
          config.source,
          lockHandle,
          config.transportRequest,
        );
        this.logger?.info?.('Source uploaded');

        // 3. Unlock
        this.connection.setSessionType('stateful');
        await unlockFeatureToggle(
          this.connection,
          config.featureToggleName,
          lockHandle,
        );
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger?.info?.('Feature toggle unlocked');

        // 4. Activate
        const activateResponse = await activateFeatureToggle(
          this.connection,
          config.featureToggleName,
        );
        state.activateResult = activateResponse;
        this.logger?.info?.(
          'Feature toggle activated, status:',
          activateResponse.status,
        );
      }

      return state;
    } catch (error: unknown) {
      // Error cleanup: try to unlock (if captured), then stateless
      if (lockHandle) {
        try {
          this.logger?.warn?.(
            'Unlocking feature toggle during create error cleanup',
          );
          this.connection.setSessionType('stateful');
          await unlockFeatureToggle(
            this.connection,
            config.featureToggleName,
            lockHandle,
          );
        } catch (unlockError) {
          this.logger?.warn?.(
            'Failed to unlock during cleanup:',
            safeErrorMessage(unlockError),
          );
        }
      }
      this.connection.setSessionType('stateless');

      if (objectCreated && options?.deleteOnFailure) {
        try {
          this.logger?.warn?.('Deleting feature toggle after failure');
          await deleteFeatureToggle(
            this.connection,
            this.buildDeleteParams(config),
          );
        } catch (deleteError) {
          this.logger?.warn?.(
            'Failed to delete feature toggle after failure:',
            safeErrorMessage(deleteError),
          );
        }
      }

      this.logger?.error('Create failed:', safeErrorMessage(error));
      throw error;
    }
  }

  /**
   * Read feature toggle metadata XML.
   */
  async read(
    config: Partial<IFeatureToggleConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions,
  ): Promise<IFeatureToggleState | undefined> {
    if (!config.featureToggleName) {
      throw new Error('Feature toggle name is required');
    }

    try {
      const response = await readFeatureToggle(
        this.connection,
        config.featureToggleName,
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
   * Read metadata — feature-toggle GET returns the full metadata XML,
   * so this delegates to read().
   */
  async readMetadata(
    config: Partial<IFeatureToggleConfig>,
    options?: { withLongPolling?: boolean; version?: 'active' | 'inactive' },
  ): Promise<IFeatureToggleState> {
    const state: IFeatureToggleState = { errors: [] };
    if (!config.featureToggleName) {
      const error = new Error('Feature toggle name is required');
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
          `Feature toggle '${config.featureToggleName}' not found`,
        );
        state.errors.push({
          method: 'readMetadata',
          error,
          timestamp: new Date(),
        });
        throw error;
      }
      this.logger?.info?.('Feature toggle metadata read successfully');
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      // Avoid duplicate push if we already pushed above
      if (!state.errors.some((e) => e.error === err)) {
        state.errors.push({
          method: 'readMetadata',
          error: err,
          timestamp: new Date(),
        });
      }
      this.logger?.error('readMetadata', safeErrorMessage(err));
      throw err;
    }
  }

  /**
   * Update feature toggle with full operation chain.
   * When config.source is provided, uploads JSON source after metadata PUT.
   */
  async update(
    config: Partial<IFeatureToggleConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IFeatureToggleState> {
    if (!config.featureToggleName) {
      throw new Error('Feature toggle name is required');
    }
    if (!config.packageName) {
      throw new Error('Package name is required for update');
    }

    const fullConfig: IFeatureToggleConfig = {
      ...(config as IFeatureToggleConfig),
    };
    const params = this.buildCreateParams(fullConfig);

    // Low-level mode: if lockHandle is provided, perform only update + optional source upload
    if (options?.lockHandle) {
      this.logger?.info?.(
        'Low-level update: performing update only (lockHandle provided)',
      );
      await updateFeatureToggle(
        this.connection,
        params,
        options.lockHandle,
        this.logger,
      );
      if (fullConfig.source) {
        await uploadFeatureToggleSource(
          this.connection,
          fullConfig.featureToggleName,
          fullConfig.source,
          options.lockHandle,
          fullConfig.transportRequest,
        );
      }
      this.logger?.info?.('Feature toggle updated (low-level)');
      return { errors: [] };
    }

    let lockHandle: string | undefined;
    const state: IFeatureToggleState = { errors: [] };

    try {
      // 1. Lock
      this.logger?.info?.('Step 1: Locking feature toggle');
      this.connection.setSessionType('stateful');
      lockHandle = await lockFeatureToggle(
        this.connection,
        fullConfig.featureToggleName,
        this.logger,
      );
      this.connection.setSessionType('stateless');
      state.lockHandle = lockHandle;
      fullConfig.onLock?.(lockHandle);
      this.logger?.info?.('Feature toggle locked, handle:', lockHandle);

      // 2. Check inactive with XML for update (if provided)
      const xmlToCheck = options?.xmlContent;
      if (xmlToCheck) {
        this.logger?.info?.(
          'Step 2: Checking inactive version with update content',
        );
        const checkResponse = await checkFeatureToggle(
          this.connection,
          fullConfig.featureToggleName,
          'inactive',
          xmlToCheck,
        );
        state.checkResult = checkResponse;
        this.logger?.info?.('Check inactive with update content passed');
      }

      // 3. Update metadata
      this.logger?.info?.('Step 3: Updating feature toggle metadata');
      await updateFeatureToggle(
        this.connection,
        params,
        lockHandle,
        this.logger,
      );
      this.logger?.info?.('Feature toggle metadata updated');

      // 3.1. Upload source if provided
      if (fullConfig.source) {
        this.logger?.info?.('Step 3.1: Uploading feature toggle source');
        await uploadFeatureToggleSource(
          this.connection,
          fullConfig.featureToggleName,
          fullConfig.source,
          lockHandle,
          fullConfig.transportRequest,
        );
        this.logger?.info?.('Feature toggle source uploaded');
      }

      // 3.5. Read with long polling to ensure object is ready after update
      this.logger?.info?.('read (wait for object ready after update)');
      try {
        const readState = await this.read(
          { featureToggleName: fullConfig.featureToggleName },
          'active',
          { withLongPolling: true },
        );
        if (readState) {
          state.readResult = readState.readResult;
        }
        this.logger?.info?.('object is ready after update');
      } catch (readError) {
        this.logger?.warn?.(
          'read with long polling failed after update:',
          safeErrorMessage(readError),
        );
      }

      // 4. Unlock
      this.logger?.info?.('Step 4: Unlocking feature toggle');
      this.connection.setSessionType('stateful');
      await unlockFeatureToggle(
        this.connection,
        fullConfig.featureToggleName,
        lockHandle,
      );
      this.connection.setSessionType('stateless');
      lockHandle = undefined;
      this.logger?.info?.('Feature toggle unlocked');

      // 5. Final check
      this.logger?.info?.('Step 5: Final check');
      const finalCheck = await checkFeatureToggle(
        this.connection,
        fullConfig.featureToggleName,
        'inactive',
      );
      state.checkResult = finalCheck;
      this.logger?.info?.('Final check passed');

      // 6. Activate (optional)
      if (options?.activateOnUpdate && state.errors.length === 0) {
        this.logger?.info?.('Step 6: Activating feature toggle');
        const activateResponse = await activateFeatureToggle(
          this.connection,
          fullConfig.featureToggleName,
        );
        state.activateResult = activateResponse;
        this.logger?.info?.(
          'Feature toggle activated, status:',
          activateResponse.status,
        );

        try {
          const readState = await this.read(
            { featureToggleName: fullConfig.featureToggleName },
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
      }

      return state;
    } catch (error: unknown) {
      // Error cleanup: try to unlock (lockHandle preserved for force unlock),
      // then make sure the session is stateless.
      if (lockHandle) {
        try {
          this.logger?.warn?.('Unlocking feature toggle during error cleanup');
          this.connection.setSessionType('stateful');
          await unlockFeatureToggle(
            this.connection,
            fullConfig.featureToggleName,
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
          this.logger?.warn?.('Deleting feature toggle after failure');
          await deleteFeatureToggle(
            this.connection,
            this.buildDeleteParams(fullConfig),
          );
        } catch (deleteError) {
          this.logger?.warn?.(
            'Failed to delete feature toggle after failure:',
            safeErrorMessage(deleteError),
          );
        }
      }

      this.logger?.error('Update failed:', safeErrorMessage(error));
      throw error;
    }
  }

  /**
   * Delete feature toggle.
   */
  async delete(
    config: Partial<IFeatureToggleConfig>,
  ): Promise<IFeatureToggleState> {
    if (!config.featureToggleName) {
      throw new Error('Feature toggle name is required');
    }

    const state: IFeatureToggleState = { errors: [] };

    try {
      this.logger?.info?.('Checking feature toggle for deletion');
      const checkResponse = await checkDeletion(
        this.connection,
        this.buildDeleteParams(config),
      );
      state.checkResult = checkResponse;
      this.logger?.info?.('Deletion check passed');

      this.logger?.info?.('Deleting feature toggle');
      const deleteResponse = await deleteFeatureToggle(
        this.connection,
        this.buildDeleteParams(config),
      );
      state.deleteResult = deleteResponse;
      this.logger?.info?.('Feature toggle deleted');

      return state;
    } catch (error: unknown) {
      this.logger?.error('Delete failed:', safeErrorMessage(error));
      throw error;
    }
  }

  /**
   * Activate feature toggle.
   */
  async activate(
    config: Partial<IFeatureToggleConfig>,
  ): Promise<IFeatureToggleState> {
    if (!config.featureToggleName) {
      throw new Error('Feature toggle name is required');
    }

    const state: IFeatureToggleState = { errors: [] };

    try {
      const activateResponse = await activateFeatureToggle(
        this.connection,
        config.featureToggleName,
      );
      state.activateResult = activateResponse;
      return state;
    } catch (error: unknown) {
      this.logger?.error('Activate failed:', safeErrorMessage(error));
      throw error;
    }
  }

  /**
   * Check feature toggle.
   */
  async check(
    config: Partial<IFeatureToggleConfig>,
    status?: string,
  ): Promise<IFeatureToggleState> {
    if (!config.featureToggleName) {
      throw new Error('Feature toggle name is required');
    }

    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    const checkResponse = await checkFeatureToggle(
      this.connection,
      config.featureToggleName,
      version,
    );
    return {
      checkResult: checkResponse,
      errors: [],
    };
  }

  /**
   * Read transport info — not supported for feature toggles.
   */
  async readTransport(
    _config: Partial<IFeatureToggleConfig>,
    _options?: { withLongPolling?: boolean },
  ): Promise<IFeatureToggleState> {
    return {
      errors: [
        {
          method: 'readTransport',
          error: new Error(
            'readTransport is not supported for feature toggles',
          ),
          timestamp: new Date(),
        },
      ],
    };
  }

  /**
   * Lock feature toggle for modification.
   */
  async lock(config: Partial<IFeatureToggleConfig>): Promise<string> {
    if (!config.featureToggleName) {
      throw new Error('Feature toggle name is required');
    }

    this.connection.setSessionType('stateful');
    const lockHandle = await lockFeatureToggle(
      this.connection,
      config.featureToggleName,
      this.logger,
    );
    this.connection.setSessionType('stateless');
    return lockHandle;
  }

  /**
   * Unlock feature toggle.
   */
  async unlock(
    config: Partial<IFeatureToggleConfig>,
    lockHandle: string,
  ): Promise<IFeatureToggleState> {
    if (!config.featureToggleName) {
      throw new Error('Feature toggle name is required');
    }

    this.connection.setSessionType('stateful');
    await unlockFeatureToggle(
      this.connection,
      config.featureToggleName,
      lockHandle,
    );
    this.connection.setSessionType('stateless');
    return { errors: [] };
  }

  // ---------------------------------------------------------------------------
  // Domain methods — beyond IAdtObject surface
  // ---------------------------------------------------------------------------

  async switchOn(
    config: Partial<IFeatureToggleConfig>,
    opts: { transportRequest: string; userSpecific?: boolean },
  ): Promise<IFeatureToggleState> {
    return this.switchTo(config, opts, 'on');
  }

  async switchOff(
    config: Partial<IFeatureToggleConfig>,
    opts: { transportRequest: string; userSpecific?: boolean },
  ): Promise<IFeatureToggleState> {
    return this.switchTo(config, opts, 'off');
  }

  private async switchTo(
    config: Partial<IFeatureToggleConfig>,
    opts: { transportRequest: string; userSpecific?: boolean },
    targetState: 'on' | 'off',
  ): Promise<IFeatureToggleState> {
    const name = this.requireName(config);
    const state: IFeatureToggleState = { errors: [] };
    try {
      await toggleFeatureToggle(this.connection, {
        feature_toggle_name: name,
        state: targetState,
        is_user_specific: Boolean(opts.userSpecific),
        transport_request: opts.transportRequest,
      });
      state.runtimeState = await getFeatureToggleState(this.connection, name);
    } catch (error) {
      state.errors.push({
        method: targetState === 'on' ? 'switchOn' : 'switchOff',
        error: error as Error,
        timestamp: new Date(),
      });
      throw error;
    }
    return state;
  }

  async getRuntimeState(
    config: Partial<IFeatureToggleConfig>,
  ): Promise<IFeatureToggleState> {
    const name = this.requireName(config);
    const state: IFeatureToggleState = { errors: [] };
    try {
      state.runtimeState = await getFeatureToggleState(this.connection, name);
    } catch (error) {
      state.errors.push({
        method: 'getRuntimeState',
        error: error as Error,
        timestamp: new Date(),
      });
      throw error;
    }
    return state;
  }

  async checkState(
    config: Partial<IFeatureToggleConfig>,
    opts?: { userSpecific?: boolean },
  ): Promise<IFeatureToggleState> {
    const name = this.requireName(config);
    const state: IFeatureToggleState = { errors: [] };
    try {
      state.checkStateResult = await checkFeatureToggleState(
        this.connection,
        name,
        opts,
      );
    } catch (error) {
      state.errors.push({
        method: 'checkState',
        error: error as Error,
        timestamp: new Date(),
      });
      throw error;
    }
    return state;
  }

  async readSource(
    config: Partial<IFeatureToggleConfig>,
    version: 'active' | 'inactive' = 'active',
  ): Promise<IFeatureToggleState> {
    const name = this.requireName(config);
    const state: IFeatureToggleState = { errors: [] };
    try {
      const resp = await readFeatureToggleSource(
        this.connection,
        name,
        version,
      );
      state.readResult = resp;
      const parsed =
        typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
      state.sourceResult = parsed as IFeatureToggleSource;
    } catch (error) {
      state.errors.push({
        method: 'readSource',
        error: error as Error,
        timestamp: new Date(),
      });
      throw error;
    }
    return state;
  }

  private requireName(config: Partial<IFeatureToggleConfig>): string {
    if (!config.featureToggleName) {
      throw new Error('Feature toggle name is required');
    }
    return config.featureToggleName;
  }
}

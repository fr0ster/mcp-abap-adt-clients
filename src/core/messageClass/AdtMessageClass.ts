/**
 * AdtMessageClass — High-level CRUD operations for Message Class (MSAG/N) objects.
 *
 * Implements IAdtObject<IMessageClassConfig, IMessageClassState>.
 *
 * Session management:
 * - stateful: only during lock → update/delete → unlock chains
 * - stateless: mandatory after unlock
 *
 * Unsupported operations (message classes are not activatable):
 * - activate, check, getVersions, getVersionSource → throwUnsupportedOperation
 *
 * transport / corrNr: parsed in config but not sent in requests yet.
 * Task 6.2 will wire it for transportable packages after a probe confirms the
 * corrNr query parameter is accepted by the endpoint.
 */

import type {
  HttpError,
  IAbapConnection,
  IAdtObject,
  IAdtOperationOptions,
  ILogger,
  IObjectVersion,
} from '@mcp-abap-adt/interfaces';
import { safeErrorMessage } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { throwUnsupportedOperation } from '../shared/unsupported';
import { createMessageClass } from './create';
import { checkDeletion, deleteMessageClass } from './delete';
import { lockMessageClass } from './lock';
import { getMessageClassSource } from './read';
import type { IMessageClassConfig, IMessageClassState } from './types';
import { unlockMessageClass } from './unlock';
import { updateMessageClass } from './update';
import { parseMessageClass } from './xml';

const VALIDATE_BASE = '/sap/bc/adt/messageclass/validation';

export class AdtMessageClass
  implements IAdtObject<IMessageClassConfig, IMessageClassState>
{
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  public readonly objectType: string = 'MessageClass';

  constructor(connection: IAbapConnection, logger?: ILogger) {
    this.connection = connection;
    this.logger = logger;
  }

  /**
   * Validate name + description via the ADT validation endpoint.
   */
  async validate(
    config: Partial<IMessageClassConfig>,
  ): Promise<IMessageClassState> {
    if (!config.name) {
      throw new Error('Message class name is required for validation');
    }

    const params = new URLSearchParams({ objname: config.name });
    if (config.description) {
      params.set('description', config.description);
    }

    const response = await this.connection.makeAdtRequest({
      url: `${VALIDATE_BASE}?${params.toString()}`,
      method: 'GET',
      timeout: getTimeout('default'),
    });

    return { validationResponse: response, errors: [] };
  }

  /**
   * Create a new message class (shell with name/description/package).
   * No activation is needed — message classes are not activated.
   */
  async create(
    config: IMessageClassConfig,
    _options?: IAdtOperationOptions,
  ): Promise<IMessageClassState> {
    if (!config.name) {
      throw new Error('Message class name is required');
    }
    if (!config.packageName) {
      throw new Error('Package name is required');
    }
    if (!config.description) {
      throw new Error('Description is required');
    }

    try {
      this.logger?.info?.('Creating message class');
      const createResult = await createMessageClass(this.connection, {
        name: config.name,
        description: config.description,
        package_name: config.packageName,
        master_language: config.masterLanguage,
        // corrNr wiring deferred to the transportable-package task
        transport_request: config.transportRequest,
      });
      this.logger?.info?.('Message class created');
      return { createResult, errors: [] };
    } catch (error: unknown) {
      // Defensive reset: create never sets stateful, but this guard ensures the
      // session is always left stateless if the caller had set it before this call.
      this.connection.setSessionType('stateless');
      this.logger?.error('Create failed:', safeErrorMessage(error));
      throw error;
    }
  }

  /**
   * Read message class metadata and messages.
   * Returns undefined on 404 (object does not exist).
   */
  async read(
    config: Partial<IMessageClassConfig>,
  ): Promise<IMessageClassState | undefined> {
    if (!config.name) {
      throw new Error('Message class name is required');
    }

    try {
      const readResult = await getMessageClassSource(
        this.connection,
        config.name,
      );
      const messageClass = parseMessageClass(String(readResult.data));
      return { readResult, messageClass, errors: [] };
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
   * Update a message class.
   * Full operation chain: stateful → lock → read current → rebuild XML → PUT → unlock → stateless.
   * On failure: unlock if locked, then stateless.
   */
  async update(
    config: Partial<IMessageClassConfig>,
    _options?: IAdtOperationOptions,
  ): Promise<IMessageClassState> {
    if (!config.name) {
      throw new Error('Message class name is required');
    }

    let lockHandle: string | undefined;

    try {
      this.logger?.info?.('lock');
      this.connection.setSessionType('stateful');
      lockHandle = await lockMessageClass(this.connection, config.name);
      this.logger?.info?.('locked');

      this.logger?.info?.('update');
      const updateResult = await updateMessageClass(
        this.connection,
        config.name,
        lockHandle,
        config.description,
      );
      this.logger?.info?.('updated');

      this.logger?.info?.('unlock');
      const unlockResult = await unlockMessageClass(
        this.connection,
        config.name,
        lockHandle,
      );
      this.connection.setSessionType('stateless');
      lockHandle = undefined;
      this.logger?.info?.('unlocked');

      return { updateResult, unlockResult, errors: [] };
    } catch (error: unknown) {
      // Unlock + stateless cleanup on any failure inside the lock chain
      if (lockHandle) {
        try {
          this.logger?.warn?.('Unlocking message class during error cleanup');
          await unlockMessageClass(this.connection, config.name, lockHandle);
        } catch (unlockError) {
          this.logger?.warn?.(
            'Failed to unlock during cleanup:',
            safeErrorMessage(unlockError),
          );
        }
      }
      this.connection.setSessionType('stateless');
      this.logger?.error('Update failed:', safeErrorMessage(error));
      throw error;
    }
  }

  /**
   * Delete a message class.
   * Operation chain: stateful → lock → DELETE → stateless.
   */
  async delete(
    config: Partial<IMessageClassConfig>,
  ): Promise<IMessageClassState> {
    if (!config.name) {
      throw new Error('Message class name is required');
    }

    try {
      // Stateless deletion service (check → delete) — no lock. A stateful
      // lock + direct DELETE leaves a lingering message-editing enqueue that
      // blocks a same-name re-create, so it is not used. See delete.ts.
      this.logger?.info?.('delete: check');
      await checkDeletion(this.connection, config.name);

      this.logger?.info?.('delete: delete');
      const deleteResult = await deleteMessageClass(
        this.connection,
        config.name,
      );
      this.logger?.info?.('deleted');

      return { deleteResult, errors: [] };
    } catch (error: unknown) {
      this.logger?.error('Delete failed:', safeErrorMessage(error));
      throw error;
    }
  }

  /**
   * Read message class metadata.
   * Message classes have no separate metadata endpoint — delegates to read().
   */
  async readMetadata(
    config: Partial<IMessageClassConfig>,
    options?: { withLongPolling?: boolean; version?: 'active' | 'inactive' },
  ): Promise<IMessageClassState> {
    if (!config.name) {
      throw new Error('Message class name is required');
    }
    const state = await this.read(config);
    if (!state) {
      throw new Error(`Message class '${config.name}' not found`);
    }
    return { ...state, metadataResult: state.readResult };
  }

  /**
   * Read transport request information.
   * Transport endpoint is not confirmed for message classes — always throws.
   */
  async readTransport(
    config: Partial<IMessageClassConfig>,
  ): Promise<IMessageClassState> {
    throwUnsupportedOperation(
      'readTransport',
      `message class ${config.name ?? ''}`,
    );
  }

  /**
   * Lock message class for modification (low-level — use when managing lock externally).
   */
  async lock(config: Partial<IMessageClassConfig>): Promise<string> {
    if (!config.name) {
      throw new Error('Message class name is required');
    }
    this.connection.setSessionType('stateful');
    return lockMessageClass(this.connection, config.name);
  }

  /**
   * Unlock message class (low-level).
   */
  async unlock(
    config: Partial<IMessageClassConfig>,
    lockHandle: string,
  ): Promise<IMessageClassState> {
    if (!config.name) {
      throw new Error('Message class name is required');
    }
    const unlockResult = await unlockMessageClass(
      this.connection,
      config.name,
      lockHandle,
    );
    this.connection.setSessionType('stateless');
    return { unlockResult, errors: [] };
  }

  /** Message classes are not activated — always throws. */
  async activate(
    _config: Partial<IMessageClassConfig>,
  ): Promise<IMessageClassState> {
    throwUnsupportedOperation(
      'activate',
      `message class ${_config.name ?? ''}`,
    );
  }

  /** Syntax check is not applicable to message classes — always throws. */
  async check(
    _config: Partial<IMessageClassConfig>,
  ): Promise<IMessageClassState> {
    throwUnsupportedOperation('check', `message class ${_config.name ?? ''}`);
  }

  /** Version history is not supported for message classes — always throws. */
  async getVersions(
    _config: Partial<IMessageClassConfig>,
  ): Promise<IObjectVersion[]> {
    throwUnsupportedOperation(
      'getVersions',
      `message class ${_config.name ?? ''}`,
    );
  }

  /** Version source retrieval is not supported for message classes — always throws. */
  async getVersionSource(_contentUri: string): Promise<string> {
    throwUnsupportedOperation('getVersionSource', 'message class');
  }
}

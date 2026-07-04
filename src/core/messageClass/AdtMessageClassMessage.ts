/**
 * AdtMessageClassMessage — read-modify-write operations for a single message
 * within a Message Class (MSAG/N).
 *
 * Implements IAdtObject<IMessageClassMessageConfig, IMessageClassMessageState>.
 *
 * Operation chains:
 * - read:   GET class XML → find message by msgno → return state.message
 * - create/update: GET class → merge message → stateful → lockMessage (MH) +
 *           lockClassForMessage (CH) → PUT full class XML (message with
 *           mc:lockhandle=MH, lockHandle=CH) → unlockAllMessages →
 *           unlock class (CH) → stateless
 * - delete: GET class → stateful → lockMessage (MH) + lockClassForMessage (CH)
 *           → PUT class XML with target message as <mc:deletedmessages
 *           mc:lockhandle=MH>, all other messages as <mc:messages> →
 *           unlockAllMessages → unlock class (CH) → stateless.
 *           (SAP does NOT delete omitted messages on PUT — <mc:deletedmessages>
 *           is the correct mechanism. A message-level DELETE /messages/{no}
 *           returns 423 and is NOT used.)
 *
 * Unsupported: activate, check, validate, lock, unlock, getVersions,
 * getVersionSource, readTransport → throwUnsupportedOperation.
 *
 * transport: when config.transportRequest is set (transportable package), it is
 * appended as &corrNr= on the class PUT, like the other CRUD object types.
 */

import type {
  IAbapConnection,
  IAdtObject,
  IAdtOperationOptions,
  ILogger,
  IObjectVersion,
} from '@mcp-abap-adt/interfaces';
import {
  AdtObjectErrorCodes,
  AdtOperationError,
} from '@mcp-abap-adt/interfaces';
import { MESSAGE_CLASS_UPDATE_CONTENT_TYPE } from '../../constants/contentTypes';
import {
  encodeSapObjectName,
  safeErrorMessage,
} from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { throwUnsupportedOperation } from '../shared/unsupported';
import { lockClassForMessage, lockMessage } from './lock';
import { getMessageClassSource } from './read';
import type {
  IMessageClassMessageConfig,
  IMessageClassMessageState,
} from './types';
import { unlockAllMessages, unlockMessageClass } from './unlock';
import { buildMessageClassXml, parseMessageClass } from './xml';

const BASE = '/sap/bc/adt/messageclass';

export class AdtMessageClassMessage
  implements IAdtObject<IMessageClassMessageConfig, IMessageClassMessageState>
{
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  public readonly objectType: string = 'MessageClassMessage';

  constructor(connection: IAbapConnection, logger?: ILogger) {
    this.connection = connection;
    this.logger = logger;
  }

  // ── read ──────────────────────────────────────────────────────────────────

  /**
   * Read a single message from the parent class.
   * Returns undefined when the parent class itself is absent (404).
   * Throws OBJECT_NOT_FOUND when the class exists but the message number is absent.
   */
  async read(
    config: Partial<IMessageClassMessageConfig>,
  ): Promise<IMessageClassMessageState | undefined> {
    if (!config.className) throw new Error('className is required');
    if (!config.msgno) throw new Error('msgno is required');

    const no = String(config.msgno);

    try {
      const response = await getMessageClassSource(
        this.connection,
        config.className,
      );
      const cls = parseMessageClass(String(response.data));
      const message = cls.messages.find((m) => m.msgno === no);

      if (!message) {
        const e = new AdtOperationError(
          `Message ${no} not found in class ${config.className}`,
        );
        e.code = AdtObjectErrorCodes.OBJECT_NOT_FOUND;
        throw e;
      }

      return { message, errors: [] };
    } catch (error: unknown) {
      const e = error as { response?: { status?: number }; code?: string };
      if (e.response?.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  // ── create / update (upsert) ───────────────────────────────────────────────

  /**
   * Create or upsert a single message in the parent class.
   * Delegates to the update logic.
   */
  async create(
    config: IMessageClassMessageConfig,
    _options?: IAdtOperationOptions,
  ): Promise<IMessageClassMessageState> {
    return this._upsertMessage(config);
  }

  /**
   * Update (upsert) a single message in the parent class.
   * Full chain: GET class → merge message → stateful → LOCK_MSG + class LOCK →
   * PUT class XML → unlock class → unlockAllMessages → stateless.
   */
  async update(
    config: Partial<IMessageClassMessageConfig>,
    _options?: IAdtOperationOptions,
  ): Promise<IMessageClassMessageState> {
    return this._upsertMessage(config);
  }

  private async _upsertMessage(
    config: Partial<IMessageClassMessageConfig>,
  ): Promise<IMessageClassMessageState> {
    if (!config.className) throw new Error('className is required');
    if (!config.msgno) throw new Error('msgno is required');

    const name = config.className;
    const no = String(config.msgno);

    // 1. Read current class state to preserve all messages
    const response = await getMessageClassSource(this.connection, name);
    const cls = parseMessageClass(String(response.data));

    // 2. Merge/set the message in the messages array
    const existingIdx = cls.messages.findIndex((m) => m.msgno === no);
    if (existingIdx >= 0) {
      // Update existing message — only override fields when explicitly provided in config
      cls.messages[existingIdx] = {
        ...cls.messages[existingIdx],
        ...(config.msgtext !== undefined ? { msgtext: config.msgtext } : {}),
        ...(config.selfExplanatory !== undefined
          ? { selfExplanatory: config.selfExplanatory }
          : {}),
        ...(config.description !== undefined
          ? { description: config.description }
          : {}),
      };
    } else {
      // Add new message with all authorable fields
      cls.messages.push({
        msgno: no,
        msgtext: config.msgtext ?? '',
        ...(config.selfExplanatory !== undefined
          ? { selfExplanatory: config.selfExplanatory }
          : {}),
        ...(config.description !== undefined
          ? { description: config.description }
          : {}),
      });
    }

    let messageLockHandle: string | undefined;
    let classLockHandle: string | undefined;

    try {
      this.logger?.info?.('upsertMessage: stateful');
      this.connection.setSessionType('stateful');

      // 3. Lock individual message
      this.logger?.info?.('upsertMessage: lockMessage');
      messageLockHandle = await lockMessage(this.connection, name, no);

      // 4. Lock class for message save
      this.logger?.info?.('upsertMessage: lockClassForMessage');
      classLockHandle = await lockClassForMessage(this.connection, name, no);

      // 5. PUT full class XML with message lock handle embedded
      this.logger?.info?.('upsertMessage: PUT');
      const xmlBody = buildMessageClassXml(cls, {
        messageLockHandles: { [no]: messageLockHandle },
      });
      const encoded = encodeSapObjectName(name.toLowerCase());
      const corrNr = config.transportRequest?.trim()
        ? `&corrNr=${encodeURIComponent(config.transportRequest)}`
        : '';
      const updateResult = await this.connection.makeAdtRequest({
        url: `${BASE}/${encoded}?lockHandle=${encodeURIComponent(classLockHandle)}${corrNr}`,
        method: 'PUT',
        timeout: getTimeout('default'),
        data: xmlBody,
        headers: { 'Content-Type': MESSAGE_CLASS_UPDATE_CONTENT_TYPE },
      });

      // 6. Release the message lock first, then unlock the whole class last —
      //    the class edit-lock must be the final release of the process.
      this.logger?.info?.('upsertMessage: unlockAllMessages');
      await unlockAllMessages(this.connection, name, no);
      messageLockHandle = undefined;

      // 7. Unlock the whole class (final release)
      this.logger?.info?.('upsertMessage: unlock class');
      await unlockMessageClass(this.connection, name, classLockHandle);
      classLockHandle = undefined;

      // 8. Back to stateless
      this.connection.setSessionType('stateless');
      this.logger?.info?.('upsertMessage: done');

      return { updateResult, errors: [] };
    } catch (error: unknown) {
      // Always clean up locks and reset session on failure — release the
      // message lock first, then the class (final release), mirroring the happy path.
      if (messageLockHandle) {
        try {
          await unlockAllMessages(this.connection, name, no);
        } catch (ue) {
          this.logger?.warn?.(
            'Failed to unlock messages during cleanup:',
            safeErrorMessage(ue),
          );
        }
      }
      if (classLockHandle) {
        try {
          await unlockMessageClass(this.connection, name, classLockHandle);
        } catch (ue) {
          this.logger?.warn?.(
            'Failed to unlock class during cleanup:',
            safeErrorMessage(ue),
          );
        }
      }
      this.connection.setSessionType('stateless');
      this.logger?.error('upsertMessage failed:', safeErrorMessage(error));
      throw error;
    }
  }

  // ── delete ────────────────────────────────────────────────────────────────

  /**
   * Delete a single message from the parent class.
   *
   * SAP does NOT remove messages that are merely omitted from a class PUT — it
   * only upserts what is present.  The correct mechanism is to PUT the class
   * with the target message placed in <mc:deletedmessages> (carrying its own
   * message lock handle), while every other message remains in <mc:messages>.
   *
   * Chain: GET class → stateful → lockMessage (MH) + lockClassForMessage (CH)
   * → PUT class XML with target in <mc:deletedmessages mc:lockhandle=MH>,
   * remaining messages in <mc:messages> → unlockAllMessages →
   * unlock class (CH) → stateless.
   */
  async delete(
    config: Partial<IMessageClassMessageConfig>,
  ): Promise<IMessageClassMessageState> {
    if (!config.className) throw new Error('className is required');
    if (!config.msgno) throw new Error('msgno is required');

    const name = config.className;
    const no = String(config.msgno);

    // 1. Read current class state — keep ALL messages (including the one being
    //    deleted) so the builder can emit <mc:deletedmessages> for the target
    const response = await getMessageClassSource(this.connection, name);
    const cls = parseMessageClass(String(response.data));

    let messageLockHandle: string | undefined;
    let classLockHandle: string | undefined;

    try {
      this.logger?.info?.('deleteMessage: stateful');
      this.connection.setSessionType('stateful');

      // 2. Lock the individual message (required for <mc:deletedmessages>)
      this.logger?.info?.('deleteMessage: lockMessage');
      messageLockHandle = await lockMessage(this.connection, name, no);

      // 3. Lock the class for a message-save (msgNo + onSave=X)
      this.logger?.info?.('deleteMessage: lockClassForMessage');
      classLockHandle = await lockClassForMessage(this.connection, name, no);

      // 4. PUT: target message → <mc:deletedmessages>; all others → <mc:messages>
      this.logger?.info?.('deleteMessage: PUT');
      const xmlBody = buildMessageClassXml(cls, {
        deletedMsgnos: [no],
        messageLockHandles: { [no]: messageLockHandle },
      });
      const encoded = encodeSapObjectName(name.toLowerCase());
      const corrNr = config.transportRequest?.trim()
        ? `&corrNr=${encodeURIComponent(config.transportRequest)}`
        : '';
      const deleteResult = await this.connection.makeAdtRequest({
        url: `${BASE}/${encoded}?lockHandle=${encodeURIComponent(classLockHandle)}${corrNr}`,
        method: 'PUT',
        timeout: getTimeout('default'),
        data: xmlBody,
        headers: { 'Content-Type': MESSAGE_CLASS_UPDATE_CONTENT_TYPE },
      });

      // 5. Release the message lock first, then unlock the whole class last.
      this.logger?.info?.('deleteMessage: unlockAllMessages');
      await unlockAllMessages(this.connection, name, no);
      messageLockHandle = undefined;

      // 6. Unlock the whole class (final release)
      this.logger?.info?.('deleteMessage: unlock class');
      await unlockMessageClass(this.connection, name, classLockHandle);
      classLockHandle = undefined;

      this.connection.setSessionType('stateless');
      this.logger?.info?.('deleteMessage: done');

      return { deleteResult, errors: [] };
    } catch (error: unknown) {
      // Release the message lock first, then the class (final release).
      if (messageLockHandle) {
        try {
          await unlockAllMessages(this.connection, name, no);
        } catch (ue) {
          this.logger?.warn?.(
            'Failed to unlock messages during cleanup:',
            safeErrorMessage(ue),
          );
        }
      }
      if (classLockHandle) {
        try {
          await unlockMessageClass(this.connection, name, classLockHandle);
        } catch (ue) {
          this.logger?.warn?.(
            'Failed to unlock class during cleanup:',
            safeErrorMessage(ue),
          );
        }
      }
      this.connection.setSessionType('stateless');
      this.logger?.error('deleteMessage failed:', safeErrorMessage(error));
      throw error;
    }
  }

  // ── readMetadata ───────────────────────────────────────────────────────────

  /** Delegates to read() — individual messages have no separate metadata endpoint. */
  async readMetadata(
    config: Partial<IMessageClassMessageConfig>,
  ): Promise<IMessageClassMessageState> {
    const state = await this.read(config);
    if (!state) {
      throw new Error(
        `Message ${config.msgno} not found in class ${config.className}`,
      );
    }
    return state;
  }

  // ── unsupported operations ─────────────────────────────────────────────────

  async validate(
    _config: Partial<IMessageClassMessageConfig>,
  ): Promise<IMessageClassMessageState> {
    throwUnsupportedOperation('validate', 'message class message');
  }

  async activate(
    _config: Partial<IMessageClassMessageConfig>,
  ): Promise<IMessageClassMessageState> {
    throwUnsupportedOperation('activate', 'message class message');
  }

  async check(
    _config: Partial<IMessageClassMessageConfig>,
  ): Promise<IMessageClassMessageState> {
    throwUnsupportedOperation('check', 'message class message');
  }

  async readTransport(
    _config: Partial<IMessageClassMessageConfig>,
  ): Promise<IMessageClassMessageState> {
    throwUnsupportedOperation('readTransport', 'message class message');
  }

  async lock(_config: Partial<IMessageClassMessageConfig>): Promise<string> {
    throwUnsupportedOperation('lock', 'message class message');
  }

  async unlock(
    _config: Partial<IMessageClassMessageConfig>,
    _lockHandle: string,
  ): Promise<IMessageClassMessageState> {
    throwUnsupportedOperation('unlock', 'message class message');
  }

  async getVersions(
    _config: Partial<IMessageClassMessageConfig>,
  ): Promise<IObjectVersion[]> {
    throwUnsupportedOperation('getVersions', 'message class message');
  }

  async getVersionSource(_contentUri: string): Promise<string> {
    throwUnsupportedOperation('getVersionSource', 'message class message');
  }
}

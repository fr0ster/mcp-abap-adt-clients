/**
 * AdtMessageClassMessage — read-modify-write operations for a single message
 * within a Message Class (MSAG/N).
 *
 * Operation chains:
 * - read:   GET class XML → find message by msgno
 * - create/update: GET class → merge message → stateful → lockMessage (MH) +
 *           lockClassForMessage (CH) → PUT full class XML (message with
 *           mc:lockhandle=MH, lockHandle=CH) → unlock class (CH) →
 *           unlockAllMessages → stateless
 * - delete: GET class → stateful → lockMessage (MH) + lockClassForMessage (CH)
 *           → PUT class XML with target message as <mc:deletedmessages
 *           mc:lockhandle=MH>, all other messages as <mc:messages> →
 *           unlock class (CH) → unlockAllMessages → stateless.
 *           (SAP does NOT delete omitted messages on PUT — <mc:deletedmessages>
 *           is the correct mechanism. A message-level DELETE /messages/{no}
 *           returns 423 and is NOT used.)
 *
 * A message is created, read, changed and removed through its class's XML. It
 * is not validated, activated, checked, locked or versioned in its own right,
 * and carries no method for any of those — which is why every member here
 * answers what the class PUT answered.
 *
 * transport: when config.transportRequest is set (transportable package), it is
 * appended as &corrNr= on the class PUT, like the other CRUD object types.
 */

import type {
  IAbapConnection,
  IAdtCreatable,
  IAdtDeletable,
  IAdtError,
  IAdtOperationOptions,
  IAdtReadable,
  IAdtResponse,
  IAdtUpdatable,
  ILogger,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { ADT_NO_FAILURE, AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces';
import { MESSAGE_CLASS_UPDATE_CONTENT_TYPE } from '../../constants/contentTypes';
import { answering, failed, type IAdtOptions } from '../../utils/adtResponse';
import { beginCriticalSection } from '../../utils/criticalSection';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { requestOf } from '../../utils/requestTrace';
import { getTimeout } from '../../utils/timeouts';
import { chain } from '../shared/chain';
import { lockClassForMessageOrPlain, lockMessageIfGranted } from './lock';
import { getMessageClassSource } from './read';
import {
  type IMessageClassMessageConfig,
  type IMessageClassMessageResults,
  messageDocuments,
} from './types';
import { unlockAllMessages, unlockMessageClass } from './unlock';
import { buildMessageClassXml, parseMessageClass } from './xml';

const BASE = '/sap/bc/adt/messageclass';

export class AdtMessageClassMessage<
  R extends IMessageClassMessageResults<
    unknown,
    unknown,
    unknown
  > = IMessageClassMessageResults,
> implements
    IAdtCreatable<IMessageClassMessageConfig, ReturnType<R['written']>>,
    IAdtReadable<
      IMessageClassMessageConfig,
      ReturnType<R['read']>,
      ReturnType<R['read']>
    >,
    IAdtUpdatable<IMessageClassMessageConfig, ReturnType<R['written']>>,
    IAdtDeletable<IMessageClassMessageConfig, ReturnType<R['deleted']>>
{
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  public readonly objectType: string = 'MessageClassMessage';

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    // The one cast in this file, and it is on the default. See AdtClass.
    private readonly results: R = messageDocuments as unknown as R,
  ) {
    this.connection = connection;
    this.logger = logger;
  }

  /** Both identifiers, or the caller's mistake. */
  private names(config: Partial<IMessageClassMessageConfig>): {
    name: string;
    no: string;
  } {
    if (!config.className) throw new Error('className is required');
    if (!config.msgno) throw new Error('msgno is required');
    return { name: config.className, no: String(config.msgno) };
  }

  // ── read ──────────────────────────────────────────────────────────────────

  /**
   * Read the parent class, for one message's sake.
   *
   * The answer is the **class's** document: there is no resource for a single
   * message, so there is nothing else to answer with. A caller who wants the
   * one message parsed out supplies a result strategy that does it — this
   * module's `parseMessageClass` is the reading to compose.
   *
   * A message number the class does not carry is a failure named
   * {@link AdtObjectErrorCodes.OBJECT_NOT_FOUND}, so a consumer branches on the
   * code rather than on a message.
   */
  async read(
    config: Partial<IMessageClassMessageConfig>,
    _version?: 'active' | 'inactive',
    options?: { withLongPolling?: boolean } & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['read']>>> {
    const { name, no } = this.names(config);

    return answering(
      () => getMessageClassSource(this.connection, name),
      this.results.read as IResultStrategy<ReturnType<R['read']>>,
      options?.analyse ??
        ((verdict, answer) => {
          if (verdict !== ADT_NO_FAILURE) return verdict;
          const cls = parseMessageClass(String(answer?.data ?? ''));
          return cls.messages.some((m) => m.msgno === no)
            ? ADT_NO_FAILURE
            : {
                origin: 'refusal' as const,
                code: AdtObjectErrorCodes.OBJECT_NOT_FOUND,
                message: `Message ${no} not found in class ${name}`,
                response: answer,
                request: requestOf(answer),
              };
        }),
    );
  }

  /** The same class document `read` fetches. */
  async readMetadata(
    config: Partial<IMessageClassMessageConfig>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['read']>>> {
    return this.read(config, undefined, options);
  }

  // ── create / update (upsert) ───────────────────────────────────────────────

  /** Create the message — the same write as `update`; ADT upserts. */
  async create<E extends IAdtError = IAdtError>(
    config: IMessageClassMessageConfig,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['written']>, E>> {
    return this.writeClass(config, false, options);
  }

  /** Update the message — see `create`. */
  async update<E extends IAdtError = IAdtError>(
    config: Partial<IMessageClassMessageConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['written']>, E>> {
    return this.writeClass(config, false, options);
  }

  /**
   * Delete the message.
   *
   * SAP does **not** remove messages that are merely omitted from a class PUT —
   * it only upserts what is present. The mechanism is to PUT the class with the
   * target message in `<mc:deletedmessages>`, carrying its own message lock
   * handle, while every other message stays in `<mc:messages>`.
   */
  async delete<E extends IAdtError = IAdtError>(
    config: Partial<IMessageClassMessageConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deleted']>, E>> {
    return this.writeClass(config, true, options) as Promise<
      IAdtResponse<ReturnType<R['deleted']>, E>
    >;
  }

  /**
   * The one write this handler has: PUT the parent class.
   *
   * Upsert and delete differ only in whether the target message is emitted in
   * `<mc:messages>` or in `<mc:deletedmessages>`; everything around it — the
   * two locks, the stateless PUT between them, the order they are released in —
   * is the same, and was duplicated twice before.
   */
  private async writeClass<E extends IAdtError = IAdtError>(
    config: Partial<IMessageClassMessageConfig>,
    deleting: boolean,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['written']>, E>> {
    const { name, no } = this.names(config);
    const label = deleting ? 'deleteMessage' : 'upsertMessage';

    // Read the current class so every other message survives the PUT.
    const current = await getMessageClassSource(this.connection, name);
    const cls = parseMessageClass(String(current.data));

    if (!deleting) {
      const existing = cls.messages.findIndex((m) => m.msgno === no);
      const authored = {
        ...(config.msgtext !== undefined ? { msgtext: config.msgtext } : {}),
        ...(config.selfExplanatory !== undefined
          ? { selfExplanatory: config.selfExplanatory }
          : {}),
        ...(config.description !== undefined
          ? { description: config.description }
          : {}),
      };
      if (existing >= 0) {
        // Only the fields the caller named are overridden; the rest of the
        // message stays as the system has it.
        cls.messages[existing] = { ...cls.messages[existing], ...authored };
      } else {
        cls.messages.push({
          msgno: no,
          msgtext: config.msgtext ?? '',
          ...authored,
        });
      }
    }

    // A LOCK…UNLOCK window: a timeout in the middle releases the locks and
    // leaves the work half done.
    const endCriticalSection = beginCriticalSection(this.connection);

    return chain(this.logger, async ({ step, onScopeEnd }) => {
      onScopeEnd(async () => {
        endCriticalSection();
      });

      this.logger?.info?.(`${label}: stateful`);
      this.connection.setSessionType('stateful');
      // Registered first so it unwinds last, and set unconditionally: the PUT
      // below runs stateless, so a failure at or after it leaves the connection
      // stateless — and an unlock sent that way does not reach the session
      // holding the handles. Asking "did we get far enough to have switched?"
      // is the question that produced that bug.
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      this.logger?.info?.(`${label}: lockMessage`);
      const messageLockHandle = await lockMessageIfGranted(
        this.connection,
        name,
        no,
      );
      const releaseMessage = onScopeEnd(async () => {
        this.connection.setSessionType('stateful');
        await unlockAllMessages(this.connection, name, no);
      });

      this.logger?.info?.(`${label}: lockClassForMessage`);
      const classLockHandle = await lockClassForMessageOrPlain(
        this.connection,
        name,
        no,
      );
      const releaseClass = onScopeEnd(async () => {
        this.connection.setSessionType('stateful');
        await unlockMessageClass(this.connection, name, classLockHandle);
      });

      // The PUT carries the lock handle, so it does not need the lock session —
      // and Eclipse deliberately keeps it out of one. In the E19 capture of
      // 2026-08-31 every lock and unlock is on the stateful "enqueue" session
      // (155) while the PUT that saves the message runs stateless (215), as do
      // the reads around it. The locks survive because they belong to the
      // enqueue session, not to the request that uses their handle.
      this.connection.setSessionType('stateless');
      this.logger?.info?.(`${label}: PUT`);
      // Whichever handle this chain actually holds. When LOCK_MSG was refused
      // the class-for-message handle stands in, and the save takes it.
      const xmlBody = buildMessageClassXml(cls, {
        ...(deleting ? { deletedMsgnos: [no] } : {}),
        messageLockHandles: { [no]: messageLockHandle ?? classLockHandle },
      });
      const encoded = encodeSapObjectName(name.toLowerCase());
      const corrNr = config.transportRequest?.trim()
        ? `&corrNr=${encodeURIComponent(config.transportRequest)}`
        : '';

      const written = await step(
        answering(
          () =>
            this.connection.makeAdtRequest({
              url: `${BASE}/${encoded}?lockHandle=${encodeURIComponent(classLockHandle)}${corrNr}`,
              method: 'PUT',
              timeout: getTimeout('default'),
              data: xmlBody,
              headers: { 'Content-Type': MESSAGE_CLASS_UPDATE_CONTENT_TYPE },
            }),
          this.results.written as IResultStrategy<ReturnType<R['written']>>,
          options?.analyse,
        ),
      );

      // Back to the lock session to give the handles up, and in Eclipse's
      // order: the class first, then the message locks. Captured on E19
      // 2026-08-31 editing ZADT_MSGX01 — UNLOCK on the class at 15:17:15.085,
      // UNLOCK_ALL on the message at 15:17:15.202. This file used to do the
      // reverse and said the class lock "must be the final release", which the
      // trace refutes.
      this.connection.setSessionType('stateful');
      this.logger?.info?.(`${label}: unlock class`);
      await unlockMessageClass(this.connection, name, classLockHandle);
      releaseClass();

      this.logger?.info?.(`${label}: unlockAllMessages`);
      await unlockAllMessages(this.connection, name, no);
      releaseMessage();

      this.logger?.info?.(`${label}: done`);
      return written;
    });
  }
}

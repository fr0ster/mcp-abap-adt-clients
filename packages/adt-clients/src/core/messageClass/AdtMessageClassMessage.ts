import type {
  AdtObjectIdentity,
  AdtReadVersion,
  IAdtAnalyseOptions,
  IAdtError,
  IAdtMessageClassMessageLockable,
  IAdtMessageClassMessageUpdatable,
  IAdtMetadataReadable,
  IAdtOperationOptions,
  IAdtReadable,
  IAdtResponse,
  IMessageClassMessageRemoval,
  IMessageClassMessageResults,
  IMessageClassMessageUpdateOptions,
  IMessageClassMessageUpsert,
  MessageClassMessageAddress,
} from '@mcp-abap-adt/interfaces-adt';
/**
 * AdtMessageClassMessage — one message within a Message Class (MSAG/N).
 *
 * One member, one request (C7 of #304). A message has no resource of its own:
 * it is read through its class's document and written by a PUT of that
 * document. The locks the PUT needs are members here (`lockMessage`,
 * `lockClassForMessage`, `unlockMessages`) and the class's own (`lock`,
 * `read`, `unlock` of the message class); the caller composes them — the
 * recipe is in the README:
 *
 * 1. read the class document (`readMetadata` with `version: 'workingArea'`);
 * 2. `lockMessage` on the stateful session — a 403 is SAP's answer, and the
 *    caller decides whether to go on without the message's own handle;
 * 3. `lockClassForMessage` — on a 403, the class's plain `lock`;
 * 4. `update`, the PUT, stateless, with the class document, the class handle
 *    and the message handle (the class handle when the message lock was
 *    refused); `removeMessage: true` removes the message;
 * 5. the class's `unlock`, then `unlockMessages` — the class first, as
 *    Eclipse does; and on every way out, the locks the recipe took.
 *
 * (SAP does NOT delete omitted messages on PUT — `<mc:deletedmessages>` is the
 * mechanism. A message-level DELETE /messages/{no} returns 423 and is NOT
 * used.)
 */

import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { MESSAGE_CLASS } from '../../endpoints/objects';
import { answering } from '../../utils/adtResponse';
import { withCallTimeout } from '../../utils/callTimeout';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { lockHandleOf } from '../../utils/lockHandle';
import { updateRequestHeaders } from '../../utils/requestHeaders';
import {
  nothing,
  type ResultStrategiesOf,
  type ResultValuesOf,
} from '../../utils/resultStrategy';
import { inStatefulSession } from '../shared/capabilities/statefulSession';
import type { AdtHandlerOptions } from '../shared/handlerOptions';
import { lockClassForMessage, lockMessage } from './lock';
import { getMessageClassSource } from './read';
import type { IMessageClassMessageConfig, messageDocuments } from './types';
import { unlockAllMessages } from './unlock';
import { buildMessageClassXml, parseMessageClass } from './xml';

const BASE = MESSAGE_CLASS.collection;

/** What each slot of the result set answers. */
export type MessageClassMessageValues = {
  readonly [K in keyof IMessageClassMessageResults]: unknown;
};

/** A message's address: its class and its number. */
type MessageAddress = AdtObjectIdentity<
  IMessageClassMessageConfig,
  MessageClassMessageAddress
>;

export class AdtMessageClassMessage<
  T extends MessageClassMessageValues = ResultValuesOf<typeof messageDocuments>,
> implements
    IAdtReadable<IMessageClassMessageConfig, T['read'], 'className' | 'msgno'>,
    IAdtMetadataReadable<
      IMessageClassMessageConfig,
      T['read'],
      'className' | 'msgno'
    >,
    IAdtMessageClassMessageLockable,
    IAdtMessageClassMessageUpdatable<T['written'], T['deleted']>
{
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  public readonly objectType: string = 'MessageClassMessage';

  private readonly results: ResultStrategiesOf<T>;

  constructor(
    connection: IAbapConnection,
    options: AdtHandlerOptions<ResultStrategiesOf<T>, 'logger'>,
  ) {
    const { logger } = options;
    this.results = options.results;
    this.connection = connection;
    this.logger = logger;
  }

  /** Both identifiers. */
  private names(config: MessageAddress): { name: string; no: string } {
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
  async read<E extends IAdtError = IAdtError>(
    config: MessageAddress,
    version?: AdtReadVersion,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['read'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const { name } = this.names(config);

    return answering(
      () => getMessageClassSource(connection, name, { version }),
      this.results.read,
      // The class answering is not the message existing; a caller who wants
      // an absent message read as a failure passes
      // `analyseMessageClassMessage(msgno)` from @mcp-abap-adt/adt-strategies.
      options?.analyse,
    );
  }

  /** The same class document `read` fetches. */
  async readMetadata<E extends IAdtError = IAdtError>(
    config: MessageAddress,
    options?: {
      withLongPolling?: boolean;
      version?: AdtReadVersion;
    } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['read'], E>> {
    return this.read(config, options?.version, options);
  }

  // ── the message's locks: one request each ─────────────────────────────────

  /**
   * `LOCK_MSG` on the stateful session; its handle goes into the PUT as the
   * message's `mc:lockhandle`. A 403 is SAP's answer: it may be a system that
   * grants no message lock or another user's lock, which is not measured.
   */
  async lockMessage<E extends IAdtError = IAdtError>(
    config: MessageAddress,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<string, E>> {
    const { name, no } = this.names(config);
    return answering(
      () =>
        inStatefulSession(this.connection, () =>
          lockMessage(this.connection, name, no),
        ),
      lockHandleOf,
      options?.analyse,
    );
  }

  /**
   * The class's lock for this message's save (`msgNo`, `onSave=X`); its handle
   * goes into the PUT's `lockHandle`. A 403 is SAP's answer; the class's plain
   * `lock` is what Eclipse takes then.
   */
  async lockClassForMessage<E extends IAdtError = IAdtError>(
    config: MessageAddress,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<string, E>> {
    const { name, no } = this.names(config);
    return answering(
      () =>
        inStatefulSession(this.connection, () =>
          lockClassForMessage(this.connection, name, no),
        ),
      lockHandleOf,
      options?.analyse,
    );
  }

  /** `UNLOCK_ALL` on the message, on the stateful session. */
  async unlockMessages<E extends IAdtError = IAdtError>(
    config: MessageAddress,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<void, E>> {
    const { name, no } = this.names(config);
    return answering(
      () =>
        inStatefulSession(this.connection, () =>
          unlockAllMessages(this.connection, name, no),
        ),
      nothing,
      options?.analyse,
    );
  }

  // ── the write ─────────────────────────────────────────────────────────────

  /**
   * The PUT of the class document, the message upserted into it or — with
   * `removeMessage: true` — removed from it (`<mc:deletedmessages>`), under
   * the two handles given. One request; the document is the one the caller
   * read, and every other message in it stays.
   *
   * **The whole content, every time.** Only the fields the caller names are
   * overridden in an existing message; the rest stays as the document has it.
   */
  update<E extends IAdtError = IAdtError>(
    config: IMessageClassMessageUpsert,
    options: IMessageClassMessageUpdateOptions<E>,
  ): Promise<IAdtResponse<T['written'], E>>;
  update<E extends IAdtError = IAdtError>(
    config: IMessageClassMessageRemoval,
    options: IMessageClassMessageUpdateOptions<E>,
  ): Promise<IAdtResponse<T['deleted'], E>>;
  async update<E extends IAdtError = IAdtError>(
    config: IMessageClassMessageUpsert | IMessageClassMessageRemoval,
    options: IMessageClassMessageUpdateOptions<E>,
  ): Promise<IAdtResponse<T['written'] | T['deleted'], E>> {
    // The caller's deadline, if they set one, on the request.
    const connection = withCallTimeout(this.connection, options.timeout);
    const name = config.className;
    const no = String(config.msgno);
    const cls = parseMessageClass(options.classDocument);

    if (config.removeMessage !== true) {
      const existing = cls.messages.findIndex((m) => m.msgno === no);
      const authored = {
        msgtext: config.msgtext,
        ...(config.selfExplanatory !== undefined
          ? { selfExplanatory: config.selfExplanatory }
          : {}),
        ...(config.description !== undefined
          ? { description: config.description }
          : {}),
      };
      if (existing >= 0) {
        cls.messages[existing] = { ...cls.messages[existing], ...authored };
      } else {
        cls.messages.push({ msgno: no, ...authored });
      }
    }

    const xmlBody = buildMessageClassXml(cls, {
      ...(config.removeMessage === true ? { deletedMsgnos: [no] } : {}),
      messageLockHandles: { [no]: options.messageLockHandle },
    });
    const encoded = encodeSapObjectName(name.toLowerCase());
    const corrNr = config.transportRequest?.trim()
      ? `&corrNr=${encodeURIComponent(config.transportRequest)}`
      : '';
    this.logger?.info?.(
      `${config.removeMessage === true ? 'removeMessage' : 'upsertMessage'}: PUT`,
    );

    return answering(
      () =>
        connection.makeAdtRequest({
          url: `${BASE}/${encoded}?lockHandle=${encodeURIComponent(options.classLockHandle)}${corrNr}`,
          method: 'PUT',
          timeout: 0,
          data: xmlBody,
          headers: updateRequestHeaders(
            options.headers,
            options.ifMatch,
            'dropped',
          ),
        }),
      config.removeMessage === true
        ? this.results.deleted
        : this.results.written,
      options.analyse,
    );
  }
}

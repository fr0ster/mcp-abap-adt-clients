/**
 * The caller's recipe for writing one message (C7 of #304), the README's:
 * read the class document, lock the message (a 403 leaves the class handle to
 * stand in), lock the class for the message (a 403 falls back to the plain
 * class lock), write, then unlock the class and the message. Each lock taken
 * is given up in a `finally`, on every way out — a failed answer, a thrown
 * credential refusal — in the old chain's order, an unlock that failed tried
 * once more, as the chain's scope ends did.
 */
import { analyseException } from '@mcp-abap-adt/adt-strategies';
import type {
  IAdtError,
  IAdtHeaders,
  IAdtResponse,
} from '@mcp-abap-adt/interfaces-adt';
import type { AdtMessageClass } from '../../core/messageClass/AdtMessageClass';
import type { AdtMessageClassMessage } from '../../core/messageClass/AdtMessageClassMessage';

export interface IMessageWrite {
  readonly className: string;
  readonly msgno: string;
  readonly msgtext?: string;
  readonly transportRequest?: string | undefined;
  readonly removeMessage?: boolean;
}

/** Every step judged by `analyseException`: the exception document read first. */
export async function writeMessage(
  // Any result set: the recipe reads only the class document's text.
  messageClass: AdtMessageClass<any, any>,
  message: AdtMessageClassMessage<any>,
  config: IMessageWrite,
  options: { headers: IAdtHeaders },
): Promise<IAdtResponse<unknown, IAdtError>> {
  const klass = { name: config.className };
  const address = { className: config.className, msgno: config.msgno };
  const read = await messageClass.readMetadata(klass, {
    version: 'workingArea',
    analyse: analyseException,
  });
  if (!read.ok) return read;
  const messageLock = await message.lockMessage(address, {
    analyse: analyseException,
  });
  if (!messageLock.ok && messageLock.getError().response?.status !== 403)
    return messageLock;
  // Every lock taken is given up on every way out, in the old chain's order:
  // the class first, then the message; an unlock that failed is tried once
  // more on the way out, as the chain's scope ends did.
  let messageHeld = true;
  try {
    let classLock = await message.lockClassForMessage(address, {
      analyse: analyseException,
    });
    if (!classLock.ok && classLock.getError().response?.status === 403)
      classLock = await messageClass.lock(klass, { analyse: analyseException });
    if (!classLock.ok) return classLock;
    const classLockHandle = classLock.getResult().value;
    let classHeld = true;
    try {
      const under = {
        headers: options.headers,
        classDocument: String(read.getResult().value),
        classLockHandle,
        messageLockHandle: messageLock.ok
          ? messageLock.getResult().value
          : classLockHandle,
        analyse: analyseException,
      };
      const written = config.removeMessage
        ? await message.update(
            {
              ...address,
              transportRequest: config.transportRequest,
              removeMessage: true,
            },
            {
              headers: under.headers,
              classDocument: under.classDocument,
              classLockHandle: under.classLockHandle,
              messageLockHandle: under.messageLockHandle,
              analyse: analyseException,
            },
          )
        : await message.update(
            {
              ...address,
              msgtext: config.msgtext ?? '',
              transportRequest: config.transportRequest,
            },
            {
              headers: under.headers,
              classDocument: under.classDocument,
              classLockHandle: under.classLockHandle,
              messageLockHandle: under.messageLockHandle,
              analyse: analyseException,
            },
          );
      if (!written.ok) return written;
      const classUnlocked = await messageClass.unlock(klass, classLockHandle, {
        analyse: analyseException,
      });
      if (!classUnlocked.ok) return classUnlocked;
      classHeld = false;
      const messageUnlocked = await message.unlockMessages(address, {
        analyse: analyseException,
      });
      if (!messageUnlocked.ok) return messageUnlocked;
      messageHeld = false;
      return written;
    } finally {
      if (classHeld)
        await messageClass.unlock(klass, classLockHandle, {
          analyse: analyseException,
        });
    }
  } finally {
    if (messageHeld)
      await message.unlockMessages(address, { analyse: analyseException });
  }
}

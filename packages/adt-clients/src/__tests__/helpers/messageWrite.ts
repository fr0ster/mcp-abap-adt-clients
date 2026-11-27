/**
 * The caller's recipe for writing one message (C7 of #304), the README's:
 * read the class document, lock the message (a 403 leaves the class handle to
 * stand in), lock the class for the message (a 403 falls back to the plain
 * class lock), write, then unlock the class and the message — and on every
 * way out, the locks it took.
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
  let classLock = await message.lockClassForMessage(address, {
    analyse: analyseException,
  });
  if (!classLock.ok && classLock.getError().response?.status === 403)
    classLock = await messageClass.lock(klass, { analyse: analyseException });
  if (!classLock.ok) {
    await message.unlockMessages(address, { analyse: analyseException });
    return classLock;
  }
  const classLockHandle = classLock.getResult().value;
  const classDocument = String(read.getResult().value);
  const messageLockHandle = messageLock.ok
    ? messageLock.getResult().value
    : classLockHandle;
  const written = config.removeMessage
    ? await message.update(
        {
          ...address,
          transportRequest: config.transportRequest,
          removeMessage: true,
        },
        {
          headers: options.headers,
          classDocument,
          classLockHandle,
          messageLockHandle,
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
          headers: options.headers,
          classDocument,
          classLockHandle,
          messageLockHandle,
          analyse: analyseException,
        },
      );
  await messageClass.unlock(klass, classLockHandle, {
    analyse: analyseException,
  });
  await message.unlockMessages(address, { analyse: analyseException });
  return written;
}

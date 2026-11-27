/**
 * The caller's recipe for writing one message (C7 of #304), as the probe runs
 * it: read the class document, lock the message (a 403 leaves the class
 * handle to stand in), lock the class for the message (a 403 falls back to
 * the plain class lock), the one PUT under the pair given, then unlock the
 * class and the message — and on every way out, the locks it took. Only
 * the PUT is judged by the run's `analyse` (the probe's recorder keeps the
 * wire of the last answer it judges, and the PUT is the request the pair
 * goes out on); the steps around it read their answers by the client's own
 * reading, as the one member of the old chain did.
 */
import type {
  IAdtHeaders,
  IAdtResponse,
  IAnalyse,
} from '@mcp-abap-adt/interfaces-adt';
import type { AdtMessageClass } from '../../src/core/messageClass/AdtMessageClass';
import type { AdtMessageClassMessage } from '../../src/core/messageClass/AdtMessageClassMessage';

/** The two handlers the recipe works with. */
export interface IMessageHandlers {
  // Any result set: the recipe reads only the class document's text.
  readonly messageClass: AdtMessageClass<any, any>;
  readonly message: AdtMessageClassMessage<any>;
}

export interface IProbeMessage {
  readonly className: string;
  readonly msgno: string;
  readonly msgtext: string;
  readonly transportRequest?: string | undefined;
}

export async function upsertMessage(
  { messageClass, message }: IMessageHandlers,
  config: IProbeMessage,
  headers: IAdtHeaders,
  analyse: IAnalyse,
): Promise<IAdtResponse<unknown>> {
  const klass = { name: config.className };
  const address = { className: config.className, msgno: config.msgno };
  const read = await messageClass.readMetadata(klass, {
    version: 'workingArea',
  });
  if (!read.ok) return read;
  const messageLock = await message.lockMessage(address);
  if (!messageLock.ok && messageLock.getError().response?.status !== 403)
    return messageLock;
  let classLock = await message.lockClassForMessage(address);
  if (!classLock.ok && classLock.getError().response?.status === 403)
    classLock = await messageClass.lock(klass);
  if (!classLock.ok) {
    await message.unlockMessages(address);
    return classLock;
  }
  const classLockHandle = classLock.getResult().value;
  const written = await message.update(
    {
      ...address,
      msgtext: config.msgtext,
      transportRequest: config.transportRequest,
    },
    {
      headers,
      classDocument: String(read.getResult().value),
      classLockHandle,
      messageLockHandle: messageLock.ok
        ? messageLock.getResult().value
        : classLockHandle,
      analyse,
    },
  );
  await messageClass.unlock(klass, classLockHandle);
  await message.unlockMessages(address);
  return written;
}

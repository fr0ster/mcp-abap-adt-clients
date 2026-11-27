/**
 * C7 of #304: the message class message is four members, one request each.
 * Its create and delete are gone; its update requires the class document,
 * both handles and, for an upsert, the text.
 *
 * Type-level only, compiled by `npm run test:check`; nothing here runs.
 */
import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type { AdtClient } from '../../clients/AdtClient';

declare const client: AdtClient;
declare const headers: IAdtHeaders;
const message = client.getMessageClassMessage();
const address = { className: 'ZMC', msgno: '001' };
const full = {
  headers,
  classDocument: '<doc/>',
  classLockHandle: 'CH',
  messageLockHandle: 'MH',
};

export async function messageMembers(): Promise<void> {
  // @ts-expect-error -- create is gone: a message is written by update
  void message.create;
  // @ts-expect-error -- delete is gone: removeMessage: true on update
  void message.delete;
  await message.update({ ...address, msgtext: 'text' }, full);
  await message.update({ ...address, removeMessage: true }, full);
  // @ts-expect-error -- an upsert names its text
  await message.update(address, full);
  const { classLockHandle: _c, ...noClassHandle } = full;
  // @ts-expect-error -- the class handle is required
  await message.update({ ...address, msgtext: 't' }, noClassHandle);
  const { messageLockHandle: _m, ...noMessageHandle } = full;
  // @ts-expect-error -- the message handle is required
  await message.update({ ...address, msgtext: 't' }, noMessageHandle);
  const { classDocument: _d, ...noDocument } = full;
  // @ts-expect-error -- the class document is required
  await message.update({ ...address, msgtext: 't' }, noDocument);
  await message.lockMessage(address);
  await message.lockClassForMessage(address);
  await message.unlockMessages(address);
}

/**
 * Message class operations - public exports
 */

export {
  AdtMessageClass,
  type MessageClassValues,
} from './AdtMessageClass';
export {
  AdtMessageClassMessage,
  type MessageClassMessageValues,
} from './AdtMessageClassMessage';
export {
  type IMessageClassChanges,
  patchMessageClassDocument,
} from './patch';
export * from './types';
export type { IParsedMessage, IParsedMessageClass } from './xml';
export { buildMessageClassXml, parseMessageClass } from './xml';

/**
 * Message class operations - public exports
 */

import type {
  IAdtCrud,
  IAdtLockable,
  IAdtValidatable,
} from '@mcp-abap-adt/interfaces';
import type {
  IMessageClassConfig,
  IMessageClassMessageConfig,
  IMessageClassMessageState,
  IMessageClassState,
} from './types';

export { AdtMessageClass } from './AdtMessageClass';
export { AdtMessageClassMessage } from './AdtMessageClassMessage';
export * from './types';
export type { IParsedMessage, IParsedMessageClass } from './xml';
export { buildMessageClassXml, parseMessageClass } from './xml';

// Type alias for AdtMessageClass
export type AdtMessageClassType = IAdtCrud<
  IMessageClassConfig,
  IMessageClassState
> &
  IAdtValidatable<IMessageClassConfig, IMessageClassState> &
  IAdtLockable<IMessageClassConfig, IMessageClassState>;

// Type alias for AdtMessageClassMessage
export type AdtMessageClassMessageType = IAdtCrud<
  IMessageClassMessageConfig,
  IMessageClassMessageState
>;

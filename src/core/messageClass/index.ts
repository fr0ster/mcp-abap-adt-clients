/**
 * Message class operations - public exports
 */

import type { IAdtObject } from '@mcp-abap-adt/interfaces';
import type { IMessageClassConfig, IMessageClassState } from './types';

export { AdtMessageClass } from './AdtMessageClass';
export * from './types';
export type { IParsedMessage, IParsedMessageClass } from './xml';
export { buildMessageClassXml, parseMessageClass } from './xml';

// Type alias for AdtMessageClass
export type AdtMessageClassType = IAdtObject<
  IMessageClassConfig,
  IMessageClassState
>;

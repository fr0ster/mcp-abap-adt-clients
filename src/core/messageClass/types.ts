/**
 * Message class module type definitions
 */

import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';
import type { IParsedMessage, IParsedMessageClass } from './xml';

// Low-level function parameters (snake_case) — defined in @mcp-abap-adt/interfaces
export type {
  ICreateMessageClassParams,
  IDeleteMessageClassParams,
} from '@mcp-abap-adt/interfaces';

// High-level configuration (camelCase, public API)
export interface IMessageClassConfig {
  /** Message class name (e.g. ZMY_MSGS) */
  name: string;
  /** Short description */
  description?: string;
  /** Package name — required for create */
  packageName?: string;
  /** Transport request — sent as corrNr (create/update) or <del:transportNumber> (delete) for transportable packages */
  transportRequest?: string;
  /** Master language of the message class — defaults to 'EN' on create */
  masterLanguage?: string;
}

// State returned from operations
export interface IMessageClassState extends IAdtObjectState {
  /** Parsed message class returned after read() */
  messageClass?: IParsedMessageClass;
}

// ── Individual message config/state ───────────────────────────────────────────

/** Configuration for operating on a single message within a message class. */
export interface IMessageClassMessageConfig {
  /** Parent message class name (e.g. ZMY_MSGS) */
  className: string;
  /** Message number (e.g. '001') */
  msgno: string;
  /** Message text — required for create/update */
  msgtext?: string;
  /** Whether the message is self-explanatory (mc:selfexplainatory attribute) */
  selfExplanatory?: boolean;
  /** Long description for the message (adtcore:description attribute) */
  description?: string;
  /** Transport request — sent as &corrNr= on the parent-class PUT for create/update/delete (transportable packages) */
  transportRequest?: string;
}

/** State returned from operations on a single message. */
export interface IMessageClassMessageState extends IAdtObjectState {
  /** The individual message extracted from the parent class */
  message?: IParsedMessage;
}

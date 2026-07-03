/**
 * Message class module type definitions
 */

import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';
import type { IParsedMessageClass } from './xml';

// Low-level function parameters (snake_case)
export interface ICreateMessageClassParams {
  name: string;
  description: string;
  package_name: string;
  transport_request?: string;
}

export interface IDeleteMessageClassParams {
  name: string;
  transport_request?: string;
}

// High-level configuration (camelCase, public API)
export interface IMessageClassConfig {
  /** Message class name (e.g. ZMY_MSGS) */
  name: string;
  /** Short description */
  description?: string;
  /** Package name — required for create */
  packageName?: string;
  /** Transport request — parsed but not sent until Task 6.2 wires corrNr */
  transportRequest?: string;
}

// State returned from operations
export interface IMessageClassState extends IAdtObjectState {
  /** Parsed message class returned after read() */
  messageClass?: IParsedMessageClass;
}

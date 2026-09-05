/**
 * MessageClass module type definitions.
 *
 * `IMessageClassState` is gone with the other state bags: a member now answers what
 * its own endpoint produced, and a failure carries the request that produced it.
 * What each member answers is declared here, beside the implementation that
 * produces it, because a result is the implementation's to name — the contract
 * says only that it is answered.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces';
import { rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type {
  ICreateMessageClassParams,
  IMessageClassConfig,
  IMessageClassMessageConfig,
} from '@mcp-abap-adt/interfaces';

/**
 * What the create answers: the message class's document.
 *
 * The create makes a shell — name, description, package. The messages inside it
 * are written through `AdtMessageClassMessage`.
 */
export type MessageClassCreated = string;

/**
 * What `read` answers: the message class document, messages and all.
 *
 * A message class has no source and no second resource — `read` and
 * `readMetadata` fetch the same thing. `parseMessageClass` in this module is the
 * reading a consumer can compose if they want the messages as a list.
 */
export type MessageClassSource = string;

/**
 * The same document `read` fetches.
 */
export type MessageClassMetadata = string;

/**
 * What the validation endpoint answers.
 */
export type MessageClassValidationResult = string;

/**
 * What the deletion answers.
 */
export type MessageClassDeletionResult = string;

/**
 * What the metadata write answers.
 */
export type MessageClassUpdated = string;

/** One strategy per member of a messageClass implementation. See `IClassResults`. */
export interface IMessageClassResults<
  TCreated = MessageClassCreated,
  TSource = MessageClassSource,
  TMetadata = MessageClassMetadata,
  TValidation = MessageClassValidationResult,
  TDeletion = MessageClassDeletionResult,
  TUpdated = MessageClassUpdated,
> {
  readonly created: IResultStrategy<TCreated>;
  readonly source: IResultStrategy<TSource>;
  readonly metadata: IResultStrategy<TMetadata>;
  readonly validation: IResultStrategy<TValidation>;
  readonly deletion: IResultStrategy<TDeletion>;
  readonly updated: IResultStrategy<TUpdated>;
}

/**
 * The shipped default: every member answers its document as it arrived.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const messageClassDocuments = {
  created: rawDocument,
  source: rawDocument,
  metadata: rawDocument,
  validation: rawDocument,
  deletion: rawDocument,
  updated: rawDocument,
} satisfies IMessageClassResults;

/**
 * What each member of the message-level handler answers.
 *
 * A message is written through its **parent class's** document: ADT has no
 * resource for one message, so `create`, `update` and `delete` all PUT the
 * whole class with that message added, changed or removed. Every one of them
 * therefore answers what that PUT answered.
 */
export interface IMessageClassMessageResults<
  TRead = string,
  TWritten = string,
  TDeleted = string,
> {
  readonly read: IResultStrategy<TRead>;
  readonly written: IResultStrategy<TWritten>;
  readonly deleted: IResultStrategy<TDeleted>;
}

/** The shipped default: the parent class's document, as it arrived. */
export const messageDocuments = {
  read: rawDocument,
  written: rawDocument,
  deleted: rawDocument,
} satisfies IMessageClassMessageResults;

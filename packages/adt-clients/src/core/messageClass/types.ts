/**
 * MessageClass module type definitions.
 *
 * `IMessageClassState` is gone with the other state bags: a member now answers what
 * its own endpoint produced, and a failure carries the request that produced it.
 * What each member answers is declared here, beside the implementation that
 * produces it, because a result is the implementation's to name — the contract
 * says only that it is answered.
 */

import type {
  IMessageClassMessageResults,
  IMessageClassResults,
} from '@mcp-abap-adt/interfaces-adt';
import { rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type {
  IMessageClassConfig,
  IMessageClassMessageConfig,
} from '@mcp-abap-adt/interfaces-adt';

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
  metadataUpdated: rawDocument,
  deletionCheck: rawDocument,
} satisfies IMessageClassResults;

/** The shipped default: the parent class's document, as it arrived. */
export const messageDocuments = {
  read: rawDocument,
  written: rawDocument,
  deleted: rawDocument,
} satisfies IMessageClassMessageResults;

/**
 * The shapes below describe the argument of the request builders in this
 * module, and they used to be declared in `@mcp-abap-adt/interfaces`. Nobody
 * outside this package ever accepted them — no parameter, field or return
 * anywhere else was typed by one — and being nobody's contract is how 85 of
 * their fields came to be ignored by the very code that took them, for
 * releases, unnoticed. They live here now, beside the function that reads
 * them, which is the only place that can keep them honest. See decision 30 in
 * the interfaces repository.
 */

export interface ICreateMessageClassParams {
  name: string;
  description: string;
  package_name: string;
  transport_request?: string;
  master_language?: string;
  masterSystem?: string;
  responsible?: string;
}

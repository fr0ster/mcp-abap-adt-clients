/**
 * Transport module type definitions.
 *
 * The tree shapes and the readings that build them moved to
 * `@mcp-abap-adt/adt-strategies` in 23.0.0 (`transportTree` and its types):
 * this implementation answers documents as they arrived.
 */

export type { IAbapObjectEntry } from '@mcp-abap-adt/interfaces-adt';

import type { IResultStrategy } from '@mcp-abap-adt/interfaces-adt';
import { rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type {
  IListTransportsParams,
  ITransportConfig,
} from '@mcp-abap-adt/interfaces-adt';

/**
 * One strategy per member of a transport-request implementation.
 *
 * Every slot is required. The seven that arrived after 19.0.0 were optional
 * and fell back to the shipped defaults inside the implementation, which kept
 * a hand-written result set compiling at the cost of a reading the caller had
 * not chosen. A result set now names every reading it answers.
 */
export interface ITransportResults {
  /** What the create answers: the created-request document. */
  readonly created: IResultStrategy<unknown>;
  /** What a read of one request answers. */
  readonly metadata: IResultStrategy<unknown>;
  /** What the listing answers: the transport tree document. */
  readonly list: IResultStrategy<unknown>;
  /** What the description update answers. */
  readonly metadataUpdated: IResultStrategy<unknown>;
  /** What the deletion answers. */
  readonly deleted: IResultStrategy<unknown>;
  /** What a deletion check answers: `del:checkResponse`. */
  readonly deletionCheck: IResultStrategy<unknown>;
  /** What the saved-search listing answers. */
  readonly searchConfigurations: IResultStrategy<unknown>;
  /**
   * What detaching an object answers.
   *
   * It repeats the object that was asked about and says nothing else, so the
   * reading that confirms a removal is `readActionLog`, not this.
   */
  readonly removedObject: IResultStrategy<unknown>;
  /** What attaching an object answers. */
  readonly addedObject: IResultStrategy<unknown>;
  /**
   * What creating a task answers: the new task's document, carrying its
   * number the way `created` carries a new request's.
   */
  readonly createdTask: IResultStrategy<unknown>;
  /** What the action log answers. */
  readonly actionLog: IResultStrategy<unknown>;
  /**
   * What giving a task its type answers: the organizer's own echo. A `200`
   * says the request was understood; a re-read is what shows the type.
   */
  readonly taskTypeChanged: IResultStrategy<unknown>;
  /**
   * What the object list answers: the request document, whose
   * `tm:abap_object` entries carry the `tm:position` `removeObject` needs.
   */
  readonly objects: IResultStrategy<unknown>;
}

/**
 * The shipped default: every member answers its document as it arrived.
 *
 * The readings that used to be the defaults here — `parseCreatedTransport`
 * (created, createdTask), `parseTransportTree` (list),
 * `parseSearchConfigurations` (searchConfigurations) and `parseObjectEntries`
 * (objects) — are strategies a caller passes; the library interprets nothing
 * on its own.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const transportDocuments = {
  created: rawDocument,
  metadata: rawDocument,
  list: rawDocument,
  metadataUpdated: rawDocument,
  deleted: rawDocument,
  deletionCheck: rawDocument,
  searchConfigurations: rawDocument,
  removedObject: rawDocument,
  addedObject: rawDocument,
  createdTask: rawDocument,
  actionLog: rawDocument,
  taskTypeChanged: rawDocument,
  objects: rawDocument,
} satisfies ITransportResults;

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

export interface ICreateTransportParams {
  transport_type?: string;
  description: string;
  target_system?: string;
  owner?: string;
}

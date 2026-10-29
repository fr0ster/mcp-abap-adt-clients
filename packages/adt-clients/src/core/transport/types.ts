/**
 * Transport module type definitions.
 *
 * The tree shapes and the readings that build them moved to
 * `@mcp-abap-adt/adt-strategies` in 23.0.0 (`transportTree` and its types):
 * this implementation answers documents as they arrived.
 */

export type { IAbapObjectEntry } from '@mcp-abap-adt/interfaces-adt';

import type { ITransportResults } from '@mcp-abap-adt/interfaces-adt';
import { rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type {
  IListTransportsParams,
  ITransportConfig,
} from '@mcp-abap-adt/interfaces-adt';

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
  sortedAndCompressed: rawDocument,
  movedObjects: rawDocument,
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

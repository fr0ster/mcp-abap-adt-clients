/**
 * One strategy per member of `AdtUtils` that makes a request.
 *
 * The atoms in `@mcp-abap-adt/interfaces` are generic in what they answer —
 * `IAdtInformationSystem<TSearch, TWhereUsed, TScope, TFolders, TTypes>`,
 * `IAdtObjectAccess<TSource, TMetadata, TInclude>` and their neighbours — and
 * this set fills every one of them in.
 *
 * **The line is measured, not felt.** A result strategy reads *an answer*, so a
 * member belongs here exactly when it makes one request. Since 19.0.0 every
 * member of `AdtUtils` that reaches ADT makes exactly one — the walks, the
 * chains and the read-modify-writes left — so all twenty-one are here.
 *
 * Three members are absent and always will be. `modifyWhereUsedScope` edits a
 * document it was handed, `supportsSourceCode` answers from a table in this
 * package, and `getObjectSourceUri` builds an address. None of them has an
 * answer to read.
 *
 * **Every default is the document.** Before this release five slots
 * defaulted to a parse — search hits, the type catalogue, the tree level, the
 * inactive list and the activation run id — and two of those parses judged the
 * answer on the way (`throwIfSapError` inside a reading). They moved to
 * `@mcp-abap-adt/adt-strategies` as `utilSearchHits`, `utilNamedItems`,
 * `utilNodeContents`, `utilInactiveObjects` and `utilActivationRunId`, with
 * `utilWhereUsedReferences` beside them; a caller who wants a shape passes one
 * of those in the set, and nothing is read into an answer they did not ask
 * for.
 */

import type { IUtilResults } from '@mcp-abap-adt/interfaces-adt';
import { rawDocument } from '../../utils/resultStrategy';

/**
 * The shipped default.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const utilDocuments = {
  search: rawDocument,
  whereUsed: rawDocument,
  whereUsedScope: rawDocument,
  folders: rawDocument,
  types: rawDocument,
  node: rawDocument,
  objectStructure: rawDocument,
  inactive: rawDocument,
  activation: rawDocument,
  run: rawDocument,
  results: rawDocument,
  deletionCheck: rawDocument,
  deletion: rawDocument,
  query: rawDocument,
  columns: rawDocument,
  contents: rawDocument,
  discovery: rawDocument,
  source: rawDocument,
  metadata: rawDocument,
  include: rawDocument,
  objectProperties: rawDocument,
} satisfies IUtilResults;

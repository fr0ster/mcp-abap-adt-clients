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
 * chains and the read-modify-writes left — so all twenty are here.
 *
 * Three members are absent and always will be. `modifyWhereUsedScope` edits a
 * document it was handed, `supportsSourceCode` answers from a table in this
 * package, and `getObjectSourceUri` builds an address. None of them has an
 * answer to read.
 *
 * **Fifteen of these slots were added in 19.0.0 and they were not a widening.**
 * Until 44.0.0 of the contract those members were typed `IAdtResponse<string>`,
 * so the *contract* had chosen the document and no reading could have been
 * offered for them. What changed is whose choice it is. The defaults keep the
 * document, so nothing a caller sees today moves.
 *
 * The five that do not default to the document earn it: a search that answered
 * its 1.3MB listing rather than its hits would make every caller parse it, and
 * a started activation run answers a `Location` header whose id is the only way
 * to reach the run's own two members. `rawDocument` is one argument away in
 * both cases.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces';
import { rawDocument } from '../../utils/resultStrategy';
import { inactiveObjects } from './getInactiveObjects';
import {
  activationRunId,
  namedItems,
  nodeContents,
  searchHits,
} from './utilResults';

export interface IUtilResults {
  /** Hits of an object search — `/informationsystem/search`. */
  readonly search: IResultStrategy<unknown>;
  /**
   * What `/usageReferences` answers.
   *
   * The default is the document. A parsed reference list used to be what
   * `getWhereUsedList` returned, and that member joined two requests to get
   * there — the scope, then the search — so it could never be given a reading
   * at all. Now the join is the caller's and the shape is a reading like any
   * other. `whereUsedReferences` is that parse, exported for whoever wants it.
   */
  readonly whereUsed: IResultStrategy<unknown>;
  /** The scope document `/usageReferences/scope` answers. */
  readonly whereUsedScope: IResultStrategy<unknown>;
  /** What one virtual-folder level answers — `/virtualfolders/contents`. */
  readonly folders: IResultStrategy<unknown>;
  /** A named-item list — the repository's types. */
  readonly types: IResultStrategy<unknown>;
  /** One level of the repository tree, with what is below it. */
  readonly node: IResultStrategy<unknown>;
  /** What `/nodestructure` answers for a single object. */
  readonly objectStructure: IResultStrategy<unknown>;
  /** What `/activation/inactiveobjects` answers. */
  readonly inactive: IResultStrategy<unknown>;
  /**
   * What starting an activation run answers.
   *
   * The default is the **run id**, not the document: `/activation/runs` answers
   * `202` with the id in `Location` and a body that carries nothing, and both
   * members that continue the sequence take an id.
   */
  readonly activation: IResultStrategy<unknown>;
  /** What an activation run is doing — `/activation/runs/{runId}`. */
  readonly run: IResultStrategy<unknown>;
  /** What an activation run produced — `/activation/results/{runId}`. */
  readonly results: IResultStrategy<unknown>;
  /** ADT's answer to whether a set of objects may be deleted. */
  readonly deletionCheck: IResultStrategy<unknown>;
  /** ADT's answer to deleting a set of objects. */
  readonly deletion: IResultStrategy<unknown>;
  /** What a freestyle SQL query answers — `/datapreview/freestyle`. */
  readonly query: IResultStrategy<unknown>;
  /** A table's columns — `/datapreview/ddic/{name}/metadata`. */
  readonly columns: IResultStrategy<unknown>;
  /** A table's rows — `/datapreview/ddic`. */
  readonly contents: IResultStrategy<unknown>;
  /** The discovery catalogue — `/discovery`. */
  readonly discovery: IResultStrategy<unknown>;
  /** An object's source — `<objectUri>/source/main`. */
  readonly source: IResultStrategy<unknown>;
  /** An object's metadata document, without its source. */
  readonly metadata: IResultStrategy<unknown>;
  /** One include of a program — `/programs/includes/{name}`. */
  readonly include: IResultStrategy<unknown>;
}

/**
 * The shipped default.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const utilDocuments = {
  search: searchHits,
  whereUsed: rawDocument,
  whereUsedScope: rawDocument,
  folders: rawDocument,
  types: namedItems,
  node: nodeContents,
  objectStructure: rawDocument,
  inactive: inactiveObjects,
  activation: activationRunId,
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
} satisfies IUtilResults;

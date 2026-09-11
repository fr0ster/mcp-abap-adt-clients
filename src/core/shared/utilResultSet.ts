/**
 * One strategy per member of `AdtUtils` that has a single answer to read.
 *
 * The atoms in `@mcp-abap-adt/interfaces` are generic in what they answer —
 * `IAdtInformationSystem<TSearch, TWhereUsed, TTypes>`,
 * `IAdtRepositoryStructure<TNode>` and their neighbours — and this set fills in
 * the ones a reading can choose.
 *
 * **Not every member is here, and the line is measured rather than felt.** A
 * result strategy reads *an answer*, so a member qualifies exactly when it makes
 * one request:
 *
 * | member | requests | strategy |
 * |---|---|---|
 * | `search`, `getAllTypes`, `fetchNodeStructure` | one each | here |
 * | `getInactiveObjects` | one GET | here, since 18.0.0 |
 * | `getWhereUsedList` | the scope, then the search | no single answer |
 *
 * The last three assemble one shape from several answers, which is not what
 * `IResultStrategy<T> = (answer: IAdtWireResponse) => T` types. They answer the
 * shape they measured, and a consumer who wants another writes their own
 * `IAdtInformationSystem` — which is what the contract
 * being an interface is for. That the factory cannot hand them one is recorded
 * as open in `DECISIONS.md`; it is a gap in the *composition*, not a reading
 * that was forgotten here.
 *
 * The defaults here are not documents: a search that answered its 1.3MB
 * document rather than its hits would make every caller parse it, and the hits
 * are what a caller does something with. `rawDocument` is one argument away.
 *
 * The members the contract types as `IAdtResponse<string>` — discovery, the
 * data preview, the virtual folders, the group operations — are not in this set
 * at all: the contract already fixed what they answer, and a strategy over them
 * would be this package widening a signature its consumers read.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces';
import { inactiveObjects } from './getInactiveObjects';
import { namedItems, nodeContents, searchHits } from './utilResults';

export interface IUtilResults {
  /** Hits of an object search. */
  readonly search: IResultStrategy<unknown>;
  /** A named-item list — the repository's types. */
  readonly types: IResultStrategy<unknown>;
  /** One level of the repository tree, with what is below it. */
  readonly node: IResultStrategy<unknown>;
  /** What `/activation/inactiveobjects` answers — one GET, one answer. */
  readonly inactive: IResultStrategy<unknown>;
}

/**
 * The shipped default.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const utilDocuments = {
  search: searchHits,
  types: namedItems,
  node: nodeContents,
  inactive: inactiveObjects,
} satisfies IUtilResults;

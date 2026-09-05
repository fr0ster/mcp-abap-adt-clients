/**
 * One strategy per member of `AdtUtils` that has a single answer to read.
 *
 * The atoms in `@mcp-abap-adt/interfaces` are generic in what they answer —
 * `IAdtInformationSystem<TSearch, TWhereUsed, TTypes>`,
 * `IAdtRepositoryStructure<TNode>` and their neighbours — and this set fills in
 * the ones a reading can choose.
 *
 * **Not every member is here.** A result strategy reads *an answer*; the
 * package walk, the package tree, the where-used list and the inactive-objects
 * listing each make several requests and assemble one shape from all of them,
 * so there is no single answer to hand a strategy. Those members answer the
 * shape they measured, and a consumer who wants another writes their own
 * `IAdtPackageBrowsing` — which is what the contract being an interface is for.
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
import {
  type INamedItem,
  type IRepositoryNodeContents,
  type ISearchResult,
  namedItems,
  nodeContents,
  searchHits,
} from './utilResults';

export interface IUtilResults<
  TSearch = ISearchResult[],
  TTypes = INamedItem[],
  TNode = IRepositoryNodeContents,
> {
  /** Hits of an object search. */
  readonly search: IResultStrategy<TSearch>;
  /** A named-item list — the repository's types. */
  readonly types: IResultStrategy<TTypes>;
  /** One level of the repository tree, with what is below it. */
  readonly node: IResultStrategy<TNode>;
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
} satisfies IUtilResults;

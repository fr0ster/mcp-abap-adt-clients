/**
 * The result strategies an abapGit client is constructed with.
 *
 * One per member, given once, so every call through the client answers the
 * shape its strategy makes (decision 22 in the interfaces repository). The
 * shipped default reads nothing: each member answers the document ADT sent,
 * and `unlink` — a DELETE with nothing to read — answers nothing. The readings
 * that used to be applied here (`IAbapGitRepoStatus` and the rest) are
 * `abapGitRepos`, `abapGitErrorLog` and `abapGitExternalRepo` in
 * `@mcp-abap-adt/adt-strategies`, for a caller who wants those shapes.
 */
import type { IResultStrategy } from '@mcp-abap-adt/interfaces-adt';
import { nothing, rawDocument } from '../../utils/resultStrategy';

export interface IAbapGitResults {
  readonly linked: IResultStrategy<unknown>;
  readonly pulled: IResultStrategy<unknown>;
  readonly unlinked: IResultStrategy<unknown>;
  readonly repos: IResultStrategy<unknown>;
  readonly errorLog: IResultStrategy<unknown>;
  readonly externalRepo: IResultStrategy<unknown>;
}

/**
 * The shipped default: documents as they arrived.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const abapGitDocuments = {
  linked: rawDocument,
  pulled: rawDocument,
  unlinked: nothing,
  repos: rawDocument,
  errorLog: rawDocument,
  externalRepo: rawDocument,
} satisfies IAbapGitResults;

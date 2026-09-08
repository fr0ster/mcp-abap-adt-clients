/**
 * abapGit client type definitions.
 *
 * The contract types (IAdtAbapGitClient and friends) live in
 * @mcp-abap-adt/interfaces — a consumer must import them to use the client
 * at all, and that package is the one place to import from. Only the two
 * error shapes below stay here: they are not part of the public contract,
 * only thrown internally by the poll loop.
 */

/** The status ADT reports for a linked repository. `R` while a pull runs. */
export type AbapGitStatus = 'R' | 'E' | 'A' | string;

/**
 * One linked repository, as `/sap/bc/adt/abapgit/repos` reports it.
 *
 * It left `@mcp-abap-adt/interfaces` in 31.0.0 with the other result shapes:
 * `IAdtAbapGitClient<TRepos, TRepo, TErrorLog, TPull, TExternalRepo>` says
 * every member answers *something*, and what that something looks like is this
 * implementation's to name.
 */
export interface IAbapGitRepoStatus {
  package: string;
  url: string;
  branchName: string;
  status: AbapGitStatus;
  statusText: string;
  createdBy?: string;
  createdAt?: string;
  repositoryId?: string;
}

/** One line of a pull's error log. */
export interface IAbapGitErrorLogEntry {
  msgType: 'E' | 'W' | 'I' | 'S' | string;
  objectType: string;
  objectName: string;
  messageText: string;
}

/** What a finished pull answers: the status it ended on, and what it logged. */
export interface IAbapGitPullResult {
  finalStatus: IAbapGitRepoStatus;
  errorLog?: IAbapGitErrorLogEntry[];
}

/** One branch of an external repository. */
export interface IAbapGitExternalRepoBranch {
  name: string;
  sha1: string;
  isHead: boolean;
  type?: string;
}

/** What the external-repository probe answers. */
export interface IAbapGitExternalRepoInfo {
  branches: IAbapGitExternalRepoBranch[];
  // Measured: the field is `accessMode`, not `access`.
  accessMode?: 'PUBLIC' | 'PRIVATE' | string;
}

export interface IAbapGitAbortedError extends Error {
  name: 'AbortError';
  lastKnownStatus?: IAbapGitRepoStatus;
}

export interface IAbapGitTimeoutError extends Error {
  name: 'TimeoutError';
  lastKnownStatus?: IAbapGitRepoStatus;
}

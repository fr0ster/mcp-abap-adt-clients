/**
 * abapGit client type definitions.
 *
 * Public surface (IAdtAbapGitClient) covers the ADT-integrated abapGit
 * (/sap/bc/adt/abapgit/*). link and pull match sapcli parity; unlink,
 * listRepos, getRepo, getErrorLog, and checkExternalRepo extend beyond
 * sapcli with discovery-evidenced endpoints.
 *
 * Pull is asynchronous server-side. The client-side wait loop respects
 * AbortSignal and a max-duration cap; aborting or timing out stops the
 * client wait only — the server-side job may still be running, and
 * callers must poll getRepo(package) until status != 'R' before
 * re-issuing pull or unlink.
 */

export type AbapGitStatus = 'R' | 'E' | 'A' | string;

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

export interface IAbapGitErrorLogEntry {
  msgType: 'E' | 'W' | 'I' | 'S' | string;
  objectType: string;
  objectName: string;
  messageText: string;
}

export interface IAbapGitLinkArgs {
  package: string;
  url: string;
  branchName?: string;
  remoteUser?: string;
  remotePassword?: string;
  transportRequest?: string;
}

export interface IAbapGitPullArgs {
  package: string;
  branchName?: string;
  remoteUser?: string;
  remotePassword?: string;
  transportRequest?: string;
  pollIntervalMs?: number;
  maxPollDurationMs?: number;
  signal?: AbortSignal;
  onProgress?: (status: IAbapGitRepoStatus) => void;
}

export interface IAbapGitPullResult {
  finalStatus: IAbapGitRepoStatus;
  errorLog?: IAbapGitErrorLogEntry[];
}

export interface IAbapGitUnlinkArgs {
  package: string;
  transportRequest?: string;
}

export interface IAbapGitExternalRepoCredentials {
  url: string;
  remoteUser?: string;
  remotePassword?: string;
}

export interface IAbapGitExternalRepoBranch {
  name: string;
  sha1: string;
  isHead: boolean;
  type?: string;
}

export interface IAbapGitExternalRepoInfo {
  branches: IAbapGitExternalRepoBranch[];
  accessMode?: 'PUBLIC' | 'PRIVATE' | string; // Phase Z confirmed: field is 'accessMode', not 'access'.
}

export interface IAbapGitAbortedError extends Error {
  name: 'AbortError';
  lastKnownStatus?: IAbapGitRepoStatus;
}

export interface IAbapGitTimeoutError extends Error {
  name: 'TimeoutError';
  lastKnownStatus?: IAbapGitRepoStatus;
}

export interface IAdtAbapGitClientOptions {
  contentTypeVersion?: 'v3' | 'v4';
}

export interface IAdtAbapGitClient {
  link(args: IAbapGitLinkArgs): Promise<void>;
  pull(args: IAbapGitPullArgs): Promise<IAbapGitPullResult>;
  unlink(args: IAbapGitUnlinkArgs): Promise<void>;
  listRepos(): Promise<IAbapGitRepoStatus[]>;
  getRepo(packageName: string): Promise<IAbapGitRepoStatus | undefined>;
  getErrorLog(packageName: string): Promise<IAbapGitErrorLogEntry[]>;
  checkExternalRepo(
    args: IAbapGitExternalRepoCredentials,
  ): Promise<IAbapGitExternalRepoInfo>;
}

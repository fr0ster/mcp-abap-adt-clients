/**
 * abapGit client type definitions.
 *
 * The contract types (IAdtAbapGitClient and friends) live in
 * @mcp-abap-adt/interfaces — a consumer must import them to use the client
 * at all, and that package is the one place to import from. Only the two
 * error shapes below stay here: they are not part of the public contract,
 * only thrown internally by the poll loop.
 */

import type { IAbapGitRepoStatus } from '@mcp-abap-adt/interfaces';

export interface IAbapGitAbortedError extends Error {
  name: 'AbortError';
  lastKnownStatus?: IAbapGitRepoStatus;
}

export interface IAbapGitTimeoutError extends Error {
  name: 'TimeoutError';
  lastKnownStatus?: IAbapGitRepoStatus;
}

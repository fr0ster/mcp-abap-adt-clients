import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { listRepos } from './listRepos';
import type { IAbapGitRepoStatus } from './types';

const DEFAULT_POLL_INTERVAL_MS = 1000;
const DEFAULT_MAX_DURATION_MS = 10 * 60 * 1000;

class AbapGitAbortError extends Error {
  name = 'AbortError';
  lastKnownStatus?: IAbapGitRepoStatus;
}

class AbapGitTimeoutError extends Error {
  name = 'TimeoutError';
  lastKnownStatus?: IAbapGitRepoStatus;
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AbapGitAbortError('aborted'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new AbapGitAbortError('aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function pollUntilTerminal(
  connection: IAbapConnection,
  packageName: string,
  opts?: {
    pollIntervalMs?: number;
    maxPollDurationMs?: number;
    signal?: AbortSignal;
    onProgress?: (status: IAbapGitRepoStatus) => void;
  },
): Promise<IAbapGitRepoStatus> {
  const interval = opts?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const maxDuration = opts?.maxPollDurationMs ?? DEFAULT_MAX_DURATION_MS;
  const deadline = Date.now() + maxDuration;
  let lastKnown: IAbapGitRepoStatus | undefined;

  while (true) {
    if (opts?.signal?.aborted) {
      const err = new AbapGitAbortError('aborted');
      err.lastKnownStatus = lastKnown;
      throw err;
    }
    if (Date.now() > deadline) {
      const err = new AbapGitTimeoutError(
        `abapGit pull did not finish within ${maxDuration}ms`,
      );
      err.lastKnownStatus = lastKnown;
      throw err;
    }

    const repos = await listRepos(connection);
    const match = repos.find(
      (r) => r.package.toUpperCase() === packageName.toUpperCase(),
    );
    if (match) {
      lastKnown = {
        package: match.package,
        url: match.url,
        branchName: match.branchName,
        status: match.status,
        statusText: match.statusText,
        createdBy: match.createdBy,
        createdAt: match.createdAt,
        repositoryId: match.repositoryId,
      };
      opts?.onProgress?.(lastKnown);
      if (match.status !== 'R') {
        return lastKnown;
      }
    }

    try {
      await sleep(interval, opts?.signal);
    } catch (sleepErr) {
      if (sleepErr instanceof AbapGitAbortError) {
        sleepErr.lastKnownStatus = lastKnown;
      }
      throw sleepErr;
    }
  }
}

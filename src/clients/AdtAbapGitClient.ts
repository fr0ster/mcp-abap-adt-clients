/**
 * ADT-integrated abapGit client.
 *
 * Standalone top-level class — NOT a factory on AdtClient (which is
 * reserved for IAdtObject<Config, State> implementations only).
 * Consumers instantiate directly: new AdtAbapGitClient(connection, logger, options).
 *
 * Implements IAdtAbapGitClient. HTTP operations are delegated to
 * low-level functions in ./abapGit/*; this class owns the options,
 * enforces the public contract, and keeps the call sites cast-free
 * by implementing the specialized interface.
 */

import type {
  IAbapConnection,
  IAbapGitExternalRepoCredentials,
  IAbapGitLinkArgs,
  IAbapGitPullArgs,
  IAbapGitUnlinkArgs,
  IAdtAbapGitClient,
  IAdtAbapGitClientOptions,
  IAdtResponse,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { answeringValue, failed, succeeded } from '../utils/adtResponse';
import { checkExternalRepo } from './abapGit/checkExternalRepo';
import { getErrorLog } from './abapGit/getErrorLog';
import { linkRepo } from './abapGit/link';
import { listRepos as listReposLowLevel } from './abapGit/listRepos';
import { pullRepo } from './abapGit/pull';
import type {
  IAbapGitErrorLogEntry,
  IAbapGitExternalRepoInfo,
  IAbapGitPullResult,
  IAbapGitRepoStatus,
} from './abapGit/types';
import { unlinkRepo } from './abapGit/unlink';

function toPublicRepoStatus(r: {
  package: string;
  url: string;
  branchName: string;
  status: string;
  statusText: string;
  createdBy?: string;
  createdAt?: string;
  repositoryId?: string;
}): IAbapGitRepoStatus {
  return {
    package: r.package,
    url: r.url,
    branchName: r.branchName,
    status: r.status,
    statusText: r.statusText,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    repositoryId: r.repositoryId,
  };
}

export class AdtAbapGitClient
  implements
    IAdtAbapGitClient<
      IAbapGitRepoStatus[],
      IAbapGitRepoStatus | undefined,
      IAbapGitErrorLogEntry[],
      IAbapGitPullResult,
      IAbapGitExternalRepoInfo
    >
{
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  private readonly contentTypeVersion: 'v3' | 'v4';

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    options?: IAdtAbapGitClientOptions,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.contentTypeVersion = options?.contentTypeVersion ?? 'v3';
  }

  /** Link a package to a repository. ADT answers nothing worth reading. */
  async link(args: IAbapGitLinkArgs): Promise<IAdtResponse<void>> {
    this.logger?.debug?.(
      `AdtAbapGitClient.link: package=${args.package} url=${args.url}`,
    );
    return answeringValue(async () => {
      await linkRepo(this.connection, args, this.contentTypeVersion);
    });
  }

  /**
   * Pull a linked repository, and wait for the server to finish.
   *
   * The wait is client-side: aborting or timing out stops this loop only, and
   * the server-side job may still be running. A caller that aborted must poll
   * `getRepo(package)` until the status is no longer `R` before pulling or
   * unlinking again.
   */
  async pull(
    args: IAbapGitPullArgs<IAbapGitRepoStatus>,
  ): Promise<IAdtResponse<IAbapGitPullResult>> {
    this.logger?.debug?.(`AdtAbapGitClient.pull: package=${args.package}`);
    return answeringValue(() =>
      pullRepo(this.connection, args, this.contentTypeVersion),
    );
  }

  /** Unlink a package from its repository. */
  async unlink(args: IAbapGitUnlinkArgs): Promise<IAdtResponse<void>> {
    this.logger?.debug?.(`AdtAbapGitClient.unlink: package=${args.package}`);
    return answeringValue(async () => {
      await unlinkRepo(this.connection, args);
    });
  }

  /** Every repository this system has linked. */
  async listRepos(): Promise<IAdtResponse<IAbapGitRepoStatus[]>> {
    return answeringValue(async () =>
      (await listReposLowLevel(this.connection)).map(toPublicRepoStatus),
    );
  }

  /**
   * One repository, by the package it is linked to.
   *
   * `undefined` when nothing is linked to that package — the listing is the
   * only resource, so absence is a row that is not there rather than a status.
   */
  async getRepo(
    packageName: string,
  ): Promise<IAdtResponse<IAbapGitRepoStatus | undefined>> {
    const repos = await this.listRepos();
    if (!repos.ok) return failed(repos.getError());
    return succeeded(
      repos
        .getResult()
        .value.find(
          (r) => r.package.toUpperCase() === packageName.toUpperCase(),
        ),
    );
  }

  /** What the last pull of that package logged. */
  async getErrorLog(
    packageName: string,
  ): Promise<IAdtResponse<IAbapGitErrorLogEntry[]>> {
    return answeringValue(() => getErrorLog(this.connection, packageName));
  }

  /** What an external repository offers, before linking anything to it. */
  async checkExternalRepo(
    args: IAbapGitExternalRepoCredentials,
  ): Promise<IAdtResponse<IAbapGitExternalRepoInfo>> {
    return answeringValue(() => checkExternalRepo(this.connection, args));
  }
}

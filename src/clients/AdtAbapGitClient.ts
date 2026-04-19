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

import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { checkExternalRepo } from './abapGit/checkExternalRepo';
import { getErrorLog } from './abapGit/getErrorLog';
import { linkRepo } from './abapGit/link';
import { listRepos as listReposLowLevel } from './abapGit/listRepos';
import { pullRepo } from './abapGit/pull';
import type {
  IAbapGitErrorLogEntry,
  IAbapGitExternalRepoCredentials,
  IAbapGitExternalRepoInfo,
  IAbapGitLinkArgs,
  IAbapGitPullArgs,
  IAbapGitPullResult,
  IAbapGitRepoStatus,
  IAbapGitUnlinkArgs,
  IAdtAbapGitClient,
  IAdtAbapGitClientOptions,
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

export class AdtAbapGitClient implements IAdtAbapGitClient {
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

  async link(args: IAbapGitLinkArgs): Promise<void> {
    this.logger?.debug?.(
      `AdtAbapGitClient.link: package=${args.package} url=${args.url}`,
    );
    await linkRepo(this.connection, args, this.contentTypeVersion);
  }

  async pull(args: IAbapGitPullArgs): Promise<IAbapGitPullResult> {
    this.logger?.debug?.(`AdtAbapGitClient.pull: package=${args.package}`);
    return pullRepo(this.connection, args, this.contentTypeVersion);
  }

  async unlink(args: IAbapGitUnlinkArgs): Promise<void> {
    this.logger?.debug?.(`AdtAbapGitClient.unlink: package=${args.package}`);
    await unlinkRepo(this.connection, args);
  }

  async listRepos(): Promise<IAbapGitRepoStatus[]> {
    const rows = await listReposLowLevel(this.connection);
    return rows.map(toPublicRepoStatus);
  }

  async getRepo(packageName: string): Promise<IAbapGitRepoStatus | undefined> {
    const repos = await this.listRepos();
    return repos.find(
      (r) => r.package.toUpperCase() === packageName.toUpperCase(),
    );
  }

  async getErrorLog(packageName: string): Promise<IAbapGitErrorLogEntry[]> {
    return getErrorLog(this.connection, packageName);
  }

  async checkExternalRepo(
    args: IAbapGitExternalRepoCredentials,
  ): Promise<IAbapGitExternalRepoInfo> {
    return checkExternalRepo(this.connection, args);
  }
}

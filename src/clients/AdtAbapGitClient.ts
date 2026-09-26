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
  IAbapGitExternalRepoCredentials,
  IAbapGitLinkArgs,
  IAbapGitPullArgs,
  IAbapGitUnlinkArgs,
  IAdtAbapGitClient,
  IAdtAbapGitClientOptions,
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IAnalyse,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { answering } from '../utils/adtResponse';
import { checkExternalRepo } from './abapGit/checkExternalRepo';
import { getErrorLog } from './abapGit/getErrorLog';
import { linkRepo } from './abapGit/link';
import { listRepos } from './abapGit/listRepos';
import { pullRepo } from './abapGit/pull';
import { abapGitDocuments, type IAbapGitResults } from './abapGit/types';
import { unlinkRepo } from './abapGit/unlink';

/**
 * One request per member, each read by the strategy the client was built
 * with, each judged by the `analyse` its caller passes.
 *
 * `getRepo` is gone (interfaces-adt 11, decision 37): it listed the
 * repositories and picked one, which is a reading — `listRepos` through a
 * strategy of the caller's, then their own `find`. `unlink` and `getErrorLog`
 * take the key and the log link `listRepos` reports instead of a package they
 * had to look up.
 */
export class AdtAbapGitClient<
  R extends IAbapGitResults = typeof abapGitDocuments,
> implements
    IAdtAbapGitClient<
      ReturnType<R['repos']>,
      ReturnType<R['errorLog']>,
      ReturnType<R['pulled']>,
      ReturnType<R['externalRepo']>
    >
{
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  private readonly contentTypeVersion: 'v3' | 'v4';
  private readonly results: R;

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    options?: IAdtAbapGitClientOptions,
    // The one cast in this file, and it is on the default. See AdtClass.
    results: R = abapGitDocuments as unknown as R,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.contentTypeVersion = options?.contentTypeVersion ?? 'v3';
    this.results = results;
  }

  /** Link a package to a repository. */
  async link<E extends IAdtError = IAdtError>(
    args: IAbapGitLinkArgs,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<void, E>> {
    this.logger?.debug?.(
      `AdtAbapGitClient.link: package=${args.package} url=${args.url}`,
    );
    return answering(
      () => linkRepo(this.connection, args, this.contentTypeVersion),
      this.results.linked as IResultStrategy<void>,
      options?.analyse as IAnalyse<E> | undefined,
    );
  }

  /**
   * Start a pull. One POST, to the link `listRepos` reported.
   *
   * It does not wait. Polling `listRepos` until the status leaves `R`,
   * deciding how long to allow and what to do when it does not, and reading
   * `getErrorLog` when the status says to — all of that is the caller's.
   */
  async pull<E extends IAdtError = IAdtError>(
    args: IAbapGitPullArgs,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['pulled']>, E>> {
    this.logger?.debug?.(`AdtAbapGitClient.pull: package=${args.package}`);
    return answering(
      () => pullRepo(this.connection, args, this.contentTypeVersion),
      this.results.pulled as IResultStrategy<ReturnType<R['pulled']>>,
      options?.analyse as IAnalyse<E> | undefined,
    );
  }

  /** Remove a repository link, by the key `listRepos` reported. */
  async unlink<E extends IAdtError = IAdtError>(
    args: IAbapGitUnlinkArgs,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<void, E>> {
    this.logger?.debug?.(
      `AdtAbapGitClient.unlink: repositoryId=${args.repositoryId}`,
    );
    return answering(
      () => unlinkRepo(this.connection, args),
      this.results.unlinked as IResultStrategy<void>,
      options?.analyse as IAnalyse<E> | undefined,
    );
  }

  /** Every repository this system has linked. */
  async listRepos<E extends IAdtError = IAdtError>(
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['repos']>, E>> {
    return answering(
      () => listRepos(this.connection),
      this.results.repos as IResultStrategy<ReturnType<R['repos']>>,
      options?.analyse as IAnalyse<E> | undefined,
    );
  }

  /** A run's error log, from the log link `listRepos` reported. */
  async getErrorLog<E extends IAdtError = IAdtError>(
    logLink: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['errorLog']>, E>> {
    return answering(
      () => getErrorLog(this.connection, logLink),
      this.results.errorLog as IResultStrategy<ReturnType<R['errorLog']>>,
      options?.analyse as IAnalyse<E> | undefined,
    );
  }

  /** What an external repository offers, before linking anything to it. */
  async checkExternalRepo<E extends IAdtError = IAdtError>(
    args: IAbapGitExternalRepoCredentials,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['externalRepo']>, E>> {
    return answering(
      () => checkExternalRepo(this.connection, args),
      this.results.externalRepo as IResultStrategy<
        ReturnType<R['externalRepo']>
      >,
      options?.analyse as IAnalyse<E> | undefined,
    );
  }
}

/**
 * ADT-integrated abapGit client.
 *
 * Standalone top-level class — NOT a factory on AdtClient (which is
 * reserved for IAdtObject<Config, State> implementations only).
 * Consumers build it themselves: `AdtAbapGitClient.create(connection, { logger })`
 * answers the shipped documents, `create(connection, { logger, results })` the
 * caller's; `new AdtAbapGitClient(connection, { logger, results })` takes its
 * results always.
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
  IAdtAnalyseOptions,
  IAdtError,
  IAdtHeaders,
  IAdtResponse,
  IAnalyse,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import type {
  AdtHandlerOptions,
  AdtShippedOptions,
} from '../core/shared/handlerOptions';
import { answering } from '../utils/adtResponse';
import type {
  ResultStrategiesOf,
  ResultValuesOf,
} from '../utils/resultStrategy';
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
/** What each slot of an abapGit client's result set answers. */
export type AbapGitValues = {
  readonly [K in keyof IAbapGitResults]: unknown;
};

export class AdtAbapGitClient<
  T extends AbapGitValues = ResultValuesOf<typeof abapGitDocuments>,
> implements
    IAdtAbapGitClient<T['repos'], T['errorLog'], T['pulled'], T['externalRepo']>
{
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  private readonly results: ResultStrategiesOf<T>;

  /**
   * An abapGit client with the shipped documents, or with the caller's results.
   * No client hands one out, so this is where the shipped documents are the
   * default, as a getter's are.
   */
  static create(
    connection: IAbapConnection,
    options?: AdtShippedOptions<'logger'>,
  ): AdtAbapGitClient<ResultValuesOf<typeof abapGitDocuments>>;
  static create<R extends IAbapGitResults>(
    connection: IAbapConnection,
    options: AdtHandlerOptions<R, 'logger'>,
  ): AdtAbapGitClient<ResultValuesOf<R>>;
  static create(
    connection: IAbapConnection,
    options: Partial<AdtHandlerOptions<IAbapGitResults, 'logger'>> = {},
  ): AdtAbapGitClient<AbapGitValues> {
    return new AdtAbapGitClient<AbapGitValues>(connection, {
      ...options,
      results: options.results ?? abapGitDocuments,
    });
  }

  constructor(
    connection: IAbapConnection,
    // `contentTypeVersion`, which chose what `link` and `pull` sent, is gone
    // since 36.0.0: those members send the caller's `headers`.
    options: AdtHandlerOptions<ResultStrategiesOf<T>, 'logger'>,
  ) {
    const { logger, results } = options;
    this.connection = connection;
    this.logger = logger;
    this.results = results;
  }

  /** Link a package to a repository. */
  async link<E extends IAdtError = IAdtError>(
    args: IAbapGitLinkArgs,
    options: { headers: IAdtHeaders } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<void, E>> {
    this.logger?.debug?.(
      `AdtAbapGitClient.link: package=${args.package} url=${args.url}`,
    );
    return answering<void, E>(
      () => linkRepo(this.connection, options.headers, args),
      this.results.linked,
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
    options: { headers: IAdtHeaders } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['pulled'], E>> {
    this.logger?.debug?.(`AdtAbapGitClient.pull: package=${args.package}`);
    return answering(
      () => pullRepo(this.connection, options.headers, args),
      this.results.pulled,
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
    return answering<void, E>(
      () => unlinkRepo(this.connection, args),
      this.results.unlinked,
      options?.analyse as IAnalyse<E> | undefined,
    );
  }

  /** Every repository this system has linked. */
  async listRepos<E extends IAdtError = IAdtError>(
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['repos'], E>> {
    return answering(
      () => listRepos(this.connection),
      this.results.repos,
      options?.analyse as IAnalyse<E> | undefined,
    );
  }

  /** A run's error log, from the log link `listRepos` reported. */
  async getErrorLog<E extends IAdtError = IAdtError>(
    logLink: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['errorLog'], E>> {
    return answering(
      () => getErrorLog(this.connection, logLink),
      this.results.errorLog,
      options?.analyse as IAnalyse<E> | undefined,
    );
  }

  /** What an external repository offers, before linking anything to it. */
  async checkExternalRepo<E extends IAdtError = IAdtError>(
    args: IAbapGitExternalRepoCredentials,
    options: { headers: IAdtHeaders } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['externalRepo'], E>> {
    return answering(
      () => checkExternalRepo(this.connection, options.headers, args),
      this.results.externalRepo,
      options?.analyse as IAnalyse<E> | undefined,
    );
  }
}

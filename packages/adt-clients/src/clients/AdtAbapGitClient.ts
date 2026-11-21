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
 * Implements IAdtAbapGitClient and, since 46.2.0, the new forms of
 * interfaces-adt 30.2.0. HTTP operations are built by the functions in
 * ./abapGit/*; this class owns the options and enforces the public contract.
 *
 * **Two kinds of member.** The legacy ones (`link` and `checkExternalRepo`
 * without `credentials`, `pull`, `unlink`, `listRepos`, `getErrorLog`) keep
 * 46.1.0's requests, callbacks and answers. The new forms — the new members,
 * and `link` / `checkExternalRepo` given `credentials` (a credential, or `null`
 * for an anonymous call) — go through the facts exchange: SAP's answer is
 * reduced to the route's kept fields before anything sees it, and a failure is
 * an `IAbapGitStructuredError` of fixed words, a status and a T100 key.
 */

import { abapGitFacts } from '@mcp-abap-adt/adt-strategies';
import type {
  IAbapGitBranchInfoArgs,
  IAbapGitExternalRepoArgs,
  IAbapGitExternalRepoCredentials,
  IAbapGitFactsAnalyse,
  IAbapGitFactsOptions,
  IAbapGitFactsResponse,
  IAbapGitFactsResultStrategy,
  IAbapGitFileArgs,
  IAbapGitHeaderOptions,
  IAbapGitLinkArgs,
  IAbapGitLinkNewArgs,
  IAbapGitNewFormOptions,
  IAbapGitPullArgs,
  IAbapGitPullRepoArgs,
  IAbapGitPushArgs,
  IAbapGitQuietOptions,
  IAbapGitRepoKeyArgs,
  IAbapGitRunLogArgs,
  IAbapGitStructuredError,
  IAbapGitSwitchBranchArgs,
  IAbapGitUnlinkArgs,
  IAdtAbapGitBranchInfo,
  IAdtAbapGitCheckExternalRepoNewForm,
  IAdtAbapGitCheckRepo,
  IAdtAbapGitClient,
  IAdtAbapGitFile,
  IAdtAbapGitLinkNewForm,
  IAdtAbapGitListReposQuiet,
  IAdtAbapGitModifiedObjects,
  IAdtAbapGitPullRepo,
  IAdtAbapGitPullRepoInDialog,
  IAdtAbapGitPush,
  IAdtAbapGitRunLog,
  IAdtAbapGitStaging,
  IAdtAbapGitStatus,
  IAdtAbapGitSwitchBranch,
  IAdtAnalyseOptions,
  IAdtError,
  IAdtHeaders,
  IAdtResponse,
  IAnalyse,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import type {
  AdtHandlerOptions,
  AdtShippedOptions,
} from '../core/shared/handlerOptions';
import { answering } from '../utils/adtResponse';
import type { ResultValuesOf } from '../utils/resultStrategy';
import {
  checkExternalRepo,
  checkExternalRepoRequest,
} from './abapGit/checkExternalRepo';
import { checkRepoRequest } from './abapGit/checkRepo';
import { getBranchInfoRequest } from './abapGit/getBranchInfo';
import { getErrorLog } from './abapGit/getErrorLog';
import { getFileRequest } from './abapGit/getFile';
import { getModifiedObjectsRequest } from './abapGit/getModifiedObjects';
import { getRunLogRequest } from './abapGit/getRunLog';
import { getStagingRequest } from './abapGit/getStaging';
import { getStatusRequest } from './abapGit/getStatus';
import { linkRepo, linkRequest } from './abapGit/link';
import { listRepos } from './abapGit/listRepos';
import { listReposQuietRequest } from './abapGit/listReposQuiet';
import { logLinkPath, pullLinkPath } from './abapGit/paths';
import { postPullByKey, postPullLink } from './abapGit/pull';
import { pushRequest } from './abapGit/push';
import {
  answeringFactsExchange,
  sentRequest,
} from './abapGit/structuredExchange';
import { switchBranchRequest } from './abapGit/switchBranch';
import {
  type AbapGitFactsSlot,
  type AbapGitStrategiesOf,
  type AbapGitValues,
  type AbapGitValuesOf,
  abapGitDocuments,
  type FactsValue,
  type IAbapGitFactsOf,
  type IAbapGitResults,
} from './abapGit/types';
import { unlinkRepo } from './abapGit/unlink';

export type { AbapGitValues } from './abapGit/types';

/** A deprecated form's options: `credentials` never, so the forms never mix. */
type DeprecatedOptions<E extends IAdtError> = {
  headers: IAdtHeaders;
} & IAdtAnalyseOptions<E> & {
    readonly credentials?: never;
  };

type Facts<K extends AbapGitFactsSlot> = IAbapGitFactsOf[K];

/** A new form's answer for the values `T` and the slot `K`. */
type FactsAnswer<
  T,
  K extends AbapGitFactsSlot,
  E extends IAbapGitStructuredError,
> = Promise<IAdtResponse<FactsValue<T, K>, E>>;

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
  T extends AbapGitValues = ResultValuesOf<typeof abapGitDocuments>,
> implements
    IAdtAbapGitClient<
      T['repos'],
      T['errorLog'],
      T['pulled'],
      T['externalRepo']
    >,
    IAdtAbapGitListReposQuiet<FactsValue<T, 'reposFacts'>, Facts<'reposFacts'>>,
    IAdtAbapGitLinkNewForm<FactsValue<T, 'linkedFacts'>, Facts<'linkedFacts'>>,
    IAdtAbapGitCheckExternalRepoNewForm<
      FactsValue<T, 'externalRepoFacts'>,
      Facts<'externalRepoFacts'>
    >,
    IAdtAbapGitPullRepo<FactsValue<T, 'repoPulled'>, Facts<'repoPulled'>>,
    IAdtAbapGitPullRepoInDialog<
      FactsValue<T, 'repoPulledInDialog'>,
      Facts<'repoPulledInDialog'>
    >,
    IAdtAbapGitRunLog<FactsValue<T, 'runLog'>, Facts<'runLog'>>,
    IAdtAbapGitModifiedObjects<
      FactsValue<T, 'modifiedObjects'>,
      Facts<'modifiedObjects'>
    >,
    IAdtAbapGitStatus<FactsValue<T, 'status'>, Facts<'status'>>,
    IAdtAbapGitStaging<FactsValue<T, 'staging'>, Facts<'staging'>>,
    IAdtAbapGitPush<FactsValue<T, 'pushed'>, Facts<'pushed'>>,
    IAdtAbapGitCheckRepo<FactsValue<T, 'checked'>, Facts<'checked'>>,
    IAdtAbapGitFile<FactsValue<T, 'file'>, Facts<'file'>>,
    IAdtAbapGitBranchInfo<FactsValue<T, 'branchInfo'>, Facts<'branchInfo'>>,
    IAdtAbapGitSwitchBranch<FactsValue<T, 'switched'>, Facts<'switched'>>
{
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  private readonly results: AbapGitStrategiesOf<T>;

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
  ): AdtAbapGitClient<AbapGitValuesOf<R>>;
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
    options: AdtHandlerOptions<AbapGitStrategiesOf<T>, 'logger'>,
  ) {
    const { logger, results } = options;
    this.connection = connection;
    this.logger = logger;
    this.results = results;
  }

  /**
   * The slot's facts reader, or — when the result set leaves it out — the
   * facts as `abapGitFacts` reduced them.
   */
  private factsReader<K extends AbapGitFactsSlot>(
    slot: K,
  ): IAbapGitFactsResultStrategy<FactsValue<T, K>, Facts<K>> {
    // The one place a slot is looked up by name: `T` is generic, so whether
    // it names `slot` is known only to `FactsValue`, which types the answer
    // the same way. Absent, the facts are the answer (`FactsValue`'s default).
    const given = (
      this.results as Partial<
        Record<AbapGitFactsSlot, IAbapGitFactsResultStrategy<unknown, never>>
      >
    )[slot];
    const read = given ?? ((answer: IAbapGitFactsResponse<Facts<K>>) => answer);
    return read as IAbapGitFactsResultStrategy<FactsValue<T, K>, Facts<K>>;
  }

  /** One new-form request through the facts exchange. */
  private exchange<
    K extends AbapGitFactsSlot,
    E extends IAbapGitStructuredError,
  >(
    slot: K,
    request: IAbapRequestOptions,
    reduce: (wire: IAdtWireResponse) => IAbapGitFactsResponse<Facts<K>>,
    analyse: IAbapGitFactsAnalyse<Facts<K>, E> | undefined,
  ): FactsAnswer<T, K, E> {
    // Fixed words: no argument of a new form reaches a log line.
    this.logger?.debug?.(`AdtAbapGitClient: ${slot}`);
    return answeringFactsExchange(
      () => this.connection.makeAdtRequest(request),
      reduce,
      this.factsReader(slot),
      analyse,
      sentRequest(request),
    );
  }

  /**
   * Link a package to a repository.
   *
   * @deprecated Since 46.2.0 — use the new form: `credentials` given (a
   * credential, or `null`), no `remoteUser`/`remotePassword`.
   */
  link<E extends IAdtError = IAdtError>(
    args: IAbapGitLinkArgs,
    options: DeprecatedOptions<E>,
  ): Promise<IAdtResponse<void, E>>;
  /** Link a package to a repository — the new form, answered by its facts. */
  link<E extends IAbapGitStructuredError = IAbapGitStructuredError>(
    args: IAbapGitLinkNewArgs,
    options: IAbapGitHeaderOptions &
      IAbapGitNewFormOptions<Facts<'linkedFacts'>, E>,
  ): FactsAnswer<T, 'linkedFacts', E>;
  async link(
    args: IAbapGitLinkArgs | IAbapGitLinkNewArgs,
    options:
      | DeprecatedOptions<IAdtError>
      | (IAbapGitHeaderOptions &
          IAbapGitNewFormOptions<
            Facts<'linkedFacts'>,
            IAbapGitStructuredError
          >),
  ): Promise<IAdtResponse<unknown, IAdtError>> {
    if (options.credentials !== undefined) {
      const request = linkRequest(
        options.headers,
        args as IAbapGitLinkNewArgs,
        options.credentials,
      );
      return this.exchange(
        'linkedFacts',
        request,
        abapGitFacts.linkedFacts,
        (options as IAbapGitNewFormOptions<Facts<'linkedFacts'>>).analyse,
      );
    }
    const given = args as IAbapGitLinkArgs;
    this.logger?.debug?.(
      `AdtAbapGitClient.link: package=${given.package} url=${given.url}`,
    );
    return answering<void, IAdtError>(
      () => linkRepo(this.connection, options.headers, given),
      this.results.linked,
      (options as DeprecatedOptions<IAdtError>).analyse as
        | IAnalyse<IAdtError>
        | undefined,
    );
  }

  /**
   * Start a pull. One POST, to the link `listRepos` reported.
   *
   * It does not wait. Polling `listRepos` until the status leaves `R`,
   * deciding how long to allow and what to do when it does not, and reading
   * `getErrorLog` when the status says to — all of that is the caller's.
   *
   * @deprecated Since 46.2.0 — use the key-based `pullRepo`. The link is sent
   * only when it is exactly `/sap/bc/adt/abapgit/repos/{key}/pull`.
   */
  async pull<E extends IAdtError = IAdtError>(
    args: IAbapGitPullArgs,
    options: DeprecatedOptions<E>,
  ): Promise<IAdtResponse<T['pulled'], E>> {
    this.logger?.debug?.(`AdtAbapGitClient.pull: package=${args.package}`);
    // Refused before anything is built: a link that is not the path a key
    // would build throws here, outside the exchange, with nothing sent.
    const url = pullLinkPath(args.pullLink);
    return answering(
      () => postPullLink(this.connection, options.headers, args, url),
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

  /**
   * A run's error log, from the log link `listRepos` reported.
   *
   * @deprecated Since 46.2.0 — use `getRunLog`, by key and `appLogKey`. The
   * link is sent only when it is exactly
   * `/sap/bc/adt/abapgit/repos/{key}/log/{id}`.
   */
  async getErrorLog<E extends IAdtError = IAdtError>(
    logLink: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['errorLog'], E>> {
    const url = logLinkPath(logLink);
    return answering(
      () => getErrorLog(this.connection, url),
      this.results.errorLog,
      options?.analyse as IAnalyse<E> | undefined,
    );
  }

  /**
   * What an external repository offers, before linking anything to it.
   *
   * @deprecated Since 46.2.0 — use the new form (`credentials` given). This
   * form writes `remoteUser`/`remotePassword`, which R13 does not read.
   */
  checkExternalRepo<E extends IAdtError = IAdtError>(
    args: IAbapGitExternalRepoCredentials,
    options: DeprecatedOptions<E>,
  ): Promise<IAdtResponse<T['externalRepo'], E>>;
  /** What an external repository offers — the new form, answered by its facts. */
  checkExternalRepo<
    E extends IAbapGitStructuredError = IAbapGitStructuredError,
  >(
    args: IAbapGitExternalRepoArgs,
    options: IAbapGitHeaderOptions &
      IAbapGitNewFormOptions<Facts<'externalRepoFacts'>, E>,
  ): FactsAnswer<T, 'externalRepoFacts', E>;
  async checkExternalRepo(
    args: IAbapGitExternalRepoCredentials | IAbapGitExternalRepoArgs,
    options:
      | DeprecatedOptions<IAdtError>
      | (IAbapGitHeaderOptions &
          IAbapGitNewFormOptions<
            Facts<'externalRepoFacts'>,
            IAbapGitStructuredError
          >),
  ): Promise<IAdtResponse<unknown, IAdtError>> {
    if (options.credentials !== undefined) {
      const request = checkExternalRepoRequest(
        options.headers,
        args as IAbapGitExternalRepoArgs,
        options.credentials,
      );
      return this.exchange(
        'externalRepoFacts',
        request,
        abapGitFacts.externalRepoFacts,
        (options as IAbapGitNewFormOptions<Facts<'externalRepoFacts'>>).analyse,
      );
    }
    return answering(
      () =>
        checkExternalRepo(
          this.connection,
          options.headers,
          args as IAbapGitExternalRepoCredentials,
        ),
      this.results.externalRepo,
      (options as DeprecatedOptions<IAdtError>).analyse as
        | IAnalyse<IAdtError>
        | undefined,
    );
  }

  /**
   * The repository list, read without a credential and with nothing logged —
   * the pre-read a server makes before a key-addressed call.
   */
  async listReposQuiet<
    E extends IAbapGitStructuredError = IAbapGitStructuredError,
  >(
    options?: IAbapGitQuietOptions<Facts<'reposFacts'>, E>,
  ): FactsAnswer<T, 'reposFacts', E> {
    return this.exchange(
      'reposFacts',
      listReposQuietRequest(),
      abapGitFacts.reposFacts,
      options?.analyse,
    );
  }

  /**
   * Pull a repository, by its key. Onprem answers when the pull ran; cloud
   * answers `202` when the job was accepted — waiting is the caller's.
   */
  async pullRepo<E extends IAbapGitStructuredError = IAbapGitStructuredError>(
    args: IAbapGitPullRepoArgs,
    options: IAbapGitHeaderOptions &
      IAbapGitFactsOptions<Facts<'repoPulled'>, E>,
  ): FactsAnswer<T, 'repoPulled', E> {
    return this.exchange(
      'repoPulled',
      postPullByKey(options.headers, args, options.credentials ?? null, false),
      abapGitFacts.repoPulled,
      options.analyse,
    );
  }

  /** Pull a repository in the request (cloud, `…/pull/v2`): `202` when it ran. */
  async pullRepoInDialog<
    E extends IAbapGitStructuredError = IAbapGitStructuredError,
  >(
    args: IAbapGitPullRepoArgs,
    options: IAbapGitHeaderOptions &
      IAbapGitFactsOptions<Facts<'repoPulledInDialog'>, E>,
  ): FactsAnswer<T, 'repoPulledInDialog', E> {
    return this.exchange(
      'repoPulledInDialog',
      postPullByKey(options.headers, args, options.credentials ?? null, true),
      abapGitFacts.repoPulledInDialog,
      options.analyse,
    );
  }

  /** What a pull would overwrite (cloud). */
  async getModifiedObjects<
    E extends IAbapGitStructuredError = IAbapGitStructuredError,
  >(
    args: IAbapGitRepoKeyArgs,
    options?: IAbapGitFactsOptions<Facts<'modifiedObjects'>, E>,
  ): FactsAnswer<T, 'modifiedObjects', E> {
    return this.exchange(
      'modifiedObjects',
      getModifiedObjectsRequest(args, options?.credentials),
      abapGitFacts.modifiedObjects,
      options?.analyse,
    );
  }

  /** A repository's status (cloud): SAP answers a fixed text. */
  async getStatus<E extends IAbapGitStructuredError = IAbapGitStructuredError>(
    args: IAbapGitRepoKeyArgs,
    options?: IAbapGitFactsOptions<Facts<'status'>, E>,
  ): FactsAnswer<T, 'status', E> {
    return this.exchange(
      'status',
      getStatusRequest(args),
      abapGitFacts.status,
      options?.analyse,
    );
  }

  /** A run's log, by the repository's key and the log's `appLogKey`. */
  async getRunLog<E extends IAbapGitStructuredError = IAbapGitStructuredError>(
    args: IAbapGitRunLogArgs,
    options?: IAbapGitFactsOptions<Facts<'runLog'>, E>,
  ): FactsAnswer<T, 'runLog', E> {
    return this.exchange(
      'runLog',
      getRunLogRequest(args),
      abapGitFacts.runLog,
      options?.analyse,
    );
  }

  /** A repository's unstaged, staged and ignored objects. */
  async getStaging<E extends IAbapGitStructuredError = IAbapGitStructuredError>(
    args: IAbapGitRepoKeyArgs,
    options?: IAbapGitFactsOptions<Facts<'staging'>, E>,
  ): FactsAnswer<T, 'staging', E> {
    return this.exchange(
      'staging',
      getStagingRequest(args, options?.credentials),
      abapGitFacts.staging,
      options?.analyse,
    );
  }

  /**
   * Commit and push the staged objects. Onprem answers when it ran; cloud
   * answers `202` when the job was accepted.
   */
  async push<E extends IAbapGitStructuredError = IAbapGitStructuredError>(
    args: IAbapGitPushArgs,
    options?: IAbapGitFactsOptions<Facts<'pushed'>, E>,
  ): FactsAnswer<T, 'pushed', E> {
    return this.exchange(
      'pushed',
      pushRequest(args, options?.credentials),
      abapGitFacts.pushed,
      options?.analyse,
    );
  }

  /** Check a repository's connection to its remote. */
  async checkRepo<E extends IAbapGitStructuredError = IAbapGitStructuredError>(
    args: IAbapGitRepoKeyArgs,
    options?: IAbapGitFactsOptions<Facts<'checked'>, E>,
  ): FactsAnswer<T, 'checked', E> {
    return this.exchange(
      'checked',
      checkRepoRequest(args, options?.credentials),
      abapGitFacts.checked,
      options?.analyse,
    );
  }

  /** One file of a repository, in the system's version or the remote's. */
  async getFile<E extends IAbapGitStructuredError = IAbapGitStructuredError>(
    args: IAbapGitFileArgs,
    options?: IAbapGitFactsOptions<Facts<'file'>, E>,
  ): FactsAnswer<T, 'file', E> {
    // The answer names neither the file nor the version: they are the call's.
    const { filename, version } = args;
    return this.exchange(
      'file',
      getFileRequest(args, options?.credentials),
      (wire) => abapGitFacts.file(wire, { filename, version }),
      options?.analyse,
    );
  }

  /** One remote branch, for the package it would be linked to (cloud). */
  async getBranchInfo<
    E extends IAbapGitStructuredError = IAbapGitStructuredError,
  >(
    args: IAbapGitBranchInfoArgs,
    options: IAbapGitHeaderOptions &
      IAbapGitFactsOptions<Facts<'branchInfo'>, E>,
  ): FactsAnswer<T, 'branchInfo', E> {
    return this.exchange(
      'branchInfo',
      getBranchInfoRequest(options.headers, args, options.credentials),
      abapGitFacts.branchInfo,
      options.analyse,
    );
  }

  /** Switch a repository's branch, or create it in the remote (onprem). */
  async switchBranch<
    E extends IAbapGitStructuredError = IAbapGitStructuredError,
  >(
    args: IAbapGitSwitchBranchArgs,
    options?: IAbapGitFactsOptions<Facts<'switched'>, E>,
  ): FactsAnswer<T, 'switched', E> {
    return this.exchange(
      'switched',
      switchBranchRequest(args, options?.credentials),
      abapGitFacts.switched,
      options?.analyse,
    );
  }
}

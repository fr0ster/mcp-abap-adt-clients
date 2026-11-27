import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IAnalyse,
  IResultStrategy,
  IRuntimeDumpReadOptions,
  IRuntimeDumps,
  IRuntimeDumpsListOptions,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import type { AdtLoggedOptions } from '../../core/shared/handlerOptions';
import { answering } from '../../utils/adtResponse';
import {
  type ResultStrategiesOf,
  type ResultValuesOf,
  rawDocument,
} from '../../utils/resultStrategy';
import {
  buildDumpIdPrefix,
  buildRuntimeDumpsUserQuery,
  getRuntimeDumpById,
  listRuntimeDumps,
  listRuntimeDumpsByUser,
} from './read';

/** One strategy per distinct answer of the runtime-dumps resource. */
export interface IRuntimeDumpsResults {
  /** The dumps feed — `list` and `listByUser`. */
  readonly list: IResultStrategy<unknown>;
  /** One dump — `getById`. */
  readonly dump: IResultStrategy<unknown>;
}

/**
 * The shipped default: every member answers its document as it arrived.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const runtimeDumpsDocuments = {
  list: rawDocument,
  dump: rawDocument,
} satisfies IRuntimeDumpsResults;

/** What each slot of the result set answers. */
export type RuntimeDumpsValues = {
  readonly [K in keyof IRuntimeDumpsResults]: unknown;
};

export class RuntimeDumps<
  T extends RuntimeDumpsValues = ResultValuesOf<typeof runtimeDumpsDocuments>,
> implements IRuntimeDumps<T['list'], T['dump']>
{
  readonly kind = 'runtimeDumps' as const;
  private readonly results: ResultStrategiesOf<T>;
  private readonly logger: ILogger;

  constructor(
    private readonly connection: IAbapConnection,
    options: AdtLoggedOptions<ResultStrategiesOf<T>>,
  ) {
    this.logger = options.logger;
    this.results = options.results;
  }

  list<E extends IAdtError>(
    options: IRuntimeDumpsListOptions &
      IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['list'], E | IAdtError>>;
  list(
    options?: IRuntimeDumpsListOptions & IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['list'], IAdtError>>;
  async list<E extends IAdtError = IAdtError>(
    options?: IRuntimeDumpsListOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['list'], E | IAdtError>> {
    return answering(
      () => listRuntimeDumps(this.connection, options ?? {}),
      this.results.list,
      options?.analyse,
    );
  }

  listByUser<E extends IAdtError>(
    user: string | undefined,
    options: Omit<IRuntimeDumpsListOptions, 'query'> &
      IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['list'], E | IAdtError>>;
  listByUser(
    user?: string,
    options?: Omit<IRuntimeDumpsListOptions, 'query'> &
      IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['list'], IAdtError>>;
  async listByUser<E extends IAdtError = IAdtError>(
    user?: string,
    options?: Omit<IRuntimeDumpsListOptions, 'query'> & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['list'], E | IAdtError>> {
    return answering(
      () => listRuntimeDumpsByUser(this.connection, user, options),
      this.results.list,
      options?.analyse,
    );
  }

  getById<E extends IAdtError>(
    dumpId: string,
    options: IRuntimeDumpReadOptions &
      IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['dump'], E | IAdtError>>;
  getById(
    dumpId: string,
    options?: IRuntimeDumpReadOptions & IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['dump'], IAdtError>>;
  async getById<E extends IAdtError = IAdtError>(
    dumpId: string,
    options?: IRuntimeDumpReadOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['dump'], E | IAdtError>> {
    return answering(
      () => getRuntimeDumpById(this.connection, dumpId, options),
      this.results.dump,
      options?.analyse,
    );
  }

  buildIdPrefix(
    datetime: string,
    hostname: string,
    sysid: string,
    instance: string,
  ): string {
    return buildDumpIdPrefix(datetime, hostname, sysid, instance);
  }

  buildUserQuery(user?: string): string | undefined {
    return buildRuntimeDumpsUserQuery(user);
  }
}

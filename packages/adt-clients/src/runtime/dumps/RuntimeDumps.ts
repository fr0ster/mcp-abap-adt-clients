import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IResultStrategy,
  IRuntimeDumpReadOptions,
  IRuntimeDumps,
  IRuntimeDumpsListOptions,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { answering } from '../../utils/adtResponse';
import { rawDocument } from '../../utils/resultStrategy';
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

export class RuntimeDumps<
  R extends IRuntimeDumpsResults = typeof runtimeDumpsDocuments,
> implements IRuntimeDumps<ReturnType<R['list']>, ReturnType<R['dump']>>
{
  readonly kind = 'runtimeDumps' as const;
  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
    // The one cast in this file, and it is on the default. See AdtClass.
    private readonly results: R = runtimeDumpsDocuments as unknown as R,
  ) {}

  async list<E extends IAdtError = IAdtError>(
    options?: IRuntimeDumpsListOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['list']>, E>> {
    return answering(
      () => listRuntimeDumps(this.connection, options ?? {}),
      this.results.list as IResultStrategy<ReturnType<R['list']>>,
      options?.analyse,
    );
  }

  async listByUser<E extends IAdtError = IAdtError>(
    user?: string,
    options?: Omit<IRuntimeDumpsListOptions, 'query'> & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['list']>, E>> {
    return answering(
      () => listRuntimeDumpsByUser(this.connection, user, options),
      this.results.list as IResultStrategy<ReturnType<R['list']>>,
      options?.analyse,
    );
  }

  async getById<E extends IAdtError = IAdtError>(
    dumpId: string,
    options?: IRuntimeDumpReadOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['dump']>, E>> {
    return answering(
      () => getRuntimeDumpById(this.connection, dumpId, options),
      this.results.dump as IResultStrategy<ReturnType<R['dump']>>,
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

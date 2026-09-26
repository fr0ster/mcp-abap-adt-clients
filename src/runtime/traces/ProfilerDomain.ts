import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IProfilerListOptions,
  IProfilerTraceDbAccessesOptions,
  IProfilerTraceHitListOptions,
  IProfilerTraceParameters,
  IProfilerTraceStatementsOptions,
  IResultStrategy,
  ITraceDeletion,
  ITraceEntry,
  ITraceFamily,
  ITraceListing,
  ITraceReading,
  ITraceView,
  ViewOptions,
  ViewResult,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { answering } from '../../utils/adtResponse';
import { nothing, rawDocument } from '../../utils/resultStrategy';
import {
  buildTraceParametersXml,
  DEFAULT_PROFILER_TRACE_PARAMETERS,
  deleteTrace,
  getTraceDbAccesses,
  getTraceHitList,
  getTraceStatements,
  listTraceFiles,
} from './profiler';

/** One strategy per distinct answer of the ABAP profiler. */
export interface IProfilerResults {
  /** The `abaptraces` feed — `list`. `profilerTraceEntries` reads it. */
  readonly list: IResultStrategy<unknown>;
  /** The `hitlist` view. `profilerHitList` reads it. */
  readonly hitlist: IResultStrategy<unknown>;
  /** The `statements` view. `profilerStatements` reads it. */
  readonly statements: IResultStrategy<unknown>;
  /** The `dbAccesses` view. `profilerDbAccesses` reads it. */
  readonly dbAccesses: IResultStrategy<unknown>;
  /**
   * The DELETE. `void`, because the contract's deletion answers nothing a
   * caller reads — whether it happened is `ok`, and `analyse` judges it.
   */
  readonly deletion: IResultStrategy<void>;
}

/**
 * The shipped default: every listing and view answers its document as it
 * arrived; a deletion answers nothing.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const profilerDocuments = {
  list: rawDocument,
  hitlist: rawDocument,
  statements: rawDocument,
  dbAccesses: rawDocument,
  deletion: nothing,
} satisfies IProfilerResults;

/** The three views a profiler trace has, typed by the strategies that read them. */
export interface IProfilerViews<R extends IProfilerResults> {
  hitlist: ITraceView<ReturnType<R['hitlist']>, IProfilerTraceHitListOptions>;
  statements: ITraceView<
    ReturnType<R['statements']>,
    IProfilerTraceStatementsOptions
  >;
  dbAccesses: ITraceView<
    ReturnType<R['dbAccesses']>,
    IProfilerTraceDbAccessesOptions
  >;
}

/**
 * The ABAP profiler: list, read a view, delete — one request each.
 *
 * Composed from the atoms `IProfiler` is made of rather than `IProfiler`
 * itself: that alias fixes a listing's answer to `TEntry[]`, and the listing
 * answers whatever the `list` strategy makes of the feed — the document, by
 * default.
 */
export class Profiler<R extends IProfilerResults = typeof profilerDocuments>
  implements
    ITraceFamily<'profiler'>,
    ITraceListing<ITraceEntry, IProfilerListOptions, ReturnType<R['list']>>,
    ITraceReading<IProfilerViews<R>>,
    ITraceDeletion
{
  readonly kind = 'profiler' as const;

  constructor(
    private readonly connection: IAbapConnection,
    readonly _logger: ILogger,
    // The one cast in this file, and it is on the default. See AdtClass.
    private readonly results: R = profilerDocuments as unknown as R,
  ) {}

  /** What traces exist. */
  async list<E extends IAdtError = IAdtError>(
    options?: IProfilerListOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['list']>, E>> {
    return answering(
      () => listTraceFiles(this.connection, options),
      this.results.list as IResultStrategy<ReturnType<R['list']>>,
      options?.analyse,
    );
  }

  /**
   * Remove a trace.
   *
   * What a missing id answers is not measured; a caller who must tolerate one
   * reads `ok`, or passes an `analyse` that says what it means.
   */
  async delete<E extends IAdtError = IAdtError>(
    traceId: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<void, E>> {
    return answering(
      () => deleteTrace(this.connection, traceId),
      this.results.deletion,
      options?.analyse,
    );
  }

  /**
   * The request for a view.
   *
   * One place that knows which URL and which options a view sends.
   */
  private async viewResponse<K extends keyof IProfilerViews<R>>(
    traceId: string,
    view: K,
    options: unknown,
  ): Promise<IAdtWireResponse> {
    switch (view) {
      case 'hitlist':
        return getTraceHitList(
          this.connection,
          traceId,
          options as IProfilerTraceHitListOptions | undefined,
        );
      case 'statements':
        return getTraceStatements(
          this.connection,
          traceId,
          options as IProfilerTraceStatementsOptions | undefined,
        );
      case 'dbAccesses':
        return getTraceDbAccesses(
          this.connection,
          traceId,
          options as IProfilerTraceDbAccessesOptions | undefined,
        );
      default:
        // Unreachable through the typed surface; reachable from JavaScript.
        throw new Error(`Unknown trace view: ${String(view)}`);
    }
  }

  /**
   * What is inside one trace.
   *
   * One operation, three views, each read by its own strategy — asking for
   * `hitlist` yields what the `hitlist` strategy makes of the hit list, and the
   * compiler refuses a view this family does not have.
   */
  async read<
    K extends keyof IProfilerViews<R>,
    E extends IAdtError = IAdtError,
  >(
    traceId: string,
    view: K,
    options?: ViewOptions<IProfilerViews<R>, K> & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ViewResult<IProfilerViews<R>, K>, E>> {
    // Before the request, not inside it: a view this family does not have is a
    // caller error, and classified inside `answering` it would come back as
    // `origin: 'connection'` — advice to check the network over a name the
    // compiler already refuses.
    if (view !== 'hitlist' && view !== 'statements' && view !== 'dbAccesses') {
      throw new Error(`Unknown trace view: ${String(view)}`);
    }
    return answering(
      () => this.viewResponse(traceId, view, options),
      this.results[view] as IResultStrategy<ViewResult<IProfilerViews<R>, K>>,
      options?.analyse,
    );
  }

  buildParametersXml(options?: IProfilerTraceParameters): string {
    return buildTraceParametersXml(options);
  }

  getDefaultParameters(): Omit<IProfilerTraceParameters, 'description'> {
    return { ...DEFAULT_PROFILER_TRACE_PARAMETERS };
  }
}

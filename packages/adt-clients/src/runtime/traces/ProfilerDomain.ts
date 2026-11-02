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
import type { AdtLoggedOptions } from '../../core/shared/handlerOptions';
import { answering } from '../../utils/adtResponse';
import {
  nothing,
  type ResultStrategiesOf,
  type ResultValuesOf,
  rawDocument,
} from '../../utils/resultStrategy';
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
/** Each view's own options. */
interface IProfilerViewOptions {
  hitlist: IProfilerTraceHitListOptions;
  statements: IProfilerTraceStatementsOptions;
  dbAccesses: IProfilerTraceDbAccessesOptions;
}

/**
 * The three views a profiler trace has, typed by the values their strategies
 * answer. A mapped type over the view names, so a view's result for a generic
 * name is `T[K]` — what its strategy answers — with no cast.
 */
export type IProfilerViews<T extends ProfilerValues> = {
  [K in keyof IProfilerViewOptions]: ITraceView<T[K], IProfilerViewOptions[K]>;
};

/**
 * What each slot of the result set answers.
 *
 * Read from the contract rather than `unknown` for every slot: `deletion` is
 * fixed to `void` by `IProfilerResults`, and `delete` answers that.
 */
export type ProfilerValues = ResultValuesOf<IProfilerResults>;

/**
 * The ABAP profiler: list, read a view, delete — one request each.
 *
 * Composed from the atoms `IProfiler` is made of rather than `IProfiler`
 * itself: that alias fixes a listing's answer to `TEntry[]`, and the listing
 * answers whatever the `list` strategy makes of the feed — the document, by
 * default.
 */
export class Profiler<
  T extends ProfilerValues = ResultValuesOf<typeof profilerDocuments>,
> implements
    ITraceFamily<'profiler'>,
    ITraceListing<ITraceEntry, IProfilerListOptions, T['list']>,
    ITraceReading<IProfilerViews<T>>,
    ITraceDeletion
{
  readonly kind = 'profiler' as const;

  private readonly results: ResultStrategiesOf<T>;
  readonly _logger: ILogger;

  constructor(
    private readonly connection: IAbapConnection,
    options: AdtLoggedOptions<ResultStrategiesOf<T>>,
  ) {
    this._logger = options.logger;
    this.results = options.results;
  }

  /** What traces exist. */
  async list<E extends IAdtError = IAdtError>(
    options?: IProfilerListOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['list'], E>> {
    return answering(
      () => listTraceFiles(this.connection, options),
      this.results.list,
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
  private async viewResponse<K extends keyof IProfilerViews<T>>(
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
    K extends keyof IProfilerViews<T>,
    E extends IAdtError = IAdtError,
  >(
    traceId: string,
    view: K,
    options?: ViewOptions<IProfilerViews<T>, K> & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<IProfilerViews<T>[K]['result'], E>> {
    // Before the request, not inside it: a view this family does not have is a
    // caller error, and classified inside `answering` it would come back as
    // `origin: 'connection'` — advice to check the network over a name the
    // compiler already refuses.
    if (view !== 'hitlist' && view !== 'statements' && view !== 'dbAccesses') {
      throw new Error(`Unknown trace view: ${String(view)}`);
    }
    return answering(
      () => this.viewResponse(traceId, view, options),
      this.results[view],
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

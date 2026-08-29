import type {
  IAbapConnection,
  IAbapTraceViews,
  IAdtResponse,
  ILogger,
  IProfiler,
  IProfilerListOptions,
  IProfilerTraceDbAccessesOptions,
  IProfilerTraceHitListOptions,
  IProfilerTraceParameters,
  IProfilerTraceStatementsOptions,
  ITraceEntry,
  ViewArgs,
  ViewResult,
} from '@mcp-abap-adt/interfaces';
import {
  buildTraceParametersXml,
  createTraceParameters,
  DEFAULT_PROFILER_TRACE_PARAMETERS,
  extractProfilerIdFromResponse,
  getTraceDbAccesses,
  getTraceHitList,
  getTraceRequestsByUri,
  getTraceStatements,
  listObjectTypes,
  listProcessTypes,
  listTraceFiles,
  listTraceRequests,
} from './profiler';
import {
  compareRecordedAt,
  parseDbAccesses,
  parseHitList,
  parseStatements,
  parseTraceEntries,
} from './traceParsing';

export class Profiler implements IProfiler {
  readonly kind = 'profiler' as const;

  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  /**
   * What traces exist.
   *
   * Parsed, not raw: the contract says a listing yields entries. The raw
   * response is still available through {@link listTraceFilesResponse} for a
   * caller that wants the document itself.
   */
  async list(options?: IProfilerListOptions): Promise<ITraceEntry[]> {
    return parseTraceEntries(await this.listTraceFilesResponse(options));
  }

  /** The feed as the server sent it. */
  async listTraceFilesResponse(
    options?: IProfilerListOptions,
  ): Promise<IAdtResponse> {
    return listTraceFiles(this.connection, options);
  }

  /** @deprecated Use {@link listTraceFilesResponse} — `list()` now parses. */
  async listTraceFiles(options?: IProfilerListOptions): Promise<IAdtResponse> {
    return this.listTraceFilesResponse(options);
  }

  /**
   * What is inside one trace.
   *
   * One operation, three views. The result type is the view's own — asking for
   * `hitlist` yields a hit list, and the compiler refuses a view this family
   * does not have.
   */
  async read<K extends keyof IAbapTraceViews>(
    traceId: string,
    view: K,
    ...args: ViewArgs<IAbapTraceViews, K>
  ): Promise<ViewResult<IAbapTraceViews, K>> {
    const [options] = args;
    switch (view) {
      case 'hitlist':
        return parseHitList(
          await getTraceHitList(
            this.connection,
            traceId,
            options as IProfilerTraceHitListOptions | undefined,
          ),
        ) as ViewResult<IAbapTraceViews, K>;
      case 'statements':
        return parseStatements(
          await getTraceStatements(
            this.connection,
            traceId,
            options as IProfilerTraceStatementsOptions | undefined,
          ),
        ) as ViewResult<IAbapTraceViews, K>;
      case 'dbAccesses':
        return parseDbAccesses(
          await getTraceDbAccesses(
            this.connection,
            traceId,
            options as IProfilerTraceDbAccessesOptions | undefined,
          ),
        ) as ViewResult<IAbapTraceViews, K>;
      default:
        // Unreachable through the typed surface; reachable from JavaScript.
        throw new Error(`Unknown trace view: ${String(view)}`);
    }
  }

  /**
   * The id of the most RECENTLY WRITTEN trace file, or undefined when the feed
   * holds none.
   *
   * Newest by timestamp, not by position. `extractTraceIdFromTraceFeed()` takes
   * the first id in the document, and on E19 that is not the newest: measured,
   * the feed's first three entries were 06:09:50, 06:10:01 and 06:10:38 while
   * its last were from eight days earlier, and a trace written minutes before
   * the call sat somewhere in the middle. Anything that trusted position got a
   * stale trace and no error to say so.
   *
   * Pass `user` to scope it — on a shared system the newest trace is not
   * necessarily yours.
   *
   * This answers "what is newest", which is NOT the same question as "what did
   * my run just produce". SAP writes traces asynchronously, so a caller that
   * needs its OWN trace must note the ids it saw before running and poll for
   * one that is new — see `ClassExecutor.runWithProfiling`.
   *
   * NOTE: not on `IProfiler` yet. The contract lives in
   * `@mcp-abap-adt/interfaces`; until it carries this method, reach it through
   * the concrete `Profiler`, which this package exports.
   */
  async latestTraceId(
    options?: IProfilerListOptions,
  ): Promise<string | undefined> {
    const entries = await this.list(options);
    if (entries.length === 0) {
      return undefined;
    }
    // By time, not by text: `"unexpected"` sorts above any ISO timestamp, and
    // two valid ones with different offsets do not compare chronologically as
    // strings. Picking the wrong trace is exactly what this method exists to
    // prevent.
    return entries.reduce((newest, entry) =>
      compareRecordedAt(entry, newest) > 0 ? entry : newest,
    ).id;
  }

  /**
   * Every trace in the feed, with the id and the moment it was written.
   *
   * Exposed because "newest" is rarely the real question: a caller that wants
   * the trace ITS run produced compares this against what it saw beforehand.
   */
  async listTraceIds(
    options?: IProfilerListOptions,
  ): Promise<Array<{ id: string; writtenAt: string }>> {
    return (await this.list(options)).map((entry) => ({
      id: entry.id,
      writtenAt: entry.recordedAt,
    }));
  }

  buildParametersXml(options?: IProfilerTraceParameters): string {
    return buildTraceParametersXml(options);
  }

  extractIdFromResponse(response: IAdtResponse): string | undefined {
    return extractProfilerIdFromResponse(response);
  }

  getDefaultParameters(): Omit<IProfilerTraceParameters, 'description'> {
    return { ...DEFAULT_PROFILER_TRACE_PARAMETERS };
  }
}

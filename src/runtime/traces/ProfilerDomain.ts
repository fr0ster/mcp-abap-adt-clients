import type {
  IAbapConnection,
  IAdtResponse,
  ILogger,
  IProfiler,
  IProfilerListOptions,
  IProfilerTraceDbAccessesOptions,
  IProfilerTraceHitListOptions,
  IProfilerTraceParameters,
  IProfilerTraceStatementsOptions,
} from '@mcp-abap-adt/interfaces';
import {
  buildTraceParametersXml,
  createTraceParameters,
  DEFAULT_PROFILER_TRACE_PARAMETERS,
  extractProfilerIdFromResponse,
  getTraceDbAccesses,
  getTraceHitList,
  getTraceParameters,
  getTraceParametersForAmdp,
  getTraceParametersForCallstack,
  getTraceRequestsByUri,
  getTraceStatements,
  listObjectTypes,
  listProcessTypes,
  listTraceFiles,
  listTraceRequests,
  parseTraceFeedEntries,
} from './profiler';

export class Profiler implements IProfiler {
  readonly kind = 'profiler' as const;

  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async list(options?: IProfilerListOptions): Promise<IAdtResponse> {
    return listTraceFiles(this.connection, options);
  }

  /** @deprecated Use list() instead */
  async listTraceFiles(options?: IProfilerListOptions): Promise<IAdtResponse> {
    return this.list(options);
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
    const response = await this.list(options);
    const entries = parseTraceFeedEntries(response);
    if (entries.length === 0) {
      return undefined;
    }
    return entries.reduce((newest, entry) =>
      entry.writtenAt > newest.writtenAt ? entry : newest,
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
    return parseTraceFeedEntries(await this.list(options));
  }

  async getParameters(): Promise<IAdtResponse> {
    return getTraceParameters(this.connection);
  }

  async getParametersForCallstack(): Promise<IAdtResponse> {
    return getTraceParametersForCallstack(this.connection);
  }

  async getParametersForAmdp(): Promise<IAdtResponse> {
    return getTraceParametersForAmdp(this.connection);
  }

  buildParametersXml(options?: IProfilerTraceParameters): string {
    return buildTraceParametersXml(options);
  }

  async createParameters(
    options?: IProfilerTraceParameters,
  ): Promise<IAdtResponse> {
    return createTraceParameters(this.connection, options);
  }

  extractIdFromResponse(response: IAdtResponse): string | undefined {
    return extractProfilerIdFromResponse(response);
  }

  getDefaultParameters(): Omit<IProfilerTraceParameters, 'description'> {
    return { ...DEFAULT_PROFILER_TRACE_PARAMETERS };
  }

  async getHitList(
    traceIdOrUri: string,
    options?: IProfilerTraceHitListOptions,
  ): Promise<IAdtResponse> {
    return getTraceHitList(this.connection, traceIdOrUri, options);
  }

  async getStatements(
    traceIdOrUri: string,
    options?: IProfilerTraceStatementsOptions,
  ): Promise<IAdtResponse> {
    return getTraceStatements(this.connection, traceIdOrUri, options);
  }

  async getDbAccesses(
    traceIdOrUri: string,
    options?: IProfilerTraceDbAccessesOptions,
  ): Promise<IAdtResponse> {
    return getTraceDbAccesses(this.connection, traceIdOrUri, options);
  }

  async listRequests(): Promise<IAdtResponse> {
    return listTraceRequests(this.connection);
  }

  async getRequestsByUri(uri: string): Promise<IAdtResponse> {
    return getTraceRequestsByUri(this.connection, uri);
  }

  async listObjectTypes(): Promise<IAdtResponse> {
    return listObjectTypes(this.connection);
  }

  async listProcessTypes(): Promise<IAdtResponse> {
    return listProcessTypes(this.connection);
  }
}

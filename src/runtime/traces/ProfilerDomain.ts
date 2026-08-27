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
  extractTraceIdFromTraceFeed,
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
   * The id of the most recent trace file, or undefined when there is none.
   *
   * The step between "I ran something with the profiler" and "let me read its
   * hitlist", which every caller needs and each was left to write for itself:
   * `list()` answers with an Atom feed, and turning that into an id meant a
   * regex in consumer code while this package already had one.
   *
   * Pass `user` to scope it — on a shared system the newest trace is not
   * necessarily yours.
   *
   * NOTE: not on `IProfiler` yet. The contract lives in
   * `@mcp-abap-adt/interfaces`; until it carries this method, reach it through
   * the concrete `Profiler`, which this package exports.
   */
  async latestTraceId(
    options?: IProfilerListOptions,
  ): Promise<string | undefined> {
    const response = await this.list(options);
    return extractTraceIdFromTraceFeed(response);
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

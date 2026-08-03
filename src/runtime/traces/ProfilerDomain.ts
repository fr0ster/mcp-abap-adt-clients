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

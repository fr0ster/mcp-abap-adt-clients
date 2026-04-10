import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IRuntimeAnalysisObject } from '../types';
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
  type IProfilerTraceDbAccessesOptions,
  type IProfilerTraceHitListOptions,
  type IProfilerTraceParameters,
  type IProfilerTraceStatementsOptions,
  listObjectTypes,
  listProcessTypes,
  listTraceFiles,
  listTraceRequests,
} from './profiler';

export class Profiler implements IRuntimeAnalysisObject {
  readonly kind = 'profiler' as const;

  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async listTraceFiles(options?: { user?: string }): Promise<AxiosResponse> {
    return listTraceFiles(this.connection, options);
  }

  async getParameters(): Promise<AxiosResponse> {
    return getTraceParameters(this.connection);
  }

  async getParametersForCallstack(): Promise<AxiosResponse> {
    return getTraceParametersForCallstack(this.connection);
  }

  async getParametersForAmdp(): Promise<AxiosResponse> {
    return getTraceParametersForAmdp(this.connection);
  }

  buildParametersXml(options?: IProfilerTraceParameters): string {
    return buildTraceParametersXml(options);
  }

  async createParameters(
    options?: IProfilerTraceParameters,
  ): Promise<AxiosResponse> {
    return createTraceParameters(this.connection, options);
  }

  extractIdFromResponse(response: AxiosResponse): string | undefined {
    return extractProfilerIdFromResponse(response);
  }

  getDefaultParameters(): Omit<IProfilerTraceParameters, 'description'> {
    return { ...DEFAULT_PROFILER_TRACE_PARAMETERS };
  }

  async getHitList(
    traceIdOrUri: string,
    options?: IProfilerTraceHitListOptions,
  ): Promise<AxiosResponse> {
    return getTraceHitList(this.connection, traceIdOrUri, options);
  }

  async getStatements(
    traceIdOrUri: string,
    options?: IProfilerTraceStatementsOptions,
  ): Promise<AxiosResponse> {
    return getTraceStatements(this.connection, traceIdOrUri, options);
  }

  async getDbAccesses(
    traceIdOrUri: string,
    options?: IProfilerTraceDbAccessesOptions,
  ): Promise<AxiosResponse> {
    return getTraceDbAccesses(this.connection, traceIdOrUri, options);
  }

  async listRequests(): Promise<AxiosResponse> {
    return listTraceRequests(this.connection);
  }

  async getRequestsByUri(uri: string): Promise<AxiosResponse> {
    return getTraceRequestsByUri(this.connection, uri);
  }

  async listObjectTypes(): Promise<AxiosResponse> {
    return listObjectTypes(this.connection);
  }

  async listProcessTypes(): Promise<AxiosResponse> {
    return listProcessTypes(this.connection);
  }
}

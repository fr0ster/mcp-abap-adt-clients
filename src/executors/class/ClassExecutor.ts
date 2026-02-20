import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  IExecutor,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { runClass } from '../../core/class/run';
import {
  createTraceParameters,
  extractProfilerIdFromResponse,
  extractTraceIdFromTraceRequestsResponse,
  getTraceRequestsByUri,
  type IProfilerTraceParameters,
  listTraceFiles,
  listTraceRequests,
} from '../../runtime/traces/profiler';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

export interface IClassExecutionTarget {
  className: string;
}

export interface IClassExecuteWithProfilerOptions {
  profilerId: string;
}

export interface IClassExecuteWithProfilingOptions {
  profilerParameters?: IProfilerTraceParameters;
  traceLookupUris?: string[];
}

export interface IClassExecuteWithProfilingResult {
  response: AxiosResponse;
  profilerId: string;
  traceId: string;
  traceRequestsResponse: AxiosResponse;
}

export interface IClassExecutor
  extends IExecutor<
    IClassExecutionTarget,
    AxiosResponse,
    IClassExecuteWithProfilerOptions,
    IClassExecuteWithProfilingOptions,
    IClassExecuteWithProfilingResult
  > {}

export class ClassExecutor implements IClassExecutor {
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;

  constructor(connection: IAbapConnection, logger?: ILogger) {
    this.connection = connection;
    this.logger = logger;
  }

  async run(target: IClassExecutionTarget): Promise<AxiosResponse> {
    if (!target.className) {
      throw new Error('Class name is required');
    }
    return runClass(this.connection, target.className, true);
  }

  async runWithProfiler(
    target: IClassExecutionTarget,
    options: IClassExecuteWithProfilerOptions,
  ): Promise<AxiosResponse> {
    if (!target.className) {
      throw new Error('Class name is required');
    }
    if (!options.profilerId) {
      throw new Error('profilerId is required');
    }
    return this.runWithProfilerId(target.className, options.profilerId);
  }

  async runWithProfiling(
    target: IClassExecutionTarget,
    options: IClassExecuteWithProfilingOptions = {},
  ): Promise<IClassExecuteWithProfilingResult> {
    if (!target.className) {
      throw new Error('Class name is required');
    }

    const parametersResponse = await createTraceParameters(
      this.connection,
      options.profilerParameters,
    );
    const profilerId = extractProfilerIdFromResponse(parametersResponse);
    if (!profilerId) {
      throw new Error(
        'Failed to extract profilerId from trace parameters response',
      );
    }

    const response = await this.runWithProfilerId(target.className, profilerId);

    const lookupUris = [
      ...(options.traceLookupUris ?? []),
      `/sap/bc/adt/oo/classrun/${target.className}`,
      `/sap/bc/adt/oo/classrun/${encodeSapObjectName(target.className).toUpperCase()}`,
    ];

    let traceRequestsResponse: AxiosResponse | undefined;
    for (const uri of lookupUris) {
      if (!uri) {
        continue;
      }

      try {
        const current = await getTraceRequestsByUri(this.connection, uri);
        const traceId = extractTraceIdFromTraceRequestsResponse(current);
        if (traceId) {
          return {
            response,
            profilerId,
            traceId,
            traceRequestsResponse: current,
          };
        }
        traceRequestsResponse = current;
      } catch (error) {
        this.logger?.debug?.('Trace lookup by URI failed, trying next URI', {
          className: target.className,
          uri,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    let fallbackResponse: AxiosResponse;
    let fallbackTraceId: string | undefined;
    try {
      fallbackResponse = await listTraceRequests(this.connection);
      fallbackTraceId =
        extractTraceIdFromTraceRequestsResponse(fallbackResponse);
    } catch (error) {
      this.logger?.debug?.('Trace requests list failed, trying trace files', {
        className: target.className,
        error: error instanceof Error ? error.message : String(error),
      });
      fallbackResponse = await listTraceFiles(this.connection);
      fallbackTraceId =
        extractTraceIdFromTraceRequestsResponse(fallbackResponse);
    }
    if (!fallbackTraceId) {
      this.logger?.warn?.('Fallback trace response did not contain trace id', {
        className: target.className,
      });
      throw new Error(
        `Failed to resolve traceId after profiled execution for class ${target.className}`,
      );
    }

    return {
      response,
      profilerId,
      traceId: fallbackTraceId,
      traceRequestsResponse: traceRequestsResponse ?? fallbackResponse,
    };
  }

  private async runWithProfilerId(
    className: string,
    profilerId: string,
  ): Promise<AxiosResponse> {
    const encodedProfilerId = encodeURIComponent(profilerId);
    return this.connection.makeAdtRequest({
      url: `/sap/bc/adt/oo/classrun/${className}?profilerId=${encodedProfilerId}`,
      method: 'POST',
      timeout: getTimeout('default'),
      headers: {
        Accept: 'text/plain',
        'X-sap-adt-profiling': 'server-time',
      },
    });
  }
}

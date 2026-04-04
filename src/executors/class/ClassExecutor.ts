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
import { getSystemInformation } from '../../utils/systemInfo';
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
  /** Maximum number of polling attempts to find the trace (default: 5) */
  maxTraceAttempts?: number;
  /** Delay in ms between polling attempts (default: 2000) */
  traceRetryDelayMs?: number;
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

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

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

    // Resolve current user for trace file lookup
    let userName: string | undefined;
    try {
      const sysInfo = await getSystemInformation(this.connection);
      userName = sysInfo?.userName;
    } catch {
      this.logger?.debug?.('Failed to resolve userName for trace lookup');
    }

    const response = await this.runWithProfilerId(target.className, profilerId);

    const maxAttempts = options.maxTraceAttempts ?? 5;
    const retryDelayMs = options.traceRetryDelayMs ?? 2000;

    const lookupUris = [
      ...(options.traceLookupUris ?? []),
      `/sap/bc/adt/oo/classrun/${target.className}`,
      `/sap/bc/adt/oo/classrun/${encodeSapObjectName(target.className).toUpperCase()}`,
    ];

    // SAP writes traces asynchronously — poll until the trace file appears
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      this.logger?.debug?.(`Trace lookup attempt ${attempt}/${maxAttempts}`, {
        className: target.className,
        profilerId,
      });

      const result = await this.tryResolveTrace(
        lookupUris,
        profilerId,
        response,
        userName,
      );
      if (result) {
        return result;
      }

      if (attempt < maxAttempts) {
        await delay(retryDelayMs);
      }
    }

    this.logger?.warn?.('Failed to resolve trace after all attempts', {
      className: target.className,
      profilerId,
      maxAttempts,
    });
    throw new Error(
      `Failed to resolve traceId after profiled execution for class ${target.className}`,
    );
  }

  /**
   * Single attempt to find trace via trace files (filtered by user),
   * URI lookup, and trace requests fallback.
   */
  private async tryResolveTrace(
    lookupUris: string[],
    profilerId: string,
    runResponse: AxiosResponse,
    userName?: string,
  ): Promise<IClassExecuteWithProfilingResult | undefined> {
    let traceRequestsResponse: AxiosResponse | undefined;

    // 1. Primary: list trace files filtered by user
    try {
      const filesResponse = await listTraceFiles(
        this.connection,
        userName ? { user: userName } : undefined,
      );
      const traceId = extractTraceIdFromTraceRequestsResponse(filesResponse);
      if (traceId) {
        return {
          response: runResponse,
          profilerId,
          traceId,
          traceRequestsResponse: filesResponse,
        };
      }
    } catch (error) {
      this.logger?.debug?.('Trace files list failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // 2. Fallback: lookup by URI
    for (const uri of lookupUris) {
      if (!uri) {
        continue;
      }
      try {
        const current = await getTraceRequestsByUri(this.connection, uri);
        const traceId = extractTraceIdFromTraceRequestsResponse(current);
        if (traceId) {
          return {
            response: runResponse,
            profilerId,
            traceId,
            traceRequestsResponse: current,
          };
        }
        traceRequestsResponse = current;
      } catch (error) {
        this.logger?.debug?.('Trace lookup by URI failed, trying next URI', {
          uri,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 3. Fallback: list all trace requests
    try {
      const reqResponse = await listTraceRequests(this.connection);
      const traceId = extractTraceIdFromTraceRequestsResponse(reqResponse);
      if (traceId) {
        return {
          response: runResponse,
          profilerId,
          traceId,
          traceRequestsResponse: traceRequestsResponse ?? reqResponse,
        };
      }
    } catch (error) {
      this.logger?.debug?.('Trace requests list failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return undefined;
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

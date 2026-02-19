import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  IExecutor,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { runProgram } from '../../core/program/run';
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

export interface IProgramExecutionTarget {
  programName: string;
}

export interface IProgramExecuteWithProfilerOptions {
  profilerId: string;
}

export interface IProgramExecuteWithProfilingOptions {
  profilerParameters?: IProfilerTraceParameters;
  traceLookupUris?: string[];
}

export interface IProgramExecuteWithProfilingResult {
  response: AxiosResponse;
  profilerId: string;
  traceId: string;
  traceRequestsResponse: AxiosResponse;
}

export interface IProgramExecutor
  extends IExecutor<
    IProgramExecutionTarget,
    AxiosResponse,
    IProgramExecuteWithProfilerOptions,
    IProgramExecuteWithProfilingOptions,
    IProgramExecuteWithProfilingResult
  > {}

export class ProgramExecutor implements IProgramExecutor {
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;

  constructor(connection: IAbapConnection, logger?: ILogger) {
    this.connection = connection;
    this.logger = logger;
  }

  async run(target: IProgramExecutionTarget): Promise<AxiosResponse> {
    if (!target.programName) {
      throw new Error('Program name is required');
    }
    return runProgram(this.connection, target.programName);
  }

  async runWithProfiler(
    target: IProgramExecutionTarget,
    options: IProgramExecuteWithProfilerOptions,
  ): Promise<AxiosResponse> {
    if (!target.programName) {
      throw new Error('Program name is required');
    }
    if (!options.profilerId) {
      throw new Error('profilerId is required');
    }
    return this.runWithProfilerId(target.programName, options.profilerId);
  }

  async runWithProfiling(
    target: IProgramExecutionTarget,
    options: IProgramExecuteWithProfilingOptions = {},
  ): Promise<IProgramExecuteWithProfilingResult> {
    if (!target.programName) {
      throw new Error('Program name is required');
    }

    const normalizedProgramName = encodeSapObjectName(
      target.programName,
    ).toUpperCase();

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

    const response = await this.runWithProfilerId(
      normalizedProgramName,
      profilerId,
    );

    const lookupUris = [
      ...(options.traceLookupUris ?? []),
      `/sap/bc/adt/programs/programrun/${normalizedProgramName}`,
      `/sap/bc/adt/programs/programrun/${encodeURIComponent(normalizedProgramName)}`,
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
          programName: normalizedProgramName,
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
        programName: normalizedProgramName,
        error: error instanceof Error ? error.message : String(error),
      });
      fallbackResponse = await listTraceFiles(this.connection);
      fallbackTraceId =
        extractTraceIdFromTraceRequestsResponse(fallbackResponse);
    }
    if (!fallbackTraceId) {
      this.logger?.warn?.('Fallback trace response did not contain trace id', {
        programName: normalizedProgramName,
      });
      throw new Error(
        `Failed to resolve traceId after profiled execution for program ${normalizedProgramName}`,
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
    programName: string,
    profilerId: string,
  ): Promise<AxiosResponse> {
    const normalizedProgramName =
      encodeSapObjectName(programName).toUpperCase();
    const encodedProfilerId = encodeURIComponent(profilerId);
    return this.connection.makeAdtRequest({
      url: `/sap/bc/adt/programs/programrun/${normalizedProgramName}?profilerId=${encodedProfilerId}`,
      method: 'POST',
      timeout: getTimeout('default'),
      headers: {
        Accept: 'text/plain',
        'X-sap-adt-profiling': 'server-time',
      },
    });
  }
}

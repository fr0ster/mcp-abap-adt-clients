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
  type IProfilerTraceParameters,
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
}

export interface IProgramExecuteWithProfilingResult {
  response: AxiosResponse;
  profilerId: string;
  // traceId is NOT included — program execution is fire-and-forget.
  // Traces are written asynchronously by SAP after the program completes.
  // Use RuntimeListProfilerTraceFiles to poll for the trace after execution.
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

  constructor(connection: IAbapConnection, _logger?: ILogger) {
    this.connection = connection;
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

    // Fire-and-forget: SAP writes the trace asynchronously after program completes.
    // The caller is responsible for polling RuntimeListProfilerTraceFiles to find the trace.
    return { response, profilerId };
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

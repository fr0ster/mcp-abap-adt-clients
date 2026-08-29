import type {
  IAbapConnection,
  IAdtResponse,
  ILogger,
  INamedItem,
  IProfilerTraceParameters,
  IProgramExecuteWithProfilerOptions,
  IProgramExecuteWithProfilingOptions,
  IProgramExecuteWithProfilingResult,
  IProgramExecutionTarget,
  IProgramExecutor,
  ITraceRequestEntry,
} from '@mcp-abap-adt/interfaces';
import { runProgram } from '../../core/program/run';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { TraceScheduling } from '../traceScheduling';

export class ProgramExecutor implements IProgramExecutor {
  private readonly connection: IAbapConnection;
  private readonly scheduling: TraceScheduling;

  constructor(connection: IAbapConnection, _logger?: ILogger) {
    this.connection = connection;
    this.scheduling = new TraceScheduling(connection);
  }

  // --- ITraceScheduling, delegated. Same capability as the class executor,
  // because a report run fulfils a scheduled request exactly as a class run
  // does — which is why this lives on both and on neither's base.

  listObjectTypes = (): Promise<INamedItem[]> =>
    this.scheduling.listObjectTypes();
  listProcessTypes = (): Promise<INamedItem[]> =>
    this.scheduling.listProcessTypes();
  listRequests = (): Promise<ITraceRequestEntry[]> =>
    this.scheduling.listRequests();
  getRequestsByUri = (uri: string): Promise<ITraceRequestEntry[]> =>
    this.scheduling.getRequestsByUri(uri);
  scheduleTrace = (options?: IProfilerTraceParameters): Promise<string> =>
    this.scheduling.scheduleTrace(options);

  async run(target: IProgramExecutionTarget): Promise<IAdtResponse> {
    if (!target.programName) {
      throw new Error('Program name is required');
    }
    return runProgram(this.connection, target.programName);
  }

  async runWithProfiler(
    target: IProgramExecutionTarget,
    options: IProgramExecuteWithProfilerOptions,
  ): Promise<IAdtResponse> {
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

    const profilerId = await this.scheduleTrace(options.profilerParameters);
    const response = await this.runWithProfilerId(
      normalizedProgramName,
      profilerId,
    );

    // The trace is written asynchronously after the program completes, so this
    // returns without one — the same thing the class executor now does, and the
    // reason both results have the same shape. Find it later with
    // `IProfiler.list()`, comparing against the ids seen before the run.
    return { response, profilerId };
  }

  private async runWithProfilerId(
    programName: string,
    profilerId: string,
  ): Promise<IAdtResponse> {
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

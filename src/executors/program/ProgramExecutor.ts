import type {
  IAbapConnection,
  IAdtResponse,
  ILogger,
  IProfilerTraceParameters,
  IProgramExecuteWithProfilerOptions,
  IProgramExecuteWithProfilingOptions,
  IProgramExecuteWithProfilingResult,
  IProgramExecutionTarget,
  IProgramExecutor,
} from '@mcp-abap-adt/interfaces';
import { runProgram } from '../../core/program/run';
import type { INamedItem } from '../../core/shared/utilResults';
import type { ITraceRequestEntry } from '../../runtime/traces/types';
import { answering, failed, succeeded } from '../../utils/adtResponse';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { rawDocument } from '../../utils/resultStrategy';
import { getTimeout } from '../../utils/timeouts';
import { TraceScheduling } from '../traceScheduling';

export class ProgramExecutor
  implements
    IProgramExecutor<string, INamedItem[], ITraceRequestEntry[], string>
{
  private readonly connection: IAbapConnection;
  private readonly scheduling: TraceScheduling;

  constructor(connection: IAbapConnection, _logger?: ILogger) {
    this.connection = connection;
    this.scheduling = new TraceScheduling(connection);
  }

  // --- ITraceScheduling, delegated. Same capability as the class executor,
  // because a report run fulfils a scheduled request exactly as a class run
  // does — which is why this lives on both and on neither's base.

  listObjectTypes = (): Promise<IAdtResponse<INamedItem[]>> =>
    this.scheduling.listObjectTypes();
  listProcessTypes = (): Promise<IAdtResponse<INamedItem[]>> =>
    this.scheduling.listProcessTypes();
  listRequests = (): Promise<IAdtResponse<ITraceRequestEntry[]>> =>
    this.scheduling.listRequests();
  getRequestsByUri = (
    uri: string,
  ): Promise<IAdtResponse<ITraceRequestEntry[]>> =>
    this.scheduling.getRequestsByUri(uri);
  scheduleTrace = (
    options?: IProfilerTraceParameters,
  ): Promise<IAdtResponse<string>> => this.scheduling.scheduleTrace(options);

  async run(target: IProgramExecutionTarget): Promise<IAdtResponse<string>> {
    if (!target.programName) {
      throw new Error('Program name is required');
    }
    return answering(
      () => runProgram(this.connection, target.programName),
      rawDocument,
    );
  }

  async runWithProfiler(
    target: IProgramExecutionTarget,
    options: IProgramExecuteWithProfilerOptions,
  ): Promise<IAdtResponse<string>> {
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
  ): Promise<IAdtResponse<IProgramExecuteWithProfilingResult<string>>> {
    if (!target.programName) {
      throw new Error('Program name is required');
    }

    const normalizedProgramName = encodeSapObjectName(
      target.programName,
    ).toUpperCase();

    const scheduled = await this.scheduleTrace(options.profilerParameters);
    if (!scheduled.ok) {
      // The measurement could not be configured, so there is nothing to run
      // under it — the scheduling's own failure is the answer.
      return failed(scheduled.getError());
    }
    const profilerId = scheduled.getResult().value;
    const run = await this.runWithProfilerId(normalizedProgramName, profilerId);
    if (!run.ok) return failed(run.getError());

    // The trace is written asynchronously after the program completes, so this
    // returns without one — the same thing the class executor now does, and the
    // reason both results have the same shape. Find it later with
    // `IProfiler.list()`, comparing against the ids seen before the run.
    return succeeded({ run: run.getResult().value, profilerId });
  }

  private async runWithProfilerId(
    programName: string,
    profilerId: string,
  ): Promise<IAdtResponse<string>> {
    const normalizedProgramName =
      encodeSapObjectName(programName).toUpperCase();
    const encodedProfilerId = encodeURIComponent(profilerId);
    return answering(
      () =>
        this.connection.makeAdtRequest({
          url: `/sap/bc/adt/programs/programrun/${normalizedProgramName}?profilerId=${encodedProfilerId}`,
          method: 'POST',
          timeout: getTimeout('default'),
          headers: {
            Accept: 'text/plain',
            'X-sap-adt-profiling': 'server-time',
          },
        }),
      rawDocument,
    );
  }
}
